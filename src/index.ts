// ---------------------------------------------------------------------------
// SDK publico — espelha @anthropic-ai/claude-agent-sdk + Provider Registry
// ---------------------------------------------------------------------------

// Funcao principal
export { query, collectMessages, continueSession } from "./query.js"
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
} from "./registry.js"

// Session management
export {
  listSessions,
  getSessionMessages,
  getSessionInfo,
  renameSession,
  tagSession,
  deleteSession,
} from "./sessions.js"

// ---------------------------------------------------------------------------
// Tipos — Provider/Model Registry
// ---------------------------------------------------------------------------

export type {
  Provider,
  Model,
  ProviderRegistry,
} from "./types/provider.js"

// ---------------------------------------------------------------------------
// Tipos — Control
// ---------------------------------------------------------------------------

export type {
  SlashCommand,
  ModelInfo,
  AgentInfo,
  AccountInfo,
  McpServerToolInfo,
  McpServerStatus,
  SDKControlInitializeResponse,
  SDKControlMcpStatusResponse,
} from "./types/control.js"

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
  PermissionResponse,
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
