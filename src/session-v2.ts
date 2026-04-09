// ---------------------------------------------------------------------------
// session-v2.ts — V2 Session API (stateful, multi-turn)
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto"
import { query, collectMessages } from "./query.js"
import type { Query } from "./query.js"
import type { SDKMessage } from "./types/messages.js"
import type { Options } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"

// ---------------------------------------------------------------------------
// SDKSession interface
// ---------------------------------------------------------------------------

export interface SDKSession {
  /** ID da sessao (gerado ou fornecido) */
  readonly sessionId: string
  /** Envia mensagem e inicia query — retorna stream de mensagens */
  send(prompt: string, options?: Partial<Options>): Query
  /** Conveniencia: envia mensagem e coleta resultado completo */
  collect(prompt: string, options?: Partial<Options>): Promise<{
    messages: SDKMessage[]
    result: string | null
    costUsd: number
    durationMs: number
  }>
  /** Fecha a sessao e mata qualquer query ativa */
  close(): Promise<void>
  /** Suporte a 'await using' (AsyncDisposable) */
  [Symbol.asyncDispose](): Promise<void>
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

export interface CreateSessionOptions extends Partial<Options> {
  registry?: ProviderRegistry
}

export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const { model, registry, sessionId: providedSessionId, ...options } = opts
  const sessionId = providedSessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      // Strip session-control fields to prevent conflicts with internal management
      const { resume: _r, continue: _c, ...safeBaseOptions } = options
      const { resume: _r2, sessionId: _s2, continue: _c2, ...safeTurnOptions } = turnOptions ?? {}

      const mergedOptions: Options = {
        ...safeBaseOptions,
        ...safeTurnOptions,
      }

      if (isFirstTurn) {
        activeQuery = query({
          prompt,
          model,
          registry,
          options: { ...mergedOptions, sessionId },
        })
        isFirstTurn = false
      } else {
        activeQuery = query({
          prompt,
          model,
          registry,
          options: { ...mergedOptions, resume: sessionId },
        })
      }

      return activeQuery
    },

    async collect(prompt: string, turnOptions?: Partial<Options>) {
      const q = this.send(prompt, turnOptions)
      const result = await collectMessages(q)
      return {
        messages: result.messages,
        result: result.result,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      }
    },

    async close() {
      if (activeQuery) {
        await activeQuery.close()
        activeQuery = null
      }
    },

    async [Symbol.asyncDispose]() {
      await this.close()
    },
  }
}

// ---------------------------------------------------------------------------
// resumeSession
// ---------------------------------------------------------------------------

export interface ResumeSessionOptions extends Partial<Options> {
  registry?: ProviderRegistry
}

export function resumeSession(
  sessionId: string,
  opts: ResumeSessionOptions = {},
): SDKSession {
  const { model, registry, ...options } = opts
  let activeQuery: Query | null = null

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      // Strip session-control fields to prevent conflicts with internal management
      const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = options
      const { resume: _r2, sessionId: _s2, continue: _c2, ...safeTurnOptions } = turnOptions ?? {}

      const mergedOptions: Options = {
        ...safeBaseOptions,
        ...safeTurnOptions,
        resume: sessionId,
      }

      activeQuery = query({
        prompt,
        model,
        registry,
        options: mergedOptions,
      })

      return activeQuery
    },

    async collect(prompt: string, turnOptions?: Partial<Options>) {
      const q = this.send(prompt, turnOptions)
      const result = await collectMessages(q)
      return {
        messages: result.messages,
        result: result.result,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      }
    },

    async close() {
      if (activeQuery) {
        await activeQuery.close()
        activeQuery = null
      }
    },

    async [Symbol.asyncDispose]() {
      await this.close()
    },
  }
}

// ---------------------------------------------------------------------------
// prompt() — one-shot convenience
// ---------------------------------------------------------------------------

export interface PromptOptions extends Partial<Options> {
  registry?: ProviderRegistry
}

export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}> {
  const { model, registry, ...options } = opts
  const q = query({
    prompt: text,
    model,
    registry,
    options,
  })
  return collectMessages(q)
}
