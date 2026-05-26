// ---------------------------------------------------------------------------
// SDK publico — espelha @anthropic-ai/claude-agent-sdk + Provider Registry
// ---------------------------------------------------------------------------

// Funcao principal
export { query, collectMessages, continueSession } from "./query.js"
export type { Query } from "./query.js"

// MCP tool factories
export { tool, createSdkMcpServer, startSdkServerTransport } from "./mcp.js"
export type { ToolAnnotations, CallToolResult, SdkMcpToolDefinition } from "./mcp.js"

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
  DEFAULT_MODEL,
  createOpenRouterRegistry,
  resolveModelEnv,
} from "./registry.js"

// Catalog
export {
  BUILTIN_CATALOG,
  createRegistryFromCatalog,
  validateCatalog,
  CatalogSchema,
  CatalogProviderSchema,
  CatalogModelSchema,
  ProviderTypeSchema,
} from "./catalog/index.js"
export type {
  CatalogInput,
  CreateRegistryOptions,
} from "./catalog/index.js"

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
  ProviderType,
  Provider,
  Model,
  ProviderRegistry,
  Catalog,
  CatalogProvider,
  CatalogModel,
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
  SDKPresenceMessage,
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
  McpSdkServerConfig,
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
// Tipos — Query introspection
// ---------------------------------------------------------------------------

export type {
  SlashCommand,
  ModelInfo,
  AgentInfo,
  McpServerStatusInfo,
  AccountInfo,
  InitializationResult,
  RewindFilesResult,
  McpSetServersResult,
} from "./types/query.js"

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

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

export { normalizeLocale, SUPPORTED_LOCALES } from "./locale/index.js"
export type { SupportedLocale } from "./locale/index.js"

// ---------------------------------------------------------------------------
// Tool Intention Filter
// ---------------------------------------------------------------------------

export { pickIntention, applyToolIntentionFilter } from "./tool-intention/index.js"
export type { ToolIntentionPayload } from "./tool-intention/index.js"

// ---------------------------------------------------------------------------
// V2 Session API
// ---------------------------------------------------------------------------

export { createSession, resumeSession, prompt } from "./session-v2.js"
export type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
  PromptResult,
} from "./session-v2.js"

// ---------------------------------------------------------------------------
// Persistent Session — subprocess unico vivo entre turnos
// ---------------------------------------------------------------------------

export { createPersistentSession, DEFAULT_COMFORT_PHRASES } from "./session-persistent.js"
export type {
  PersistentSession,
  CreatePersistentSessionOptions,
  TurnStream,
  ComfortConfig,
  AskUserQuestionRequest,
  AskUserQuestionResponse,
  AskUserQuestionItem,
  AskUserQuestionOption,
  AskUserQuestionAnnotation,
} from "./session-persistent.js"

// ---------------------------------------------------------------------------
// Session Pool — pool de PersistentSession pre-aquecidas
// ---------------------------------------------------------------------------

export { createSessionPool } from "./session-pool.js"
export type { SessionPool, SessionPoolOptions } from "./session-pool.js"

export { createMultiSessionPool } from "./session-multi-pool.js"
export type {
  MultiSessionPool,
  MultiSessionPoolOptions,
  MultiPoolBaseOptions,
} from "./session-multi-pool.js"

// ---------------------------------------------------------------------------
// Artifacts — saída rica via tag <antArtifact> no TextBlock
// ---------------------------------------------------------------------------

export { buildSkillBody as buildArtifactsSkillBody } from "./artifacts/index.js"
export type { ArtifactType, ArtifactsFeatures } from "./artifacts/index.js"

// ---------------------------------------------------------------------------
// Auth — autenticação Anthropic (claude.ai Pro/Max + Console), fluxo manual
// headless/web. Reimplementa o /login sem depender do CLI nem de localhost.
// ---------------------------------------------------------------------------

export {
  startLogin,
  exchangeManualCode,
  refreshTokens,
  completeLogin,
  ensureFreshToken,
  saveCredentials,
  readCredentials,
  getAuthStatus,
  logout,
  resolveConfigDir,
  ALL_OAUTH_SCOPES,
  CLAUDE_AI_OAUTH_SCOPES,
  CLAUDE_AI_INFERENCE_SCOPE,
  getOAuthEndpoints,
} from "./auth/index.js"
export type {
  OAuthTokens,
  LoginFlow,
  StartLoginOptions,
  StoredOAuth,
  AuthStatus,
  OAuthEndpoints,
} from "./auth/index.js"
