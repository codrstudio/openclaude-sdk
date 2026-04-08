// ---------------------------------------------------------------------------
// Tipos de mensagem da SDK — espelham @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

export type UUID = string

// ---------------------------------------------------------------------------
// Content blocks (do Anthropic SDK)
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: "text"
  text: string
}

export interface ToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: "tool_result"
  tool_use_id: string
  content: string | unknown
  is_error?: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock

// ---------------------------------------------------------------------------
// SDKAssistantMessage
// ---------------------------------------------------------------------------

export type SDKAssistantMessageError =
  | "authentication_failed"
  | "billing_error"
  | "rate_limit"
  | "invalid_request"
  | "server_error"
  | "max_output_tokens"
  | "unknown"

export interface SDKAssistantMessage {
  type: "assistant"
  uuid: UUID
  session_id: string
  message: {
    id: string
    content: ContentBlock[]
    model?: string
    stop_reason?: string | null
    usage?: {
      input_tokens: number
      output_tokens: number
    }
  }
  parent_tool_use_id: string | null
  error?: SDKAssistantMessageError
}

// ---------------------------------------------------------------------------
// SDKUserMessage
// ---------------------------------------------------------------------------

export interface SDKUserMessage {
  type: "user"
  uuid?: UUID
  session_id: string
  message: {
    content: ToolResultBlock[] | unknown
  }
  parent_tool_use_id: string | null
  isSynthetic?: boolean
  tool_use_result?: unknown
}

// ---------------------------------------------------------------------------
// SDKUserMessageReplay
// ---------------------------------------------------------------------------

export interface SDKUserMessageReplay {
  type: "user"
  uuid: UUID
  session_id: string
  message: {
    content: unknown
  }
  parent_tool_use_id: string | null
  isSynthetic?: boolean
  tool_use_result?: unknown
  isReplay: true
}

// ---------------------------------------------------------------------------
// SDKResultMessage
// ---------------------------------------------------------------------------

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
  maxOutputTokens: number
}

export interface NonNullableUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export interface SDKPermissionDenial {
  tool_name: string
  tool_use_id: string
  tool_input: Record<string, unknown>
}

export type SDKResultMessage =
  | {
      type: "result"
      subtype: "success"
      uuid: UUID
      session_id: string
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      result: string
      stop_reason: string | null
      total_cost_usd: number
      usage: NonNullableUsage
      modelUsage: Record<string, ModelUsage>
      permission_denials: SDKPermissionDenial[]
      structured_output?: unknown
    }
  | {
      type: "result"
      subtype:
        | "error_max_turns"
        | "error_during_execution"
        | "error_max_budget_usd"
        | "error_max_structured_output_retries"
      uuid: UUID
      session_id: string
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      stop_reason: string | null
      total_cost_usd: number
      usage: NonNullableUsage
      modelUsage: Record<string, ModelUsage>
      permission_denials: SDKPermissionDenial[]
      errors: string[]
    }

// ---------------------------------------------------------------------------
// SDKSystemMessage
// ---------------------------------------------------------------------------

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan"
  | "dontAsk"
  | "auto"

export type ApiKeySource = "user" | "project" | "org" | "temporary" | "oauth"

export interface SDKSystemMessage {
  type: "system"
  subtype: "init"
  uuid: UUID
  session_id: string
  agents?: string[]
  apiKeySource: ApiKeySource
  betas?: string[]
  claude_code_version: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  model: string
  permissionMode: PermissionMode
  slash_commands: string[]
  output_style: string
  skills: string[]
  plugins: Array<{ name: string; path: string }>
}

// ---------------------------------------------------------------------------
// Mensagens secundarias
// ---------------------------------------------------------------------------

export interface SDKPartialAssistantMessage {
  type: "stream_event"
  event: unknown
  parent_tool_use_id: string | null
  uuid: UUID
  session_id: string
}

export interface SDKCompactBoundaryMessage {
  type: "system"
  subtype: "compact_boundary"
  uuid: UUID
  session_id: string
  compact_metadata: {
    trigger: "manual" | "auto"
    pre_tokens: number
  }
}

export interface SDKStatusMessage {
  type: "system"
  subtype: "status"
  status: "compacting" | null
  permissionMode?: PermissionMode
  uuid: UUID
  session_id: string
}

export interface SDKLocalCommandOutputMessage {
  type: "system"
  subtype: "local_command_output"
  content: string
  uuid: UUID
  session_id: string
}

export interface SDKHookStartedMessage {
  type: "system"
  subtype: "hook_started"
  hook_id: string
  hook_name: string
  hook_event: string
  uuid: UUID
  session_id: string
}

export interface SDKHookProgressMessage {
  type: "system"
  subtype: "hook_progress"
  hook_id: string
  hook_name: string
  hook_event: string
  stdout: string
  stderr: string
  output: string
  uuid: UUID
  session_id: string
}

export interface SDKHookResponseMessage {
  type: "system"
  subtype: "hook_response"
  hook_id: string
  hook_name: string
  hook_event: string
  output: string
  stdout: string
  stderr: string
  exit_code?: number
  outcome: "success" | "error" | "cancelled"
  uuid: UUID
  session_id: string
}

export interface SDKToolProgressMessage {
  type: "tool_progress"
  tool_use_id: string
  tool_name: string
  parent_tool_use_id: string | null
  elapsed_time_seconds: number
  task_id?: string
  uuid: UUID
  session_id: string
}

export interface SDKAuthStatusMessage {
  type: "auth_status"
  isAuthenticating: boolean
  output: string[]
  error?: string
  uuid: UUID
  session_id: string
}

export interface SDKTaskNotificationMessage {
  type: "system"
  subtype: "task_notification"
  task_id: string
  tool_use_id?: string
  status: "completed" | "failed" | "stopped"
  output_file: string
  summary: string
  usage?: {
    total_tokens: number
    tool_uses: number
    duration_ms: number
  }
  uuid: UUID
  session_id: string
}

export interface SDKTaskStartedMessage {
  type: "system"
  subtype: "task_started"
  task_id: string
  tool_use_id?: string
  description: string
  task_type?: string
  uuid: UUID
  session_id: string
}

export interface SDKTaskProgressMessage {
  type: "system"
  subtype: "task_progress"
  task_id: string
  tool_use_id?: string
  description: string
  usage: {
    total_tokens: number
    tool_uses: number
    duration_ms: number
  }
  last_tool_name?: string
  uuid: UUID
  session_id: string
}

export interface SDKFilesPersistedEvent {
  type: "system"
  subtype: "files_persisted"
  files: Array<{ filename: string; file_id: string }>
  failed: Array<{ filename: string; error: string }>
  processed_at: string
  uuid: UUID
  session_id: string
}

export interface SDKRateLimitEvent {
  type: "rate_limit_event"
  rate_limit_info: {
    status: "allowed" | "allowed_warning" | "rejected"
    resetsAt?: number
    utilization?: number
  }
  uuid: UUID
  session_id: string
}

export interface SDKToolUseSummaryMessage {
  type: "tool_use_summary"
  summary: string
  preceding_tool_use_ids: string[]
  uuid: UUID
  session_id: string
}

export interface SDKPromptSuggestionMessage {
  type: "prompt_suggestion"
  suggestion: string
  uuid: UUID
  session_id: string
}

// ---------------------------------------------------------------------------
// Union de todas as mensagens
// ---------------------------------------------------------------------------

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKFilesPersistedEvent
  | SDKRateLimitEvent
  | SDKToolUseSummaryMessage
  | SDKPromptSuggestionMessage
