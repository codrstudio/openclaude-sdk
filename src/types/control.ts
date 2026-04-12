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

export interface AccountInfo {
  email?: string
  plan?: string
  [key: string]: unknown
}

export interface McpServerToolInfo {
  name: string
  description?: string
}

export interface McpServerStatus {
  name: string
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled"
  serverInfo?: { name: string; version: string }
  error?: string
  tools?: McpServerToolInfo[]
}

export interface SDKControlInitializeResponse {
  commands: SlashCommand[]
  agents: AgentInfo[]
  output_style: string
  available_output_styles: string[]
  models: ModelInfo[]
  account: AccountInfo
  pid?: number
  fast_mode_state?: unknown
}

export interface SDKControlMcpStatusResponse {
  mcpServers: McpServerStatus[]
}
