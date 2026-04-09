// ---------------------------------------------------------------------------
// query() — interface principal, espelha @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

import type { SDKMessage, SDKSystemMessage } from "./types/messages.js"
import type { Options, PermissionResponse } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"
import { buildCliArgs, resolveExecutable, spawnAndStream } from "./process.js"
import { resolveModelEnv } from "./registry.js"
import {
  AuthenticationError,
  BillingError,
  RateLimitError,
  InvalidRequestError,
  ServerError,
  MaxTurnsError,
  MaxBudgetError,
  ExecutionError,
  StructuredOutputError,
} from "./errors.js"

// ---------------------------------------------------------------------------
// Query object — AsyncGenerator com metodos extras
// ---------------------------------------------------------------------------

export interface Query extends AsyncGenerator<SDKMessage, void> {
  /** Interrompe a query */
  interrupt(): Promise<void>
  /** Fecha a query e mata o processo */
  close(): void
  /** Responde a uma solicitacao de permissao de ferramenta */
  respondToPermission(response: PermissionResponse): void
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
  let resolvedOptions = options
  if (registry && model) {
    const envFromRegistry = resolveModelEnv(registry, model)
    resolvedOptions = { ...options, env: { ...options.env, ...envFromRegistry } }
  }

  const { command, prependArgs } = resolveExecutable(resolvedOptions)
  const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
  const abortController = resolvedOptions.abortController ?? new AbortController()

  const { stream, writeStdin } = spawnAndStream(command, args, prompt, {
    cwd: resolvedOptions.cwd,
    env: resolvedOptions.env,
    signal: abortController.signal,
    permissionMode: resolvedOptions.permissionMode,
  })

  // Decorar o stream com metodos extras da interface Query
  const query: Query = Object.assign(stream, {
    _writeStdin: writeStdin,
    async interrupt(): Promise<void> {
      abortController.abort()
    },
    close(): void {
      abortController.abort()
    },
    respondToPermission(response: PermissionResponse): void {
      if (!response.toolUseId) {
        throw new Error("respondToPermission: toolUseId must not be empty")
      }
      if (response.behavior !== "allow" && response.behavior !== "deny") {
        throw new Error(
          `respondToPermission: behavior must be 'allow' or 'deny', got '${response.behavior}'`,
        )
      }
      const payload = JSON.stringify({
        tool_use_id: response.toolUseId,
        behavior: response.behavior,
        message: response.message,
      })
      writeStdin(payload + "\n")
    },
  })

  return query
}

// ---------------------------------------------------------------------------
// continueSession() — resume uma sessao existente
// ---------------------------------------------------------------------------

export function continueSession(params: {
  sessionId: string
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query {
  const { sessionId, prompt, model, registry, options } = params
  // resume always set to sessionId; user options merged but resume overridden
  const mergedOptions: Options = { ...options, resume: sessionId }
  return query({ prompt, model, registry, options: mergedOptions })
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
      sessionId = msg.session_id ?? sessionId
      costUsd = msg.total_cost_usd ?? costUsd
      durationMs = msg.duration_ms ?? durationMs

      if (msg.subtype === "success") {
        result = msg.result ?? null
      } else {
        const subtype: string = msg.subtype
        const errMsg = msg.errors?.join(", ") ?? subtype
        const errParams = { message: errMsg, sessionId, costUsd, durationMs }
        switch (msg.subtype) {
          case "error_max_turns":
            throw new MaxTurnsError(errParams)
          case "error_max_budget_usd":
            throw new MaxBudgetError(errParams)
          case "error_during_execution":
            throw new ExecutionError(errParams)
          case "error_max_structured_output_retries":
            throw new StructuredOutputError(errParams)
          default:
            throw new ExecutionError({ ...errParams, message: `Unknown result subtype: ${subtype}` })
        }
      }
    }

    if (msg.type === "assistant" && msg.error) {
      const errParams = { message: msg.error, sessionId, costUsd, durationMs }
      const errType: string = msg.error
      switch (msg.error) {
        case "authentication_failed":
          throw new AuthenticationError(errParams)
        case "billing_error":
          throw new BillingError(errParams)
        case "rate_limit":
          throw new RateLimitError(errParams)
        case "invalid_request":
          throw new InvalidRequestError(errParams)
        case "server_error":
          throw new ServerError(errParams)
        default:
          throw new ServerError({ ...errParams, message: `Unknown assistant error: ${errType}` })
      }
    }
  }

  return { messages, sessionId, result, costUsd, durationMs }
}
