// ---------------------------------------------------------------------------
// query() — interface principal, espelha @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

import type { SDKMessage, SDKSystemMessage } from "./types/messages.js"
import type { Options } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"
import { buildCliArgs, spawnAndStream } from "./process.js"
import { resolveModelEnv } from "./registry.js"

// ---------------------------------------------------------------------------
// Query object — AsyncGenerator com metodos extras
// ---------------------------------------------------------------------------

export interface Query extends AsyncGenerator<SDKMessage, void> {
  /** Interrompe a query */
  interrupt(): Promise<void>
  /** Fecha a query e mata o processo */
  close(): void
}

// ---------------------------------------------------------------------------
// query() function
// ---------------------------------------------------------------------------

export function query(params: {
  prompt: string
  model?: string // Model.id — resolved via registry
  registry?: ProviderRegistry // if provided, generates env vars automatically
  options?: Options // existing Options from sdk-2
}): Query {
  const { prompt, model, registry, options = {} } = params

  // Quando registry + model sao fornecidos, gerar env vars automaticamente
  if (registry && model) {
    const envFromRegistry = resolveModelEnv(registry, model)
    options.env = { ...options.env, ...envFromRegistry }
  }

  const command =
    options.pathToClaudeCodeExecutable || "openclaude"
  const args = buildCliArgs(options)
  const abortController = options.abortController ?? new AbortController()

  const generator = spawnAndStream(command, args, prompt, {
    cwd: options.cwd,
    env: options.env as Record<string, string>,
    signal: abortController.signal,
  })

  // Decorar o generator com metodos extras da interface Query
  const query: Query = Object.assign(generator, {
    async interrupt(): Promise<void> {
      abortController.abort()
    },
    close(): void {
      abortController.abort()
    },
  })

  return query
}

// ---------------------------------------------------------------------------
// Helpers de conveniencia
// ---------------------------------------------------------------------------

/**
 * Coleta todas as mensagens de uma query e retorna o resultado.
 * Equivale a consumir o async generator inteiro.
 */
export async function collectMessages(
  q: Query,
): Promise<{
  messages: SDKMessage[]
  sessionId: string | null
  result: string | null
  costUsd: number
  durationMs: number
}> {
  const messages: SDKMessage[] = []
  let sessionId: string | null = null
  let result: string | null = null
  let costUsd = 0
  let durationMs = 0

  for await (const msg of q) {
    messages.push(msg)

    if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
      sessionId = (msg as SDKSystemMessage).session_id
    }

    if (msg.type === "result") {
      const r = msg as {
        session_id?: string
        result?: string
        total_cost_usd?: number
        duration_ms?: number
      }
      sessionId = r.session_id ?? sessionId
      result = r.result ?? null
      costUsd = r.total_cost_usd ?? costUsd
      durationMs = r.duration_ms ?? durationMs
    }
  }

  return { messages, sessionId, result, costUsd, durationMs }
}
