// ---------------------------------------------------------------------------
// query() — interface principal, espelha @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

import type { SDKMessage, SDKSystemMessage, PermissionMode } from "./types/messages.js"
import type { Options, PermissionResponse, McpServerConfig } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"
import type {
  SlashCommand,
  ModelInfo,
  AgentInfo,
  McpServerStatusInfo,
  AccountInfo,
  InitializationResult,
  RewindFilesResult,
  McpSetServersResult,
} from "./types/query.js"
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
  close(): Promise<void>
  /** Responde a uma solicitacao de permissao de ferramenta */
  respondToPermission(response: PermissionResponse): void
  /** Define o modelo a usar (fire-and-forget) */
  setModel(model?: string): void
  /** Define o modo de permissao (fire-and-forget) */
  setPermissionMode(mode: PermissionMode): void
  /** Define o numero maximo de tokens de thinking (fire-and-forget) */
  setMaxThinkingTokens(tokens: number | null): void
  /** Resultado da inicializacao (tools, agents, MCP) */
  initializationResult(): Promise<InitializationResult>
  /** Slash commands disponiveis */
  supportedCommands(): Promise<SlashCommand[]>
  /** Modelos disponiveis */
  supportedModels(): Promise<ModelInfo[]>
  /** Agentes configurados */
  supportedAgents(): Promise<AgentInfo[]>
  /** Status dos MCP servers */
  mcpServerStatus(): Promise<McpServerStatusInfo[]>
  /** Info da conta */
  accountInfo(): Promise<AccountInfo>
  /** Reconecta um MCP server */
  reconnectMcpServer(serverName: string): void
  /** Habilita/desabilita um MCP server */
  toggleMcpServer(serverName: string, enabled: boolean): void
  /** Para uma task especifica */
  stopTask(taskId: string): void
  /** Reverte arquivos alterados pelo agente a um ponto anterior */
  rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult>
  /** Reconfigura MCP servers mid-session */
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>
  /** Envia um stream de texto chunk a chunk via stdin, bloqueante ate consumir iterable inteiro */
  streamInput(stream: AsyncIterable<string>): Promise<void>
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

  const { stream, writeStdin, close: closeProc } = spawnAndStream(command, args, prompt, {
    cwd: resolvedOptions.cwd,
    env: resolvedOptions.env,
    signal: abortController.signal,
    permissionMode: resolvedOptions.permissionMode,
    timeoutMs: resolvedOptions.timeoutMs,
  })

  // ---------------------------------------------------------------------------
  // Infraestrutura de request/response (F-054)
  // ---------------------------------------------------------------------------

  const pendingRequests = new Map<string, {
    resolve: (data: unknown) => void
    reject: (error: Error) => void
  }>()

  let requestCounter = 0
  function nextRequestId(): string {
    return `req_${++requestCounter}_${Date.now()}`
  }

  function sendControlRequest<T>(commandType: string): Promise<T> {
    const requestId = nextRequestId()
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId)
        reject(new Error(`Control request '${commandType}' timed out after 10s`))
      }, 10_000)

      pendingRequests.set(requestId, {
        resolve: (data) => {
          clearTimeout(timeout)
          resolve(data as T)
        },
        reject: (err) => {
          clearTimeout(timeout)
          reject(err)
        },
      })

      writeStdin(JSON.stringify({ type: commandType, requestId }) + "\n")
    })
  }

  async function* wrapStream(
    source: AsyncGenerator<SDKMessage>,
    pending: Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void }>,
  ): AsyncGenerator<SDKMessage, void> {
    for await (const msg of source) {
      const obj = msg as Record<string, unknown>
      if (obj["type"] === "control_response" && typeof obj["responseId"] === "string") {
        const entry = pending.get(obj["responseId"])
        if (entry) {
          pending.delete(obj["responseId"])
          entry.resolve(obj["data"])
        }
        continue
      }
      yield msg
    }
  }

  const wrappedStream = wrapStream(stream, pendingRequests)

  // Decorar o stream com metodos extras da interface Query
  const query: Query = Object.assign(wrappedStream, {
    _writeStdin: writeStdin,
    async interrupt(): Promise<void> {
      abortController.abort()
    },
    async close(): Promise<void> {
      await closeProc()
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
    setModel(model?: string): void {
      writeStdin(JSON.stringify({ type: "set_model", model: model ?? null }) + "\n")
    },
    setPermissionMode(mode: PermissionMode): void {
      writeStdin(JSON.stringify({ type: "set_permission_mode", permissionMode: mode }) + "\n")
    },
    setMaxThinkingTokens(tokens: number | null): void {
      writeStdin(JSON.stringify({ type: "set_max_thinking_tokens", maxThinkingTokens: tokens }) + "\n")
    },
    initializationResult(): Promise<InitializationResult> {
      return sendControlRequest("get_initialization_result")
    },
    supportedCommands(): Promise<SlashCommand[]> {
      return sendControlRequest("get_supported_commands")
    },
    supportedModels(): Promise<ModelInfo[]> {
      return sendControlRequest("get_supported_models")
    },
    supportedAgents(): Promise<AgentInfo[]> {
      return sendControlRequest("get_supported_agents")
    },
    mcpServerStatus(): Promise<McpServerStatusInfo[]> {
      return sendControlRequest("get_mcp_server_status")
    },
    accountInfo(): Promise<AccountInfo> {
      return sendControlRequest("get_account_info")
    },
    reconnectMcpServer(serverName: string): void {
      writeStdin(JSON.stringify({ type: "reconnect_mcp_server", serverName }) + "\n")
    },
    toggleMcpServer(serverName: string, enabled: boolean): void {
      writeStdin(JSON.stringify({ type: "toggle_mcp_server", serverName, enabled }) + "\n")
    },
    stopTask(taskId: string): void {
      writeStdin(JSON.stringify({ type: "stop_task", taskId }) + "\n")
    },
    rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult> {
      const requestId = nextRequestId()
      return new Promise<RewindFilesResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId)
          reject(new Error("rewindFiles timed out after 30s"))
        }, 30_000)

        pendingRequests.set(requestId, {
          resolve: (data) => { clearTimeout(timeout); resolve(data as RewindFilesResult) },
          reject: (err) => { clearTimeout(timeout); reject(err) },
        })

        writeStdin(JSON.stringify({
          type: "rewind_files",
          requestId,
          userMessageId,
          dryRun: opts?.dryRun ?? false,
        }) + "\n")
      })
    },
    setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult> {
      const requestId = nextRequestId()
      return new Promise<McpSetServersResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId)
          reject(new Error("setMcpServers timed out after 30s"))
        }, 30_000)

        pendingRequests.set(requestId, {
          resolve: (data) => { clearTimeout(timeout); resolve(data as McpSetServersResult) },
          reject: (err) => { clearTimeout(timeout); reject(err) },
        })

        writeStdin(JSON.stringify({
          type: "set_mcp_servers",
          requestId,
          servers,
        }) + "\n")
      })
    },
    async streamInput(stream: AsyncIterable<string>): Promise<void> {
      for await (const chunk of stream) {
        writeStdin(JSON.stringify({ type: "stream_input", content: chunk }) + "\n")
      }
      writeStdin(JSON.stringify({ type: "stream_input_end" }) + "\n")
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
