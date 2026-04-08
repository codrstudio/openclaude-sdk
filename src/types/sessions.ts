// ---------------------------------------------------------------------------
// Session types — espelham @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

export interface SDKSessionInfo {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  createdAt?: number
}

export interface ListSessionsOptions {
  dir?: string
  limit?: number
  includeWorktrees?: boolean
}

export interface GetSessionMessagesOptions {
  dir?: string
  limit?: number
  offset?: number
}

export interface GetSessionInfoOptions {
  dir?: string
}

export interface SessionMutationOptions {
  dir?: string
}

export interface SessionMessage {
  type: "user" | "assistant"
  uuid: string
  session_id: string
  message: unknown
  parent_tool_use_id: null
}
