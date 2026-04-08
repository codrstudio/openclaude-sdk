// ---------------------------------------------------------------------------
// SDK publico — espelha @anthropic-ai/claude-agent-sdk + Provider Registry
// ---------------------------------------------------------------------------

// Funcao principal
export { query, collectMessages } from "./query.js"
export type { Query } from "./query.js"

// Errors
export {
  OpenClaudeError,
  AuthenticationError,
  BillingError,
  RateLimitError,
  InvalidRequestError,
  ServerError,
  MaxTurnsError,
  MaxBudgetError,
  ExecutionError,
  StructuredOutputError,
  isRecoverable,
} from "./errors.js"

// Registry
export {
  createOpenRouterRegistry,
  resolveModelEnv,
  resolveCommand,
} from "./registry.js"

// Session management
export {
  listSessions,
  getSessionMessages,
  getSessionInfo,
  renameSession,
  tagSession,
} from "./sessions.js"

// Process internals (para uso avancado)
export { buildCliArgs, spawnAndStream, resolveExecutable } from "./process.js"

// ---------------------------------------------------------------------------
// Tipos — Provider/Model Registry
// ---------------------------------------------------------------------------

export type {
  Provider,
  Model,
  ProviderRegistry,
} from "./types/provider.js"

// ---------------------------------------------------------------------------
// Tipos — Messages
// ---------------------------------------------------------------------------

export type {
  UUID,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ContentBlock,
  SDKAssistantMessageError,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  ModelUsage,
  NonNullableUsage,
  SDKPermissionDenial,
  SDKResultMessage,
  PermissionMode,
  ApiKeySource,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKStatusMessage,
  SDKLocalCommandOutputMessage,
  SDKHookStartedMessage,
  SDKHookProgressMessage,
  SDKHookResponseMessage,
  SDKToolProgressMessage,
  SDKAuthStatusMessage,
  SDKTaskNotificationMessage,
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
  SDKFilesPersistedEvent,
  SDKRateLimitEvent,
  SDKToolUseSummaryMessage,
  SDKPromptSuggestionMessage,
  SDKMessage,
} from "./types/messages.js"

// ---------------------------------------------------------------------------
// Tipos — Options
// ---------------------------------------------------------------------------

export type {
  Options,
  AgentDefinition,
  AgentMcpServerSpec,
  McpServerConfig,
  McpStdioServerConfig,
  McpSSEServerConfig,
  McpHttpServerConfig,
  PermissionResult,
  PermissionUpdate,
  PermissionBehavior,
  PermissionUpdateDestination,
  PermissionRuleValue,
  CanUseTool,
  HookEvent,
  HookCallbackMatcher,
  HookCallback,
  HookJSONOutput,
  ThinkingConfig,
  SandboxSettings,
  ToolConfig,
  SdkPluginConfig,
  SettingSource,
  SdkBeta,
} from "./types/options.js"

// ---------------------------------------------------------------------------
// Tipos — Tools
// ---------------------------------------------------------------------------

export type {
  ToolInputSchemas,
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  TaskOutputInput,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  TaskStopInput,
  NotebookEditInput,
  WebFetchInput,
  WebSearchInput,
  TodoWriteInput,
  ExitPlanModeInput,
  ListMcpResourcesInput,
  ReadMcpResourceInput,
  ConfigInput,
  EnterWorktreeInput,
  ToolOutputSchemas,
  AgentOutput,
  AskUserQuestionOutput,
  BashOutput,
  FileEditOutput,
  FileReadOutput,
  FileWriteOutput,
  GlobOutput,
  GrepOutput,
  TaskStopOutput,
  NotebookEditOutput,
  WebFetchOutput,
  WebSearchOutput,
  TodoWriteOutput,
  ExitPlanModeOutput,
  ListMcpResourcesOutput,
  ReadMcpResourceOutput,
  ConfigOutput,
  EnterWorktreeOutput,
} from "./types/tools.js"

// ---------------------------------------------------------------------------
// Tipos — Sessions
// ---------------------------------------------------------------------------

export type {
  SDKSessionInfo,
  ListSessionsOptions,
  GetSessionMessagesOptions,
  GetSessionInfoOptions,
  SessionMutationOptions,
  SessionMessage,
} from "./types/sessions.js"
