// ---------------------------------------------------------------------------
// Options — espelha @anthropic-ai/claude-agent-sdk Options
// ---------------------------------------------------------------------------

import type { PermissionMode } from "./messages.js"

// ---------------------------------------------------------------------------
// Agent Definition
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  description: string
  tools?: string[]
  disallowedTools?: string[]
  prompt: string
  model?: "sonnet" | "opus" | "haiku" | "inherit"
  mcpServers?: AgentMcpServerSpec[]
  skills?: string[]
  maxTurns?: number
  criticalSystemReminder_EXPERIMENTAL?: string
}

export type AgentMcpServerSpec = string | Record<string, McpServerConfig>

// ---------------------------------------------------------------------------
// MCP Server Config
// ---------------------------------------------------------------------------

export interface McpSdkServerConfig {
  type: "sdk"
  name: string
  instance: unknown // McpServer de @modelcontextprotocol/sdk — tipo opaco para evitar dep direta
  /** @internal — Porta local atribuida pelo lifecycle manager */
  _localPort?: number
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfig

export interface McpStdioServerConfig {
  type?: "stdio"
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpSSEServerConfig {
  type: "sse"
  url: string
  headers?: Record<string, string>
}

export interface McpHttpServerConfig {
  type: "http"
  url: string
  headers?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Permission types
// ---------------------------------------------------------------------------

export type PermissionResult =
  | {
      behavior: "allow"
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
      toolUseID?: string
    }
  | {
      behavior: "deny"
      message: string
      interrupt?: boolean
      toolUseID?: string
    }

export type PermissionUpdate =
  | {
      type: "addRules"
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
      destination: PermissionUpdateDestination
    }
  | {
      type: "replaceRules"
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
      destination: PermissionUpdateDestination
    }
  | {
      type: "removeRules"
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
      destination: PermissionUpdateDestination
    }
  | {
      type: "setMode"
      mode: PermissionMode
      destination: PermissionUpdateDestination
    }
  | {
      type: "addDirectories"
      directories: string[]
      destination: PermissionUpdateDestination
    }
  | {
      type: "removeDirectories"
      directories: string[]
      destination: PermissionUpdateDestination
    }

export type PermissionBehavior = "allow" | "deny" | "ask"

export interface PermissionResponse {
  toolUseId: string
  behavior: "allow" | "deny"
  message?: string
}

export type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings"
  | "session"
  | "cliArg"

export interface PermissionRuleValue {
  toolName: string
  ruleContent?: string
}

export type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal
    suggestions?: PermissionUpdate[]
    blockedPath?: string
    decisionReason?: string
    toolUseID: string
    agentID?: string
  },
) => Promise<PermissionResult>

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PermissionRequest"
  | "Setup"
  | "TeammateIdle"
  | "TaskCompleted"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"

export interface HookCallbackMatcher {
  matcher?: string
  hooks: HookCallback[]
  timeout?: number
}

export type HookCallback = (
  input: unknown,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookJSONOutput>

export type HookJSONOutput =
  | { async: true; asyncTimeout?: number }
  | {
      continue?: boolean
      suppressOutput?: boolean
      stopReason?: string
      decision?: "approve" | "block"
      systemMessage?: string
      reason?: string
      hookSpecificOutput?: unknown
    }

// ---------------------------------------------------------------------------
// Thinking config
// ---------------------------------------------------------------------------

export type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens?: number }
  | { type: "disabled" }

// ---------------------------------------------------------------------------
// Sandbox settings
// ---------------------------------------------------------------------------

export interface SandboxSettings {
  enabled?: boolean
  autoAllowBashIfSandboxed?: boolean
  excludedCommands?: string[]
  allowUnsandboxedCommands?: boolean
  network?: {
    allowedDomains?: string[]
    allowManagedDomainsOnly?: boolean
    allowLocalBinding?: boolean
    allowUnixSockets?: string[]
    allowAllUnixSockets?: boolean
    httpProxyPort?: number
    socksProxyPort?: number
  }
  filesystem?: {
    allowWrite?: string[]
    denyWrite?: string[]
    denyRead?: string[]
  }
  ignoreViolations?: Record<string, string[]>
  enableWeakerNestedSandbox?: boolean
  ripgrep?: { command: string; args?: string[] }
}

// ---------------------------------------------------------------------------
// Tool config
// ---------------------------------------------------------------------------

export interface ToolConfig {
  askUserQuestion?: {
    previewFormat?: "markdown" | "html"
  }
}

// ---------------------------------------------------------------------------
// Plugin config
// ---------------------------------------------------------------------------

export interface SdkPluginConfig {
  type: "local"
  path: string
}

// ---------------------------------------------------------------------------
// Setting source
// ---------------------------------------------------------------------------

export type SettingSource = "user" | "project" | "local"

// ---------------------------------------------------------------------------
// SdkBeta
// ---------------------------------------------------------------------------

export type SdkBeta = "context-1m-2025-08-07"

// ---------------------------------------------------------------------------
// Options principal — passada para query()
// ---------------------------------------------------------------------------

export interface Options {
  abortController?: AbortController
  additionalDirectories?: string[]
  agent?: string
  agents?: Record<string, AgentDefinition>
  allowDangerouslySkipPermissions?: boolean
  allowedTools?: string[]
  betas?: SdkBeta[]
  canUseTool?: CanUseTool
  continue?: boolean
  cwd?: string
  debug?: boolean
  debugFile?: string
  disallowedTools?: string[]
  effort?: "low" | "medium" | "high" | "max"
  enableFileCheckpointing?: boolean
  env?: Record<string, string | undefined>
  executable?: "bun" | "deno" | "node"
  executableArgs?: string[]
  extraArgs?: Record<string, string | null>
  fallbackModel?: string
  forkSession?: boolean
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>
  includePartialMessages?: boolean
  maxBudgetUsd?: number
  maxBufferSize?: number
  maxThinkingTokens?: number
  maxTurns?: number
  mcpServers?: Record<string, McpServerConfig>
  model?: string
  outputFormat?: { type: "json_schema"; schema: unknown }
  pathToClaudeCodeExecutable?: string
  permissionMode?: PermissionMode
  permissionPromptToolName?: string
  persistSession?: boolean
  plugins?: SdkPluginConfig[]
  promptSuggestions?: boolean
  resume?: string
  resumeSessionAt?: string
  richOutput?: boolean
  sandbox?: SandboxSettings
  sessionId?: string
  settingSources?: SettingSource[]
  systemPrompt?:
    | string
    | { type: "preset"; preset: "claude_code"; append?: string }
  thinking?: ThinkingConfig
  timeoutMs?: number
  toolConfig?: ToolConfig
  tools?: string[] | { type: "preset"; preset: "claude_code" }
}
