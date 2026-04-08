// ---------------------------------------------------------------------------
// Tool Input Types — espelham @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

export interface AgentInput {
  description: string
  prompt: string
  subagent_type: string
  model?: "sonnet" | "opus" | "haiku"
  resume?: string
  run_in_background?: boolean
  max_turns?: number
  name?: string
  team_name?: string
  mode?: "acceptEdits" | "bypassPermissions" | "default" | "dontAsk" | "plan"
  isolation?: "worktree"
}

export interface AskUserQuestionInput {
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string; preview?: string }>
    multiSelect: boolean
  }>
}

export interface BashInput {
  command: string
  timeout?: number
  description?: string
  run_in_background?: boolean
  dangerouslyDisableSandbox?: boolean
}

export interface TaskOutputInput {
  task_id: string
  block: boolean
  timeout: number
}

export interface FileEditInput {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

export interface FileReadInput {
  file_path: string
  offset?: number
  limit?: number
  pages?: string
}

export interface FileWriteInput {
  file_path: string
  content: string
}

export interface GlobInput {
  pattern: string
  path?: string
}

export interface GrepInput {
  pattern: string
  path?: string
  glob?: string
  type?: string
  output_mode?: "content" | "files_with_matches" | "count"
  "-i"?: boolean
  "-n"?: boolean
  "-B"?: number
  "-A"?: number
  "-C"?: number
  context?: number
  head_limit?: number
  offset?: number
  multiline?: boolean
}

export interface TaskStopInput {
  task_id?: string
  shell_id?: string
}

export interface NotebookEditInput {
  notebook_path: string
  cell_id?: string
  new_source: string
  cell_type?: "code" | "markdown"
  edit_mode?: "replace" | "insert" | "delete"
}

export interface WebFetchInput {
  url: string
  prompt: string
}

export interface WebSearchInput {
  query: string
  allowed_domains?: string[]
  blocked_domains?: string[]
}

export interface TodoWriteInput {
  todos: Array<{
    content: string
    status: "pending" | "in_progress" | "completed"
    activeForm: string
  }>
}

export interface ExitPlanModeInput {
  allowedPrompts?: Array<{
    tool: "Bash"
    prompt: string
  }>
}

export interface ListMcpResourcesInput {
  server?: string
}

export interface ReadMcpResourceInput {
  server: string
  uri: string
}

export interface ConfigInput {
  setting: string
  value?: string | boolean | number
}

export interface EnterWorktreeInput {
  name?: string
}

// ---------------------------------------------------------------------------
// Union de todos os inputs
// ---------------------------------------------------------------------------

export type ToolInputSchemas =
  | AgentInput
  | AskUserQuestionInput
  | BashInput
  | TaskOutputInput
  | ConfigInput
  | EnterWorktreeInput
  | ExitPlanModeInput
  | FileEditInput
  | FileReadInput
  | FileWriteInput
  | GlobInput
  | GrepInput
  | ListMcpResourcesInput
  | NotebookEditInput
  | ReadMcpResourceInput
  | TaskStopInput
  | TodoWriteInput
  | WebFetchInput
  | WebSearchInput

// ---------------------------------------------------------------------------
// Tool Output Types
// ---------------------------------------------------------------------------

export type AgentOutput =
  | {
      status: "completed"
      agentId: string
      content: Array<{ type: "text"; text: string }>
      totalToolUseCount: number
      totalDurationMs: number
      totalTokens: number
      usage: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens: number | null
        cache_read_input_tokens: number | null
        server_tool_use: {
          web_search_requests: number
          web_fetch_requests: number
        } | null
        service_tier: ("standard" | "priority" | "batch") | null
        cache_creation: {
          ephemeral_1h_input_tokens: number
          ephemeral_5m_input_tokens: number
        } | null
      }
      prompt: string
    }
  | {
      status: "async_launched"
      agentId: string
      description: string
      prompt: string
      outputFile: string
      canReadOutputFile?: boolean
    }
  | {
      status: "sub_agent_entered"
      description: string
      message: string
    }

export interface AskUserQuestionOutput {
  questions: Array<{
    question: string
    header: string
    options: Array<{ label: string; description: string; preview?: string }>
    multiSelect: boolean
  }>
  answers: Record<string, string>
}

export interface BashOutput {
  stdout: string
  stderr: string
  rawOutputPath?: string
  interrupted: boolean
  isImage?: boolean
  backgroundTaskId?: string
  backgroundedByUser?: boolean
  dangerouslyDisableSandbox?: boolean
  returnCodeInterpretation?: string
  structuredContent?: unknown[]
  persistedOutputPath?: string
  persistedOutputSize?: number
}

export interface FileEditOutput {
  filePath: string
  oldString: string
  newString: string
  originalFile: string
  structuredPatch: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
  userModified: boolean
  replaceAll: boolean
  gitDiff?: {
    filename: string
    status: "modified" | "added"
    additions: number
    deletions: number
    changes: number
    patch: string
  }
}

export type FileReadOutput =
  | {
      type: "text"
      file: {
        filePath: string
        content: string
        numLines: number
        startLine: number
        totalLines: number
      }
    }
  | {
      type: "image"
      file: {
        base64: string
        type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        originalSize: number
        dimensions?: {
          originalWidth?: number
          originalHeight?: number
          displayWidth?: number
          displayHeight?: number
        }
      }
    }
  | {
      type: "notebook"
      file: {
        filePath: string
        cells: unknown[]
      }
    }
  | {
      type: "pdf"
      file: {
        filePath: string
        base64: string
        originalSize: number
      }
    }
  | {
      type: "parts"
      file: {
        filePath: string
        originalSize: number
        count: number
        outputDir: string
      }
    }

export interface FileWriteOutput {
  type: "create" | "update"
  filePath: string
  content: string
  structuredPatch: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
  originalFile: string | null
  gitDiff?: {
    filename: string
    status: "modified" | "added"
    additions: number
    deletions: number
    changes: number
    patch: string
  }
}

export interface GlobOutput {
  durationMs: number
  numFiles: number
  filenames: string[]
  truncated: boolean
}

export interface GrepOutput {
  mode?: "content" | "files_with_matches" | "count"
  numFiles: number
  filenames: string[]
  content?: string
  numLines?: number
  numMatches?: number
  appliedLimit?: number
  appliedOffset?: number
}

export interface TaskStopOutput {
  message: string
  task_id: string
  task_type: string
  command?: string
}

export interface NotebookEditOutput {
  new_source: string
  cell_id?: string
  cell_type: "code" | "markdown"
  language: string
  edit_mode: string
  error?: string
  notebook_path: string
  original_file: string
  updated_file: string
}

export interface WebFetchOutput {
  bytes: number
  code: number
  codeText: string
  result: string
  durationMs: number
  url: string
}

export interface WebSearchOutput {
  query: string
  results: Array<
    | { tool_use_id: string; content: Array<{ title: string; url: string }> }
    | string
  >
  durationSeconds: number
}

export interface TodoWriteOutput {
  oldTodos: Array<{
    content: string
    status: "pending" | "in_progress" | "completed"
    activeForm: string
  }>
  newTodos: Array<{
    content: string
    status: "pending" | "in_progress" | "completed"
    activeForm: string
  }>
}

export interface ExitPlanModeOutput {
  plan: string | null
  isAgent: boolean
  filePath?: string
  hasTaskTool?: boolean
  awaitingLeaderApproval?: boolean
  requestId?: string
}

export type ListMcpResourcesOutput = Array<{
  uri: string
  name: string
  mimeType?: string
  description?: string
  server: string
}>

export interface ReadMcpResourceOutput {
  contents: Array<{
    uri: string
    mimeType?: string
    text?: string
  }>
}

export interface ConfigOutput {
  success: boolean
  operation?: "get" | "set"
  setting?: string
  value?: unknown
  previousValue?: unknown
  newValue?: unknown
  error?: string
}

export interface EnterWorktreeOutput {
  worktreePath: string
  worktreeBranch?: string
  message: string
}

// ---------------------------------------------------------------------------
// Union de todos os outputs
// ---------------------------------------------------------------------------

export type ToolOutputSchemas =
  | AgentOutput
  | AskUserQuestionOutput
  | BashOutput
  | ConfigOutput
  | EnterWorktreeOutput
  | ExitPlanModeOutput
  | FileEditOutput
  | FileReadOutput
  | FileWriteOutput
  | GlobOutput
  | GrepOutput
  | ListMcpResourcesOutput
  | NotebookEditOutput
  | ReadMcpResourceOutput
  | TaskStopOutput
  | TodoWriteOutput
  | WebFetchOutput
  | WebSearchOutput
