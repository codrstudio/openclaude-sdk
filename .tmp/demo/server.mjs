import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { serve } from "@hono/node-server"
import { z } from "zod"

import {
  query,
  prompt,
  createSession,
  resumeSession,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession,
  tagSession,
  deleteSession,
  createSdkMcpServer,
  tool,
  DEFAULT_MODEL,
  BUILTIN_CATALOG,
  DisplayToolRegistry,
  REACT_OUTPUT_SYSTEM_PROMPT,
} from "../../dist/index.js"

// ---------------------------------------------------------------------------
// MCP echo tool — exercita createSdkMcpServer + tool()
// ---------------------------------------------------------------------------

const echoTool = tool(
  "echo",
  "Repete o texto recebido — util pra testar tool_use no chat.",
  { text: z.string().describe("texto a ecoar") },
  async ({ text }) => ({
    content: [{ type: "text", text: `echo: ${text}` }],
  }),
)

const mcpEcho = await createSdkMcpServer({
  name: "demo-echo",
  version: "0.1.0",
  tools: [echoTool],
})

const defaultMcpServers = { "demo-echo": mcpEcho }

// ---------------------------------------------------------------------------
// Stderr ring buffer — captura output do CLI `claude` (prefixado `[openclaude
// stderr]` pelo SDK) pra incluir em respostas de erro quando o CLI morre sem
// emitir SDKMessage algum.
// ---------------------------------------------------------------------------

const STDERR_BUFFER_MAX = 40
const stderrBuffer = []
const originalStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = (chunk, ...rest) => {
  try {
    const str = typeof chunk === "string" ? chunk : chunk.toString("utf8")
    for (const line of str.split(/\r?\n/)) {
      if (line.trim()) {
        stderrBuffer.push(line)
        if (stderrBuffer.length > STDERR_BUFFER_MAX) stderrBuffer.shift()
      }
    }
  } catch {}
  return originalStderrWrite(chunk, ...rest)
}

function snapshotStderr() {
  return stderrBuffer.slice(-20)
}

// ---------------------------------------------------------------------------
// Live session registry (in-memory) — para session-v2 multi-turn
// ---------------------------------------------------------------------------

/** @type {Map<string, import("../../dist/index.js").SDKSession>} */
const liveSessions = new Map()

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono()

app.use("*", async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`)
  await next()
})

const api = new Hono()

// ---- health / models ------------------------------------------------------

api.get("/health", (c) => c.json({ ok: true, ts: Date.now() }))

// GET /display — lista as 4 meta-tools e os 19 nomes de action (sem schema Zod,
// que nao serializa direto como JSON). Util pro cliente saber o que esperar.
api.get("/display", (c) => {
  const toolNames = Object.keys(DisplayToolRegistry ?? {})
  return c.json({
    enabled: true,
    metaTools: ["display_highlight", "display_collection", "display_card", "display_visual"],
    actions: {
      display_highlight: ["metric", "price", "alert", "choices"],
      display_collection: ["table", "spreadsheet", "comparison", "carousel", "gallery", "sources"],
      display_card: ["product", "link", "file", "image"],
      display_visual: ["chart", "map", "code", "progress", "steps", "react"],
    },
    registryKeys: toolNames,
  })
})

api.get("/models", (c) => {
  const catalog = BUILTIN_CATALOG
  return c.json({
    object: "list",
    data: catalog.models.map((m) => ({
      id: m.id,
      object: "model",
      created: 0,
      owned_by: m.provider,
      label: m.label,
      context_window: m.contextWindow ?? null,
      supports_vision: m.supportsVision ?? null,
    })),
    default_model: catalog.defaultModel,
  })
})

// ---- stateless chat -------------------------------------------------------

// Helper: options base comuns a todos os endpoints.
// Defaults escolhidos pq o CLI `openclaude` instalado nao conhece:
//   - `--system-prompt-preset` (SDK injeta quando richOutput=true)
//   - `--mcp-server-sse` (SDK injeta quando ha SDK MCP server)
// E porque o SDK (process.ts:400) so fecha stdin do CLI quando
// permissionMode e 'bypassPermissions' ou 'dontAsk' — senao o processo
// trava esperando respostas de permissao via stdin, mesmo em `-p` (print)
// mode que deveria ser non-interactive. Sem fechar stdin, o CLI nunca
// comeca a gerar output e a request pendura ate timeout.
// Rich output pipeline — manual, bypassing the SDK's built-in richOutput flag.
// Rationale: `options.richOutput: true` uses StreamableHTTPServerTransport under
// the hood to host the display MCP server in-process, and the openclaude CLI's
// MCP client fails to establish that transport (status: "failed" in init message).
// Instead we spawn a standalone stdio MCP server (mcp-display-stdio.mjs) as a
// subprocess via the CLI's --mcp-config, which uses the well-tested
// StdioServerTransport path.
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const mcpDisplayScript = resolve(__dirname, "mcp-display-stdio.mjs")

const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific to that action. Call them exactly like any other tool. The client renders them as interactive widgets.

${REACT_OUTPUT_SYSTEM_PROMPT}`

function baseOptions(bodyOptions = {}) {
  return {
    richOutput: false,
    permissionMode: "bypassPermissions",
    systemPrompt: { type: "preset", preset: "claude_code", append: DISPLAY_SYSTEM_PROMPT },
    mcpServers: {
      display: {
        type: "stdio",
        command: "node",
        args: [mcpDisplayScript],
      },
    },
    ...bodyOptions,
  }
}

// POST /chat — nao streaming, usa prompt()
api.post("/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = body.prompt
  if (typeof text !== "string" || !text.trim()) {
    return c.json({ error: "prompt (string) required" }, 400)
  }
  const stderrBefore = stderrBuffer.length
  try {
    const result = await prompt(text, baseOptions(body.options))
    // Deteccao de "CLI morreu em silencio": prompt() retornou sem estourar,
    // mas nenhum result e nenhum resultMessage foram produzidos.
    if (result.result == null && result.resultMessage == null) {
      const newStderr = stderrBuffer.slice(stderrBefore)
      return c.json(
        {
          error: "empty response from SDK — CLI may have crashed before producing any message",
          stderr: newStderr.length > 0 ? newStderr : snapshotStderr(),
          raw: result,
        },
        500,
      )
    }
    return c.json(result)
  } catch (err) {
    return c.json(
      {
        error: String(err?.message ?? err),
        name: err?.name,
        stderr: stderrBuffer.slice(stderrBefore),
      },
      500,
    )
  }
})

// Helper: itera um Query/SSE, emite cada SDKMessage como event "message",
// detecta stream vazio (CLI morreu sem emitir nada) e emite event "error" com
// stderr capturado. No happy path emite event "done".
//
// Heartbeat: SDKPresenceMessage emitidos pelo SDK sao repassados como
// `event: ping` com data: { ts, seq, elapsedMs }. O SDK controla o intervalo
// (presenceIntervalMs, default 15s). Nao ha mais setInterval local aqui.
async function pipeQueryToSSE(stream, q) {
  const stderrBefore = stderrBuffer.length
  let messagesSeen = 0

  stream.onAbort(() => {
    q.close().catch(() => {})
  })

  try {
    for await (const msg of q) {
      if (msg.type === "presence") {
        await stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ ts: msg.ts, seq: msg.seq, elapsedMs: msg.elapsedMs }),
        })
        continue
      }
      messagesSeen++
      await stream.writeSSE({ event: "message", data: JSON.stringify(msg) })
    }
    if (messagesSeen === 0) {
      const newStderr = stderrBuffer.slice(stderrBefore)
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: "empty stream from SDK — CLI may have crashed before producing any message",
          stderr: newStderr.length > 0 ? newStderr : snapshotStderr(),
        }),
      })
      return
    }
    await stream.writeSSE({ event: "done", data: JSON.stringify({ messagesSeen }) })
  } catch (err) {
    await stream.writeSSE({
      event: "error",
      data: JSON.stringify({
        message: String(err?.message ?? err),
        name: err?.name,
        stderr: stderrBuffer.slice(stderrBefore),
      }),
    })
  }
}

// POST /chat/stream — SSE, usa query() puro
api.post("/chat/stream", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = body.prompt
  if (typeof text !== "string" || !text.trim()) {
    return c.json({ error: "prompt (string) required" }, 400)
  }

  return streamSSE(c, async (stream) => {
    const q = query({
      prompt: text,
      options: baseOptions(body.options),
    })
    await pipeQueryToSSE(stream, q)
  })
})

// ---- session v2 (stateful, live) -----------------------------------------

// POST /sessions — createSession
api.post("/sessions", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const session = createSession(baseOptions(body.options))
  liveSessions.set(session.sessionId, session)
  return c.json({ sessionId: session.sessionId })
})

// POST /sessions/:id/resume — resumeSession (reidrata uma sessao persistida em disco)
api.post("/sessions/:id/resume", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => ({}))
  if (liveSessions.has(id)) {
    await liveSessions.get(id).close().catch(() => {})
    liveSessions.delete(id)
  }
  const session = resumeSession(id, baseOptions(body.options))
  liveSessions.set(id, session)
  return c.json({ sessionId: id, resumed: true })
})

// POST /sessions/:id/prompt — stream SSE usando session.send()
api.post("/sessions/:id/prompt", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => ({}))
  const text = body.prompt
  if (typeof text !== "string" || !text.trim()) {
    return c.json({ error: "prompt (string) required" }, 400)
  }
  const session = liveSessions.get(id)
  if (!session) {
    return c.json({ error: `live session '${id}' not found. POST /sessions or /sessions/:id/resume first.` }, 404)
  }

  return streamSSE(c, async (stream) => {
    const q = session.send(text, body.turnOptions)
    await pipeQueryToSSE(stream, q)
  })
})

// DELETE /sessions/:id — fecha live + apaga transcript em disco
api.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id")
  const live = liveSessions.get(id)
  if (live) {
    await live.close().catch(() => {})
    liveSessions.delete(id)
  }
  try {
    await deleteSession(id)
  } catch (err) {
    return c.json({ closedLive: !!live, deleted: false, error: String(err?.message ?? err) })
  }
  return c.json({ closedLive: !!live, deleted: true })
})

// PATCH /sessions/:id — rename / tag
api.patch("/sessions/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => ({}))
  const actions = []
  if (typeof body.name === "string") {
    await renameSession(id, body.name)
    actions.push("rename")
  }
  if (Array.isArray(body.tags)) {
    await tagSession(id, body.tags)
    actions.push("tag")
  }
  if (actions.length === 0) {
    return c.json({ error: "provide 'name' (string) and/or 'tags' (string[])" }, 400)
  }
  return c.json({ ok: true, actions })
})

// GET /sessions — listSessions
api.get("/sessions", async (c) => {
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined
  const dir = c.req.query("dir") ?? undefined
  const sessions = await listSessions({ limit, dir })
  return c.json({
    live: Array.from(liveSessions.keys()),
    persisted: sessions,
  })
})

// GET /sessions/:id — getSessionInfo
api.get("/sessions/:id", async (c) => {
  const id = c.req.param("id")
  try {
    const info = await getSessionInfo(id)
    return c.json({ live: liveSessions.has(id), info })
  } catch (err) {
    return c.json({ live: liveSessions.has(id), info: null, error: String(err?.message ?? err) }, 404)
  }
})

// GET /sessions/:id/messages — getSessionMessages
api.get("/sessions/:id/messages", async (c) => {
  const id = c.req.param("id")
  try {
    const messages = await getSessionMessages(id)
    return c.json({ messages })
  } catch (err) {
    return c.json({ messages: [], error: String(err?.message ?? err) }, 404)
  }
})

app.route("/api/v1/ai", api)

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404))
app.onError((err, c) => {
  console.error("[onError]", err)
  return c.json({ error: String(err?.message ?? err), name: err?.name }, 500)
})

const port = 9500
const httpServer = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`openclaude-sdk demo listening on http://localhost:${info.port}/api/v1/ai`)
})

// Desabilita os timeouts do Node http.Server que matariam turnos longos:
//  - requestTimeout (default 300s em Node 18+): limite duro por request
//  - headersTimeout (default 60s): limite pra completar headers
//  - keepAliveTimeout (5s): nao mata requests em curso, ok manter
// Chat agentico pode rodar por horas; qualquer limite hardcoded quebra.
// O liveness real e garantido pelo heartbeat SSE em `pipeQueryToSSE`.
if (httpServer) {
  httpServer.requestTimeout = 0
  httpServer.headersTimeout = 0
}
