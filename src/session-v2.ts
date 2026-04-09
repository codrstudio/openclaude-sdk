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

export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}

export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const sessionId = opts.sessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      const mergedOptions: Options = {
        ...opts.options,
        ...turnOptions,
      }

      if (isFirstTurn) {
        activeQuery = query({
          prompt,
          model: opts.model,
          registry: opts.registry,
          options: { ...mergedOptions, sessionId },
        })
        isFirstTurn = false
      } else {
        activeQuery = query({
          prompt,
          model: opts.model,
          registry: opts.registry,
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

export interface ResumeSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}

export function resumeSession(
  sessionId: string,
  opts: ResumeSessionOptions = {},
): SDKSession {
  let activeQuery: Query | null = null

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      const mergedOptions: Options = {
        ...opts.options,
        ...turnOptions,
        resume: sessionId,
      }

      activeQuery = query({
        prompt,
        model: opts.model,
        registry: opts.registry,
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

export interface PromptOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
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
  const q = query({
    prompt: text,
    model: opts.model,
    registry: opts.registry,
    options: opts.options,
  })
  return collectMessages(q)
}
