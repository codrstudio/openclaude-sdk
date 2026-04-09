// ---------------------------------------------------------------------------
// Tipos de introspeccao da Query (F-055)
// ---------------------------------------------------------------------------

export interface SlashCommand {
  name: string
  description?: string
}

export interface ModelInfo {
  id: string
  name?: string
  provider?: string
}

export interface AgentInfo {
  name: string
  description: string
  model?: string
}

export interface McpServerStatusInfo {
  name: string
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled"
  serverInfo?: { name: string; version: string }
  error?: string
  tools?: Array<{ name: string; description?: string }>
}

export interface AccountInfo {
  email?: string
  plan?: string
  hasApiKey?: boolean
}

export interface InitializationResult {
  tools?: string[]
  agents?: AgentInfo[]
  mcpServers?: McpServerStatusInfo[]
  model?: string
  permissionMode?: string
}
