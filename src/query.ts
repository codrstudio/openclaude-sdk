// ---------------------------------------------------------------------------
// query() — interface principal, espelha @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

import type { SDKMessage, SDKSystemMessage } from "./types/messages.js"
import type { Options, PermissionResponse } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"
import type {
  AccountInfo,
  AgentInfo,
  McpServerStatus,
  ModelInfo,
  SDKControlInitializeResponse,
  SlashCommand,
} from "./types/control.js"
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
  /** Retorna o payload de inicializacao em cache */
  initializationResult(): Promise<SDKControlInitializeResponse>
  /** Lista slash commands suportados */
  supportedCommands(): Promise<SlashCommand[]>
  /** Lista modelos suportados */
  supportedModels(): Promise<ModelInfo[]>
  /** Lista agentes suportados */
  supportedAgents(): Promise<AgentInfo[]>
  /** Retorna informacoes da conta */
  accountInfo(): Promise<AccountInfo>
  /** Retorna o status atual dos servidores MCP */
  mcpServerStatus(): Promise<McpServerStatus[]>
  /** Responde a uma solicitacao de permissao de ferramenta */
  respondToPermission(response: PermissionResponse): void
}

function createAsyncQueue<T>(): {
  push: (value: T) => void
  close: () => void
  fail: (error: unknown) => void
  stream: () => AsyncGenerator<T>
} {
  const values: T[] = []
  const waiters: Array<{
    resolve: (result: IteratorResult<T>) => void
    reject: (reason: unknown) => void
  }> = []
  let closed = false
  let failed: unknown = null

  return {
    push(value: T) {
      if (closed || failed !== null) return
      const waiter = waiters.shift()
      if (waiter) {
        waiter.resolve({ value, done: false })
        return
      }
      values.push(value)
    },
    close() {
      if (closed || failed !== null) return
      closed = true
      while (waiters.length > 0) {
        const waiter = waiters.shift()
        waiter?.resolve({ value: undefined, done: true })
      }
    },
    fail(error: unknown) {
      if (closed || failed !== null) return
      failed = error
      while (waiters.length > 0) {
        const waiter = waiters.shift()
        waiter?.reject(error)
      }
    },
    async *stream(): AsyncGenerator<T> {
      while (true) {
        if (values.length > 0) {
          yield values.shift() as T
          continue
        }
        if (failed !== null) {
          throw failed
        }
        if (closed) {
          return
        }
        const result = await new Promise<IteratorResult<T>>((resolve, reject) => {
          waiters.push({ resolve, reject })
        })
        if (result.done) {
          if (failed !== null) {
            throw failed
          }
          return
        }
        yield result.value
      }
    },
  }
}

function normalizeInitializationMessage(msg: SDKMessage): SDKControlInitializeResponse | null {
  if (msg.type !== "system" || !("subtype" in msg) || msg.subtype !== "init") {
    return null
  }

  const init = msg as SDKSystemMessage & {
    commands?: SlashCommand[]
    models?: ModelInfo[]
    agents?: AgentInfo[] | string[]
    account?: AccountInfo
    available_output_styles?: string[]
  }

  const commands = Array.isArray(init.commands)
    ? init.commands
    : Array.isArray(init.slash_commands)
      ? init.slash_commands.map((name) => ({ name }))
      : null
  const models = Array.isArray(init.models) ? init.models : null
  const agents = Array.isArray(init.agents)
    ? init.agents.map((agent) =>
        typeof agent === "string" ? { name: agent, description: "" } : agent,
      )
    : null
  const account =
    init.account && typeof init.account === "object" ? init.account : null
  const availableOutputStyles = Array.isArray(init.available_output_styles)
    ? init.available_output_styles
    : [init.output_style]

  if (!commands || !models || !agents || !account) {
    return null
  }

  return {
    commands,
    agents,
    output_style: init.output_style,
    available_output_styles: availableOutputStyles,
    models,
    account,
  }
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

  // Propagar env de MCP stdio servers
  if (resolvedOptions.mcpServers) {
    const mcpEnv: Record<string, string> = {}
    for (const config of Object.values(resolvedOptions.mcpServers)) {
      if ((!config.type || config.type === "stdio") && "env" in config && config.env) {
        Object.assign(mcpEnv, config.env)
      }
    }
    if (Object.keys(mcpEnv).length > 0) {
      resolvedOptions = {
        ...resolvedOptions,
        env: { ...resolvedOptions.env, ...mcpEnv },
      }
    }
  }

  const { command, prependArgs } = resolveExecutable(resolvedOptions)
  const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
  const abortController = resolvedOptions.abortController ?? new AbortController()

  const { stream, controlResponses, writeStdin, close: closeProcess } = spawnAndStream(
    command,
    args,
    prompt,
    {
      cwd: resolvedOptions.cwd,
      env: resolvedOptions.env,
      signal: abortController.signal,
      permissionMode: resolvedOptions.permissionMode,
      timeoutMs: resolvedOptions.timeoutMs,
    },
  )

  const messageQueue = createAsyncQueue<SDKMessage>()
  let initCache: SDKControlInitializeResponse | null = null
  let initSettled = false
  let resolveInit: ((value: SDKControlInitializeResponse) => void) | null = null
  let rejectInit: ((error: unknown) => void) | null = null
  let controlRequestCounter = 0
  type PendingControlRequest = {
    subtype: string
    resolve: (value: unknown) => void
    reject: (error: unknown) => void
  }
  const pendingControlRequests = new Map<string, PendingControlRequest>()

  const initPromise = new Promise<SDKControlInitializeResponse>((resolve, reject) => {
    resolveInit = resolve
    rejectInit = reject
  })

  const settleInit = (value: SDKControlInitializeResponse): void => {
    if (initSettled) return
    initSettled = true
    initCache = value
    resolveInit?.(value)
  }

  const failInit = (error: unknown): void => {
    if (initSettled) return
    initSettled = true
    rejectInit?.(error)
  }

  const rejectPendingControlRequests = (error: unknown): void => {
    if (pendingControlRequests.size === 0) return
    for (const pending of pendingControlRequests.values()) {
      pending.reject(error)
    }
    pendingControlRequests.clear()
  }

  const nextControlRequestId = (): string => {
    controlRequestCounter += 1
    return `sdk-${controlRequestCounter}`
  }

  void (async () => {
    try {
      for await (const message of controlResponses) {
        const response = message.response
        if (!response || typeof response !== "object") {
          continue
        }

        const requestId = typeof response.request_id === "string" ? response.request_id : null
        if (!requestId) {
          continue
        }

        const pending = pendingControlRequests.get(requestId)
        if (!pending) {
          continue
        }

        pendingControlRequests.delete(requestId)

        if (pending.subtype === "mcp_status") {
          const payload = response.response
          const mcpServers =
            payload &&
            typeof payload === "object" &&
            Array.isArray((payload as { mcpServers?: unknown }).mcpServers)
              ? (payload as { mcpServers: McpServerStatus[] }).mcpServers
              : []
          pending.resolve(mcpServers)
          continue
        }

        pending.resolve(response.response)
      }
    } catch (error) {
      rejectPendingControlRequests(error)
    }
  })()

  void (async () => {
    try {
      for await (const msg of stream) {
        const init = normalizeInitializationMessage(msg)
        if (init) {
          settleInit(init)
        }
        messageQueue.push(msg)
      }
      failInit(new Error("initializationResult: init message was not received"))
      rejectPendingControlRequests(new Error("Query process exited before control response was received"))
      messageQueue.close()
    } catch (error) {
      failInit(error)
      rejectPendingControlRequests(error)
      messageQueue.fail(error)
    }
  })()

  // Decorar o stream com metodos extras da interface Query
  const query: Query = Object.assign(messageQueue.stream(), {
    _writeStdin: writeStdin,
    async interrupt(): Promise<void> {
      abortController.abort()
    },
    close(): void {
      closeProcess()
    },
    async initializationResult(): Promise<SDKControlInitializeResponse> {
      if (initCache) {
        return initCache
      }
      return initPromise
    },
    async supportedCommands(): Promise<SlashCommand[]> {
      return (await this.initializationResult()).commands
    },
    async supportedModels(): Promise<ModelInfo[]> {
      return (await this.initializationResult()).models
    },
    async supportedAgents(): Promise<AgentInfo[]> {
      return (await this.initializationResult()).agents
    },
    async accountInfo(): Promise<AccountInfo> {
      return (await this.initializationResult()).account
    },
    async mcpServerStatus(): Promise<McpServerStatus[]> {
      const requestId = nextControlRequestId()

      return new Promise<McpServerStatus[]>((resolve, reject) => {
        pendingControlRequests.set(requestId, {
          subtype: "mcp_status",
          resolve: (value) => resolve(value as McpServerStatus[]),
          reject,
        })

        try {
          writeStdin(
            JSON.stringify({
              type: "control_request",
              subtype: "mcp_status",
              request_id: requestId,
            }) + "\n",
          )
        } catch (error) {
          pendingControlRequests.delete(requestId)
          reject(error)
        }
      })
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
