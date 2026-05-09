// ---------------------------------------------------------------------------
// session-persistent.ts — Sessao com subprocess unico vivo entre turnos
//
// Diferente de createSession() (V2), que re-spawna o CLI a cada send() com
// --resume, esta variante mantem UM subprocess openclaude vivo e empurra
// envelopes stream-json no stdin a cada turno. Resultado:
//
//   1° turno  →  paga cold start completo (~10s)
//   N°  turno →  apenas latencia do modelo (~2s)
//
// Trade-offs:
// - Requer permissionMode: "bypassPermissions" ou "dontAsk" (CLI fecha stdin
//   em outros modos quando o protocolo de permissoes pede resposta).
// - O CLI deve suportar --input-format stream-json (openclaude >= 0.3).
// - Cada turno termina ao receber message com type=="result"; o subprocess
//   continua vivo aguardando o proximo envelope.
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { resolveExecutable, buildCliArgs } from "./process.js"
import type { SDKMessage } from "./types/messages.js"
import type { Options } from "./types/options.js"

// ---------------------------------------------------------------------------
// TurnStream — stream de mensagens de UM turno na sessao persistente
// ---------------------------------------------------------------------------

export interface TurnStream extends AsyncIterable<SDKMessage> {
  /** Interrompe o turno atual (mata o turno mas mantem a sessao viva). */
  interrupt(): Promise<void>
  /** Fecha o iterator (a sessao continua viva). */
  stop(): void
}

// ---------------------------------------------------------------------------
// Comfort messages — frases default emitidas como `system/status` quando
// passa thresholdMs sem byte real do CLI. Override via opts.comfort.
// ---------------------------------------------------------------------------

export interface ComfortConfig {
  /** Frases pra cold start (subprocess recem-spawnado). */
  cold?: string[]
  /** Frases pra turnos quentes (subprocess ja idle). */
  warm?: string[]
  /** Tempo (ms) sem byte real antes de injetar a comfort. Default: 0 (imediato). */
  thresholdMs?: number
}

export const DEFAULT_COMFORT_PHRASES: Required<Pick<ComfortConfig, "cold" | "warm">> = {
  cold: [
    "Acordando…",
    "Carregando ferramentas…",
    "Conectando ao modelo…",
    "Preparando o ambiente…",
    "Inicializando…",
  ],
  warm: [
    "Pensando…",
    "Processando…",
    "Refletindo…",
    "Escolhendo as palavras…",
    "Calibrando a resposta…",
    "Considerando…",
  ],
}

function pickPhrase(arr: string[]): string {
  if (arr.length === 0) return "…"
  return arr[Math.floor(Math.random() * arr.length)]!
}

// ---------------------------------------------------------------------------
// PersistentSession
// ---------------------------------------------------------------------------

export interface PersistentSession {
  readonly sessionId: string
  /** ms desde o spawn (pra detectar cold/warm). */
  readonly spawnedAtMs: number
  /** Estado interno do subprocess. */
  readonly state: "warming" | "ready" | "in-use" | "dead"
  /** Envia um turno e devolve um stream das mensagens deste turno. */
  send(prompt: string, options?: { comfort?: ComfortConfig | false }): TurnStream
  /** Encerra o subprocess. */
  close(): Promise<void>
  /** Suporte a `await using`. */
  [Symbol.asyncDispose](): Promise<void>
}

export interface CreatePersistentSessionOptions extends Partial<Options> {
  /** Frases de comfort (ou false pra desligar globalmente nesta sessao). */
  comfort?: ComfortConfig | false
  /** Tempo (ms) ate considerar a sessao "pronta" apos spawn. Default: 8000. */
  warmupMs?: number
}

export function createPersistentSession(
  opts: CreatePersistentSessionOptions = {},
): PersistentSession {
  const {
    sessionId: providedSessionId,
    comfort: defaultComfort,
    warmupMs = 8_000,
    cwd,
    model,
    permissionMode,
    resume,
    pathToClaudeCodeExecutable,
    executable,
    executableArgs,
    env: extraEnv,
    ...rest
  } = opts

  const isResume = typeof resume === "string" && resume.length > 0
  const sessionId = isResume ? resume : (providedSessionId ?? randomUUID())

  // Persistent mode requer permissionMode que mantenha stdin aberto pra
  // controles, mas tambem requer que o CLI nao bloqueie esperando resposta
  // de permissao. bypassPermissions e dontAsk satisfazem ambos.
  const effectivePerm =
    permissionMode === "bypassPermissions" || permissionMode === "dontAsk"
      ? permissionMode
      : "bypassPermissions"

  // Build CLI args — usa buildCliArgs do process.ts (sem prompt, --input-format
  // stream-json eh adicionado manualmente).
  const baseOptions: Options = {
    ...rest,
    cwd,
    model,
    permissionMode: effectivePerm,
    pathToClaudeCodeExecutable,
    executable,
    executableArgs,
    ...(isResume ? { resume: sessionId } : { sessionId }),
  }

  const args = buildCliArgs(baseOptions)
  args.push("--input-format", "stream-json")

  const { command, prependArgs } = resolveExecutable(baseOptions)

  const childEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") childEnv[k] = v
  }
  if (extraEnv) {
    for (const [k, v] of Object.entries(extraEnv)) {
      if (typeof v === "string") childEnv[k] = v
    }
  }

  const finalArgs = [...prependArgs, ...args]
  const proc: ChildProcess = spawn(command, finalArgs, {
    cwd: cwd ?? process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: childEnv,
  })

  const spawnedAtMs = Date.now()
  let state: "warming" | "ready" | "in-use" | "dead" = "warming"
  setTimeout(() => {
    if (state === "warming") state = "ready"
  }, warmupMs).unref?.()

  proc.once("exit", () => {
    state = "dead"
    flushTerminate("exit")
  })
  proc.once("error", () => {
    state = "dead"
    flushTerminate("error")
  })

  // ─── Stdout demux ─────────────────────────────────────────────────────
  // Cada turno tem seu proprio buffer de waiters/queue. Quando um turno termina
  // (recebe `result`), drainamos seu queue e libera-mos pro proximo turno.

  interface TurnState {
    queue: SDKMessage[]
    waiters: Array<(msg: SDKMessage | null) => void>
    realByteSeen: boolean
    comfortTimer: NodeJS.Timeout | null
    comfortInjected: boolean
    done: boolean
  }
  let currentTurn: TurnState | null = null

  const stdoutChunks: string[] = []
  let stdoutBuf = ""
  proc.stdout?.setEncoding("utf8")
  proc.stdout?.on("data", (chunk: string) => {
    stdoutBuf += chunk
    let idx
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx).trim()
      stdoutBuf = stdoutBuf.slice(idx + 1)
      if (!line) continue
      let msg: SDKMessage
      try {
        msg = JSON.parse(line) as SDKMessage
      } catch {
        continue
      }
      onMessage(msg)
    }
  })

  proc.stderr?.setEncoding("utf8")
  proc.stderr?.on("data", (s: string) => {
    if (process.env.OPENCLAUDE_DEBUG_PERSISTENT) {
      console.error("[persistent stderr]", s.slice(0, 200))
    }
  })

  function onMessage(msg: SDKMessage): void {
    stdoutChunks.push(msg.type)
    if (!currentTurn) return

    // Primeira mensagem real do turno cancela o comfort.
    if (!currentTurn.realByteSeen && msg.type !== "presence") {
      currentTurn.realByteSeen = true
      if (currentTurn.comfortTimer) {
        clearTimeout(currentTurn.comfortTimer)
        currentTurn.comfortTimer = null
      }
    }

    deliver(msg)

    // result fecha o turno mas nao a sessao.
    if (msg.type === "result") {
      const t = currentTurn
      currentTurn = null
      t.done = true
      // libera quem esta aguardando — null = fim do turno.
      while (t.waiters.length > 0) t.waiters.shift()!(null)
    }
  }

  function deliver(msg: SDKMessage): void {
    if (!currentTurn) return
    if (currentTurn.waiters.length > 0) {
      currentTurn.waiters.shift()!(msg)
    } else {
      currentTurn.queue.push(msg)
    }
  }

  function flushTerminate(_reason: string): void {
    if (currentTurn) {
      const t = currentTurn
      currentTurn = null
      t.done = true
      while (t.waiters.length > 0) t.waiters.shift()!(null)
    }
  }

  // ─── send ─────────────────────────────────────────────────────────────

  function send(
    promptText: string,
    sendOpts?: { comfort?: ComfortConfig | false },
  ): TurnStream {
    if (state === "dead") throw new Error("persistent session is dead")
    if (currentTurn) throw new Error("persistent session: previous turn not finished")
    // Snapshot pra detectar cold ANTES de mudar state.
    const wasWarming = state === "warming"
    state = "in-use"

    const turn: TurnState = {
      queue: [],
      waiters: [],
      realByteSeen: false,
      comfortTimer: null,
      comfortInjected: false,
      done: false,
    }
    currentTurn = turn

    // Comfort: se nao desligado, agenda emissao (ou imediato se thresholdMs=0)
    const comfortCfg =
      sendOpts?.comfort === false
        ? false
        : sendOpts?.comfort ?? defaultComfort ?? {}
    if (comfortCfg !== false) {
      const cold = comfortCfg.cold ?? DEFAULT_COMFORT_PHRASES.cold
      const warm = comfortCfg.warm ?? DEFAULT_COMFORT_PHRASES.warm
      const thresholdMs = comfortCfg.thresholdMs ?? 0
      const isCold = wasWarming || Date.now() - spawnedAtMs < 4_000
      const phrase = pickPhrase(isCold ? cold : warm)
      const inject = (): void => {
        if (turn.realByteSeen || turn.done || turn.comfortInjected) return
        turn.comfortInjected = true
        deliver({
          type: "system",
          subtype: "status",
          status: phrase,
          session_id: sessionId,
          uuid: randomUUID(),
        } as unknown as SDKMessage)
      }
      if (thresholdMs <= 0) inject()
      else {
        turn.comfortTimer = setTimeout(inject, thresholdMs)
        turn.comfortTimer.unref?.()
      }
    }

    // Envelope stream-json no stdin
    const envelope = JSON.stringify({
      type: "user",
      message: { role: "user", content: promptText },
    })
    try {
      proc.stdin?.write(envelope + "\n")
    } catch (err) {
      // Falha de write — encerra turno com erro.
      currentTurn = null
      throw err
    }

    return makeTurnStream(turn)
  }

  function makeTurnStream(turn: TurnState): TurnStream {
    let stopped = false
    const next = (): Promise<SDKMessage | null> => {
      if (stopped || turn.done) {
        if (turn.queue.length > 0) return Promise.resolve(turn.queue.shift()!)
        return Promise.resolve(null)
      }
      if (turn.queue.length > 0) return Promise.resolve(turn.queue.shift()!)
      return new Promise((resolve) => turn.waiters.push(resolve))
    }
    const iterator: AsyncIterator<SDKMessage> = {
      async next() {
        const msg = await next()
        if (msg === null) {
          if (state !== "dead") state = "ready"
          return { value: undefined as unknown as SDKMessage, done: true }
        }
        return { value: msg, done: false }
      },
      async return(value) {
        stopped = true
        if (state !== "dead") state = "ready"
        return { value: value as SDKMessage, done: true }
      },
    }
    return {
      [Symbol.asyncIterator]: () => iterator,
      async interrupt(): Promise<void> {
        // Envia control_request de interrupt (mesmo formato do CLI)
        try {
          const ctrl = JSON.stringify({
            type: "control_request",
            request_id: randomUUID(),
            request: { subtype: "interrupt" },
          })
          proc.stdin?.write(ctrl + "\n")
        } catch {
          /* ignore */
        }
      },
      stop() {
        stopped = true
        if (state !== "dead") state = "ready"
      },
    }
  }

  async function close(): Promise<void> {
    if (state === "dead") return
    state = "dead"
    flushTerminate("close")
    return new Promise<void>((resolve) => {
      if (proc.exitCode !== null) {
        resolve()
        return
      }
      proc.once("exit", () => resolve())
      try {
        proc.stdin?.end()
      } catch {
        /* ignore */
      }
      const t1 = setTimeout(() => {
        if (proc.exitCode === null) proc.kill("SIGTERM")
      }, 500)
      const t2 = setTimeout(() => {
        if (proc.exitCode === null) proc.kill("SIGKILL")
      }, 3_000)
      t1.unref?.()
      t2.unref?.()
    })
  }

  return {
    sessionId,
    spawnedAtMs,
    get state() {
      return state
    },
    send,
    close,
    async [Symbol.asyncDispose]() {
      await close()
    },
  }
}
