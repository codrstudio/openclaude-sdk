# openclaude-sdk

TypeScript SDK wrapper for the OpenClaude CLI.

## Installation

### npm (public registry)

```bash
npm install @codrstudio/openclaude-sdk
```

### GitHub Packages

Requires authentication with a GitHub token that has `read:packages` scope.

```bash
echo "@codrstudio:registry=https://npm.pkg.github.com" >> .npmrc
npm install @codrstudio/openclaude-sdk
```

### Direct download (.tgz)

```bash
npm install https://github.com/codrstudio/openclaude-sdk/releases/download/v0.4.0/codrstudio-openclaude-sdk-0.4.0.tgz
```

Browse all versions at [Releases](https://github.com/codrstudio/openclaude-sdk/releases).

---

Requires Node.js >= 20 and the [OpenClaude CLI](https://github.com/Gitlawb/openclaude) installed and available in your `PATH`.

## Quick Start

```typescript
import { query } from "openclaude-sdk"

const q = query({ prompt: "Hello, world!" })

for await (const message of q) {
  if (message.type === "assistant") {
    console.log(message.message.content)
  }
}
```

## API Reference

### `query(params)`

The primary entry point. Returns a `Query` object — an `AsyncGenerator<SDKMessage>` decorated with extra control methods.

```typescript
function query(params: {
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query
```

**Example:**

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "List files in the current directory",
  options: { cwd: "/my/project", maxTurns: 5 },
})

for await (const msg of q) {
  if (msg.type === "result") {
    console.log("Result:", msg.result)
    console.log("Cost:", msg.total_cost_usd)
  }
}
```

The `Query` object also exposes:

#### Core Methods

| Method | Description |
|--------|-------------|
| `interrupt(): Promise<void>` | Gracefully interrupt the running agent (SIGINT) |
| `close(): Promise<void>` | Terminate the subprocess (3-stage shutdown) |
| `respondToPermission(response: PermissionResponse): void` | Respond to a tool permission request (plan mode) |

#### Control Methods (fire-and-forget)

Sent via stdin — no response is awaited.

| Method | Description |
|--------|-------------|
| `setModel(model?: string): void` | Change the model mid-session. `undefined` resets to default |
| `setPermissionMode(mode: PermissionMode): void` | Change permission mode mid-session (`"default"`, `"plan"`, `"bypassPermissions"`, `"dontAsk"`) |
| `setMaxThinkingTokens(tokens: number \| null): void` | Set max thinking tokens mid-session. `null` to disable |

#### Introspection Methods (request/response, timeout 10s)

Only available while the agent is active (during stream iteration).

| Method | Return | Description |
|--------|--------|-------------|
| `initializationResult()` | `Promise<InitializationResult>` | Initialization result (tools, agents, MCP) |
| `supportedCommands()` | `Promise<SlashCommand[]>` | Available slash commands |
| `supportedModels()` | `Promise<ModelInfo[]>` | Available models |
| `supportedAgents()` | `Promise<AgentInfo[]>` | Configured agents |
| `mcpServerStatus()` | `Promise<McpServerStatusInfo[]>` | Status of connected MCP servers |
| `accountInfo()` | `Promise<AccountInfo>` | Account information |

**Example — mid-session control and introspection:**

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Analyze this codebase",
  options: { permissionMode: "plan" },
})

// Change model mid-session (fire-and-forget)
q.setModel("claude-sonnet-4-6")

// Check available models
const models = await q.supportedModels()
console.log("Available models:", models.map(m => m.id))

// Check MCP server status
const mcpStatus = await q.mcpServerStatus()
for (const server of mcpStatus) {
  console.log(`${server.name}: ${server.status}`)
}

for await (const msg of q) {
  // process messages
}
```

> **Protocol note:** Control methods (`set*`) are fire-and-forget — they write a command to stdin and return immediately. Introspection methods are request/response — they write a command and await a reply on stdout (timeout 10s).

**Exported introspection types:**

```typescript
import type {
  InitializationResult,
  SlashCommand,
  ModelInfo,
  AgentInfo,
  McpServerStatusInfo,
  AccountInfo,
} from "openclaude-sdk"
```

#### Operation Methods

##### Request/Response Operations (timeout 30s)

| Method | Return | Description |
|--------|--------|-------------|
| `rewindFiles(userMessageId, opts?)` | `Promise<RewindFilesResult>` | Reverts files changed by the agent back to a previous point. Pass `opts.dryRun: true` for a preview without reverting |
| `setMcpServers(servers)` | `Promise<McpSetServersResult>` | Reconfigures MCP servers mid-session |

> **Timeout note:** Request/response operations use a 30s timeout (longer than introspection) because they may involve filesystem or network operations.

##### Fire-and-Forget Operations

| Method | Description |
|--------|-------------|
| `reconnectMcpServer(serverName: string): void` | Reconnects a disconnected MCP server |
| `toggleMcpServer(serverName: string, enabled: boolean): void` | Enables or disables a MCP server |
| `stopTask(taskId: string): void` | Stops a specific agent task |

##### Stream Operations

| Method | Return | Description |
|--------|--------|-------------|
| `streamInput(stream: AsyncIterable<string>)` | `Promise<void>` | Sends text chunk by chunk via stdin. Blocks until the entire iterable is consumed |

**Example — `rewindFiles()` with dryRun:**

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Refactor the auth module",
  options: { permissionMode: "plan" },
})

let lastUserMessageId: string | null = null

for await (const msg of q) {
  if (msg.type === "user") {
    lastUserMessageId = msg.uuid
  }

  if (shouldRevert && lastUserMessageId) {
    // Preview which files would be reverted
    const preview = await q.rewindFiles(lastUserMessageId, { dryRun: true })
    console.log("Files to revert:", preview)

    // Actually revert
    await q.rewindFiles(lastUserMessageId)
    break
  }
}
```

**Example — `streamInput()` with AsyncIterable:**

```typescript
import { query } from "openclaude-sdk"

const q = query({ prompt: "Process the following data:" })

async function* generateChunks() {
  yield "First chunk of data\n"
  yield "Second chunk of data\n"
  yield "Final chunk\n"
}

// Stream all chunks into the agent before iterating responses
await q.streamInput(generateChunks())

for await (const msg of q) {
  // process messages
}
```

**Exported operation types:**

```typescript
import type {
  RewindFilesResult,
  McpSetServersResult,
} from "openclaude-sdk"
```

---

### `collectMessages(q)`

Consumes a `Query` to completion and returns a structured result. Throws typed errors on failure.

```typescript
function collectMessages(q: Query): Promise<{
  messages: SDKMessage[]
  sessionId: string | null
  result: string | null
  costUsd: number
  durationMs: number
}>
```

**Example:**

```typescript
import { query, collectMessages } from "openclaude-sdk"

const q = query({ prompt: "What is 2 + 2?" })
const { result, costUsd } = await collectMessages(q)
console.log(result, costUsd)
```

---

### `continueSession(params)`

Convenience wrapper for resuming an existing session. Equivalent to calling `query()` with `options.resume` set.

```typescript
function continueSession(params: {
  sessionId: string
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query
```

**Example:**

```typescript
import { continueSession } from "openclaude-sdk"

const q = continueSession({
  sessionId: "abc-123",
  prompt: "Now also rename the file",
})

for await (const msg of q) {
  // ...
}
```

---

### `createOpenRouterRegistry(config)`

Factory that creates a `ProviderRegistry` configured for [OpenRouter](https://openrouter.ai).

```typescript
function createOpenRouterRegistry(config: {
  apiKey: string
  models: {
    id: string
    label: string
    contextWindow?: number
    supportsVision?: boolean
  }[]
}): ProviderRegistry
```

**Example:**

```typescript
import { createOpenRouterRegistry, query } from "openclaude-sdk"

const registry = createOpenRouterRegistry({
  apiKey: process.env.OPENROUTER_API_KEY!,
  models: [{ id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" }],
})

const q = query({
  prompt: "Refactor this function",
  model: "anthropic/claude-3.5-sonnet",
  registry,
})
```

---

### `resolveModelEnv(registry, modelId)`

Resolves a model ID within a registry to the environment variables required by the OpenClaude CLI (e.g., `OPENAI_API_KEY`, `CLAUDE_CODE_USE_OPENAI`).

```typescript
function resolveModelEnv(
  registry: ProviderRegistry,
  modelId: string,
): Record<string, string>
```

**Example:**

```typescript
import { createOpenRouterRegistry, resolveModelEnv } from "openclaude-sdk"

const registry = createOpenRouterRegistry({ apiKey: "...", models: [...] })
const envVars = resolveModelEnv(registry, "anthropic/claude-3.5-sonnet")
// { CLAUDE_CODE_USE_OPENAI: '1', OPENAI_BASE_URL: '...', OPENAI_API_KEY: '...', OPENAI_MODEL: '...' }
```

---

### `listSessions(options?)`

Lists Claude Code sessions stored in `~/.claude/projects/`. By default performs a deep search across all project subdirectories. Results are sorted by `lastModified` descending.

```typescript
function listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]>

interface ListSessionsOptions {
  dir?: string    // restrict to a specific working directory
  limit?: number  // max number of results
  deep?: boolean  // default true; set false to search root only
}
```

**Example:**

```typescript
import { listSessions } from "openclaude-sdk"

// Deep search across all projects (default)
const all = await listSessions({ limit: 20 })

// Sessions for a specific project directory
const project = await listSessions({ dir: "/my/project" })

// Root only (no subdirectory traversal)
const root = await listSessions({ deep: false })
```

---

### `getSessionMessages(sessionId, options?)`

Returns the messages for a given session.

```typescript
function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions,
): Promise<SessionMessage[]>

interface GetSessionMessagesOptions {
  dir?: string
  limit?: number
  offset?: number
}
```

**Example:**

```typescript
import { getSessionMessages } from "openclaude-sdk"

const messages = await getSessionMessages("abc-123", { limit: 50 })
```

---

### `getSessionInfo(sessionId, options?)`

Returns metadata for a single session, or `undefined` if not found.

```typescript
function getSessionInfo(
  sessionId: string,
  options?: GetSessionInfoOptions,
): Promise<SDKSessionInfo | undefined>
```

**Example:**

```typescript
import { getSessionInfo } from "openclaude-sdk"

const info = await getSessionInfo("abc-123")
console.log(info?.summary, info?.lastModified)
```

---

### `renameSession(sessionId, title, options?)`

Sets a custom title for a session by appending a `custom_title` record to its JSONL file.

```typescript
function renameSession(
  sessionId: string,
  title: string,
  options?: SessionMutationOptions,
): Promise<void>
```

**Example:**

```typescript
import { renameSession } from "openclaude-sdk"

await renameSession("abc-123", "Refactor auth module")
```

---

### `tagSession(sessionId, tag, options?)`

Adds or removes a tag on a session. Pass `null` to clear the tag.

```typescript
function tagSession(
  sessionId: string,
  tag: string | null,
  options?: SessionMutationOptions,
): Promise<void>
```

**Example:**

```typescript
import { tagSession } from "openclaude-sdk"

await tagSession("abc-123", "reviewed")
await tagSession("abc-123", null) // remove tag
```

---

## Options

All `Options` fields are optional. They are passed via `query({ options })` or `continueSession({ options })`.

### Execution

| Field | Type | Description |
|-------|------|-------------|
| `cwd` | `string` | Working directory for the agent subprocess |
| `model` | `string` | Model identifier (e.g. `"claude-sonnet-4-6"`) |
| `maxTurns` | `number` | Maximum number of agent turns |
| `maxBudgetUsd` | `number` | Spend cap in USD; throws `MaxBudgetError` when exceeded |
| `timeoutMs` | `number` | Timeout in milliseconds for the agent subprocess |
| `effort` | `"low" \| "medium" \| "high" \| "max"` | Controls agent effort level |
| `thinking` | `ThinkingConfig` | Controls extended thinking (`adaptive`, `enabled`, `disabled`) |

### Permissions

| Field | Type | Description |
|-------|------|-------------|
| `permissionMode` | `PermissionMode` | `"default"` \| `"plan"` \| `"bypassPermissions"` \| `"dontAsk"` — controls how tool use is approved |
| `allowDangerouslySkipPermissions` | `boolean` | Skip all permission prompts (use with care) |
| `allowedTools` | `string[]` | Whitelist of tool names the agent may use |
| `disallowedTools` | `string[]` | Blacklist of tool names the agent may not use |

### Session

| Field | Type | Description |
|-------|------|-------------|
| `resume` | `string` | Session ID to resume from |
| `continue` | `boolean` | Continue the most recent session |
| `sessionId` | `string` | Explicit session ID to use |

### Prompt

| Field | Type | Description |
|-------|------|-------------|
| `systemPrompt` | `string \| { type: "preset"; preset: "claude_code"; append?: string }` | Override or extend the system prompt |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `outputFormat` | `{ type: "json_schema"; schema: unknown }` | Request structured JSON output matching the provided schema (uses `--json-schema`) |

### Advanced

| Field | Type | Description |
|-------|------|-------------|
| `additionalDirectories` | `string[]` | Extra directories to make available to the agent (`--add-dir`) |
| `betas` | `SdkBeta[]` | Enable beta features (e.g. `"context-1m-2025-08-07"`) |
| `extraArgs` | `Record<string, string \| null>` | Pass arbitrary CLI flags; `null` value emits a bare flag (e.g. `{ verbose: null }` → `--verbose`) |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP server definitions (stdio, SSE, or HTTP) to pass to the agent |
| `env` | `Record<string, string>` | Additional environment variables for the subprocess |
| `pathToClaudeCodeExecutable` | `string` | Override the path to the OpenClaude executable (default: `"openclaude"`) |

---

## Error Handling

`collectMessages()` throws typed errors when the agent terminates abnormally. Use `isRecoverable()` to decide whether to retry.

### Error Hierarchy

```
OpenClaudeError
├── AuthenticationError      (fatal)
├── BillingError             (fatal)
├── InvalidRequestError      (fatal)
├── MaxTurnsError            (fatal)
├── MaxBudgetError           (fatal)
├── ExecutionError           (fatal)
├── StructuredOutputError    (fatal)
├── RateLimitError           (recoverable — has resetsAt, utilization)
└── ServerError              (recoverable)
```

```typescript
import { query, collectMessages, isRecoverable, RateLimitError } from "openclaude-sdk"

async function run(prompt: string) {
  const q = query({ prompt })
  try {
    const { result } = await collectMessages(q)
    return result
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.log("Rate limited, resets at:", err.resetsAt)
    }
    if (isRecoverable(err)) {
      console.log("Recoverable error, can retry:", err.message)
    } else {
      console.error("Fatal error:", err.message)
    }
    throw err
  }
}
```

### Error Classes

All errors extend `OpenClaudeError` which provides:

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Machine-readable error code |
| `message` | `string` | Human-readable description |
| `sessionId` | `string \| null` | Session ID at time of failure |
| `costUsd` | `number` | Spend up to the point of failure |
| `durationMs` | `number` | Duration up to the point of failure |

### Error Table

| Class | Code | `isRecoverable` | When thrown |
|-------|------|-----------------|-------------|
| `AuthenticationError` | `authentication_failed` | false | Invalid API key or credentials |
| `BillingError` | `billing_error` | false | Account billing issue |
| `InvalidRequestError` | `invalid_request` | false | Malformed request |
| `RateLimitError` | `rate_limit` | **true** | API rate limit hit (has `resetsAt?`, `utilization?`) |
| `ServerError` | `server_error` | **true** | Transient server failure |
| `MaxTurnsError` | `max_turns` | **true** | Agent exceeded `maxTurns` |
| `MaxBudgetError` | `max_budget_usd` | **true** | Agent exceeded `maxBudgetUsd` |
| `ExecutionError` | `execution_error` | **true** | Runtime execution error |
| `StructuredOutputError` | `structured_output_retries` | **true** | Max retries for structured output exceeded |

---

## Provider Registry

Use a `ProviderRegistry` to route requests through any OpenAI-compatible provider (e.g. OpenRouter) without managing environment variables manually.

```typescript
import { createOpenRouterRegistry, DEFAULT_MODEL, query, collectMessages } from "openclaude-sdk"

const registry = createOpenRouterRegistry({
  apiKey: process.env.OPENROUTER_API_KEY!,
  models: [
    DEFAULT_MODEL, // GLM 4.7 Flash — best cost/quality ratio
    {
      id: "google/gemini-2.5-pro-preview-06-05",
      label: "Gemini 2.5 Pro",
      contextWindow: 1000000,
    },
  ],
})

const q = query({
  prompt: "Summarize this codebase",
  model: DEFAULT_MODEL.id,
  registry,
  options: { cwd: "/my/project" },
})

const { result } = await collectMessages(q)
console.log(result)
```

The SDK automatically resolves the model to the correct CLI environment variables (`CLAUDE_CODE_USE_OPENAI`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`).

---

## Session Management

### List sessions (deep search)

By default, `listSessions()` traverses all project subdirectories under `~/.claude/projects/` to aggregate sessions across every project:

```typescript
import { listSessions, continueSession, collectMessages } from "openclaude-sdk"

// Find the most recent session
const [latest] = await listSessions({ limit: 1 })
console.log(latest.sessionId, latest.summary)

// Continue it with a new prompt
const q = continueSession({
  sessionId: latest.sessionId,
  prompt: "Now add unit tests for what you just wrote",
})

const { result } = await collectMessages(q)
console.log(result)
```

### Resume a known session

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Fix the bug we found earlier",
  options: { resume: "abc-123" },
})

for await (const msg of q) {
  // ...
}
```

---

## V2 Session API

A V2 Session API é o padrão recomendado para conversas multi-turn, substituindo o gerenciamento manual de `sessionId`.

### `createSession(opts?)`

```typescript
function createSession(opts?: CreateSessionOptions): SDKSession

interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string  // auto-gerado se omitido
}
```

### Interface `SDKSession`

| Método | Retorno | Descrição |
|--------|---------|-----------|
| `send(prompt, options?)` | `Query` | Envia mensagem e retorna stream (AsyncGenerator) |
| `collect(prompt, options?)` | `Promise<{ messages, result, costUsd, durationMs }>` | Envia e coleta resultado completo |
| `close()` | `Promise<void>` | Fecha a sessão e mata query ativa |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Suporte a `await using` |

### Exemplo: Multi-turn com streaming

```typescript
import { createSession } from "openclaude-sdk"

await using session = createSession({ model: "sonnet" })

// Turno 1 — streaming
for await (const msg of session.send("Create a hello.ts file")) {
  if (msg.type === "assistant") {
    console.log(msg.message.content)
  }
}

// Turno 2 — coleta completa
const result = await session.collect("Now add error handling")
console.log(result.result)
```

### `resumeSession(sessionId, opts?)`

```typescript
function resumeSession(sessionId: string, opts?: ResumeSessionOptions): SDKSession

interface ResumeSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}
```

**Exemplo:**

```typescript
import { resumeSession } from "openclaude-sdk"

const session = resumeSession("abc-123-def")
const result = await session.collect("Continue where we left off")
await session.close()
```

### `prompt(text, opts?)` — one-shot

```typescript
function prompt(text: string, opts?: PromptOptions): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}>
```

**Exemplo:**

```typescript
import { prompt } from "openclaude-sdk"

const { result, costUsd } = await prompt("What is 2 + 2?")
console.log(result) // "4"
```

### Nota sobre `await using`

`SDKSession` implementa `AsyncDisposable` — `await using` garante cleanup automático mesmo em caso de exceção. Requer TypeScript >= 5.2 com `target: "ES2022"` ou superior.

### Comparação V1 vs V2

| Aspecto | V1 (`query` + `continueSession`) | V2 (`createSession`) |
|---------|----------------------------------|----------------------|
| Gerenciamento de sessionId | Manual | Automático |
| Multi-turn | `continueSession()` a cada turno | `session.send()` encadeia |
| Cleanup | Manual (`q.close()`) | `await using` |
| One-shot | `query()` + `collectMessages()` | `prompt()` |

### Tipos exportados

```typescript
import type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
} from "openclaude-sdk"
```

---

## Plan Mode

In `"plan"` permission mode the agent pauses before executing tools and emits a permission request. Use `respondToPermission()` on the `Query` object to approve or deny each request.

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Delete all .log files in /tmp",
  options: {
    permissionMode: "plan",
    cwd: "/tmp",
  },
})

for await (const msg of q) {
  if (msg.type === "assistant" && msg.message?.content) {
    // Agent is asking for permission to use a tool
    const content = msg.message.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          const approved = block.name !== "Bash" // approve everything except Bash
          q.respondToPermission({
            toolUseId: block.id,
            behavior: approved ? "allow" : "deny",
            message: approved ? undefined : "Bash execution not allowed",
          })
        }
      }
    }
  }
}
```

`respondToPermission` serializes a JSON response to the agent's stdin with the shape:

```json
{
  "tool_use_id": "...",
  "behavior": "allow" | "deny",
  "message": "optional denial reason"
}
```

> **Note:** `stdin` is kept open automatically in `plan` mode. It is closed after the initial prompt only in `bypassPermissions` and `dontAsk` modes.

---

## Permission Mid-Stream

When `permissionMode` is `"plan"`, the agent pauses before executing tools and waits for your decision. Call `respondToPermission()` on the `Query` object to approve or deny each request mid-stream.

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Create a new file called hello.txt",
  options: { permissionMode: "plan" },
})

for await (const msg of q) {
  if (msg.type === "assistant" && msg.message?.content) {
    const content = msg.message.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          q.respondToPermission({
            toolUseId: block.id,
            behavior: "allow",
            message: "Approved by automation",
          })
        }
      }
    }
  }
}
```

Key points:

- `permissionMode: "plan"` keeps `stdin` open so responses can be sent during iteration
- `behavior: "deny"` rejects the action — the agent will attempt an alternative approach
- `message` is optional and provides a reason (shown to the agent on denial)

## MCP Tool Factories

MCP tool factories permitem definir tools inline em TypeScript e registrá-las num servidor in-process, sem precisar de um servidor MCP externo separado.

> **Peer dependencies:** `zod` e `@modelcontextprotocol/sdk` devem estar instalados no seu projeto.

### `tool(name, description, inputSchema, handler, extras?)`

```typescript
function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | `string` | Nome da tool (visível ao agente) |
| `description` | `string` | Descrição da tool (usada pelo agente para decidir quando invocar) |
| `inputSchema` | `z.ZodRawShape` | Schema Zod dos parâmetros de entrada |
| `handler` | `(args, extra) => Promise<CallToolResult>` | Função async que executa a tool |
| `extras.annotations` | `ToolAnnotations` | Anotações opcionais de comportamento |

### `createSdkMcpServer(options)`

```typescript
async function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): Promise<McpSdkServerConfig>
```

Retorna um `Promise<McpSdkServerConfig>` com `type: "sdk"` que pode ser passado diretamente em `options.mcpServers`. O servidor roda in-process — sem porta de rede, sem processo filho.

### Exemplo end-to-end

```typescript
import { z } from "zod"
import { tool, createSdkMcpServer, query, collectMessages } from "openclaude-sdk"

// 1. Definir tools
const weatherTool = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text", text: `Weather in ${city}: 22°C, sunny` }],
  }),
)

const timeTool = tool(
  "get_time",
  "Get current time in a timezone",
  { timezone: z.string().describe("IANA timezone") },
  async ({ timezone }) => ({
    content: [{ type: "text", text: `Current time in ${timezone}: ${new Date().toISOString()}` }],
  }),
  { annotations: { readOnly: true } },
)

// 2. Criar servidor in-process
const mcpServer = await createSdkMcpServer({
  name: "my-tools",
  tools: [weatherTool, timeTool],
})

// 3. Usar com query
const q = query({
  prompt: "What's the weather in Tokyo?",
  options: {
    mcpServers: { "my-tools": mcpServer },
  },
})

const { result } = await collectMessages(q)
console.log(result)
```

### `ToolAnnotations`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `readOnly` | `boolean` | Tool apenas lê dados, não modifica estado |
| `destructive` | `boolean` | Tool pode causar efeitos destrutivos |
| `idempotent` | `boolean` | Múltiplas execuções produzem o mesmo resultado |
| `openWorld` | `boolean` | Tool acessa recursos externos (rede, filesystem) |

### Tipos exportados

```typescript
import type {
  SdkMcpToolDefinition,
  ToolAnnotations,
  CallToolResult,
} from "openclaude-sdk"
```

## External MCP Servers

Além de MCP tool factories (inline), o SDK suporta conexão a servidores MCP externos via stdio, SSE e HTTP através do campo `mcpServers` em `Options`.

### Servidor stdio (processo local)

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Search for TypeScript best practices",
  options: {
    mcpServers: {
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/brave-search-mcp"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
    },
  },
})
```

### Servidor SSE com autenticação

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "List recent deployments",
  options: {
    mcpServers: {
      "deploy-api": {
        type: "sse",
        url: "https://mcp.example.com/sse",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      },
    },
  },
})
```

### Servidor HTTP com header de API

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Query the database",
  options: {
    mcpServers: {
      "db-server": {
        type: "http",
        url: "https://mcp.example.com/mcp",
        headers: {
          "X-API-Key": process.env.DB_API_KEY!,
        },
      },
    },
  },
})
```

### Combinando servidores inline e externos

```typescript
import { query, tool, createSdkMcpServer } from "openclaude-sdk"
import { z } from "zod"

// Servidor inline (in-process)
const myTools = await createSdkMcpServer({
  name: "my-tools",
  tools: [
    tool("greet", "Greet a user", { name: z.string() }, async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    })),
  ],
})

const q = query({
  prompt: "Search for news and greet the user",
  options: {
    mcpServers: {
      // Servidor externo via stdio
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/brave-search-mcp"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
      // Servidor inline SDK
      "my-tools": myTools,
    },
  },
})
```

### Tipos de servidor

| Tipo | Interface | Campos | Uso |
|------|-----------|--------|-----|
| `stdio` | `McpStdioServerConfig` | `command`, `args?`, `env?` | Servidores locais via stdin/stdout |
| `sse` | `McpSSEServerConfig` | `url`, `headers?` | Servidores remotos via Server-Sent Events |
| `http` | `McpHttpServerConfig` | `url`, `headers?` | Servidores remotos via HTTP |
| `sdk` | `McpSdkServerConfig` | `name`, `instance` | Servidores inline (via `createSdkMcpServer()`) |

### Variáveis de ambiente em servidores stdio

O campo `env` de um servidor stdio é mesclado ao ambiente do processo filho — as variáveis do processo pai (`process.env`) já estão disponíveis automaticamente. Use `env` para adicionar ou sobrescrever variáveis específicas do servidor, como chaves de API.

## Rich Output

A flag `richOutput` ativa um conjunto de 4 MCP tools built-in que permitem ao modelo emitir **conteúdo visual estruturado** (gráficos, tabelas, produtos, métricas, etc.) como `tool_use` blocks no stream. O cliente detecta esses blocks e os renderiza como widgets ricos.

Quando `richOutput: false` (padrão), nenhum servidor MCP é registrado e o system prompt não é modificado — **zero overhead**.

Quando `richOutput: true`, o SDK automaticamente:
1. Registra um servidor MCP in-process com as 4 display tools
2. Injeta uma instrução curta no system prompt explicando quando usar cada tool

### As 4 meta-tools de display

| Tool | Actions | Propósito |
|------|---------|-----------|
| `display_highlight` | `metric`, `price`, `alert`, `choices` | Destaque de informação pontual |
| `display_collection` | `table`, `spreadsheet`, `comparison`, `carousel`, `gallery`, `sources` | Coleção de itens |
| `display_card` | `product`, `link`, `file`, `image` | Item individual com detalhes |
| `display_visual` | `chart`, `map`, `code`, `progress`, `steps` | Visualização especializada |

Cada tool recebe um campo `action` que seleciona o tipo de conteúdo, mais os campos específicos daquela action.

### Exemplo end-to-end

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Compare the top 3 laptops under $1500 with specs and prices",
  options: {
    richOutput: true,
  },
})

for await (const msg of q) {
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "tool_use" && block.name?.startsWith("display_")) {
        // Bloco de display tool — renderizar como widget rico
        console.log(`[rich] ${block.name}:`, block.input)
      } else if (block.type === "text") {
        console.log(block.text)
      }
    }
  }
}
```

### Validação client-side com `DisplayToolRegistry`

`DisplayToolRegistry` é um `Record<nome, schema>` com os 19 schemas base. Use-o para validar o `input` de um `tool_use` block antes de renderizar:

```typescript
import { DisplayToolRegistry } from "openclaude-sdk"

function handleDisplayBlock(name: string, input: unknown) {
  const schema = DisplayToolRegistry[name as keyof typeof DisplayToolRegistry]
  if (!schema) return // tool desconhecida

  const result = schema.safeParse(input)
  if (!result.success) {
    console.warn(`Invalid display input for ${name}:`, result.error)
    return
  }

  // input validado — despachar para renderer
  render(name, result.data)
}
```

### Schemas exportados

Todos os 19 schemas e tipos estão disponíveis como exports públicos:

```typescript
import {
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
  DisplayToolRegistry,
} from "openclaude-sdk"

import type {
  DisplayMetric,
  DisplayChart,
  DisplayTable,
  DisplayToolName,
} from "openclaude-sdk"
```

### React Rich Output

A flag `reactOutput` estende o Rich Output adicionando a action `react` ao `display_visual`, permitindo que o modelo emita **componentes React funcionais com Framer Motion** que o cliente transpila e renderiza como widgets animados.

`reactOutput` só tem efeito quando `richOutput` também está ativo — caso contrário é ignorado silenciosamente (sem warn, sem erro).

#### Gate das duas flags

| `richOutput` | `reactOutput` | Resultado |
|---|---|---|
| `false` / ausente | qualquer | Nada injetado — zero overhead |
| `true` | `false` / ausente | Display tools ativas **sem** action `react` |
| `true` | `true` | Display tools ativas **com** action `react` + system prompt React |

#### Exemplo end-to-end

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Monta um dashboard animado com 4 KPIs de vendas e um chart de linha",
  options: {
    richOutput: true,
    reactOutput: true,
  },
})

for await (const msg of q) {
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "tool_use" && block.name === "display_visual") {
        const input = block.input as { action: string }
        if (input.action === "react") {
          console.log("[react payload]", input)
          // host: validate -> transpile -> sandbox -> render
        }
      }
    }
  }
}
```

#### Pipeline obrigatório do cliente

O SDK **não renderiza** — apenas transmite o payload. O host é responsável por seguir este pipeline antes de montar o componente:

1. **VALIDATE** — `version === "1"`, todos os `imports[].module` na whitelist (`react` | `framer-motion`), nenhum import no `code` fora dos declarados em `imports`, `code.length <= 8 KB`, `JSON.stringify(initialProps).length <= 32 KB`.

2. **TRANSPILE** — Use Babel standalone com preset `["react"]` (+ `"typescript"` se `language === "tsx"`), ou sucrase com transforms `["jsx", "typescript"]`. Extrai o `export default`.

3. **SANDBOX** — Renderize dentro de um `<iframe sandbox="allow-scripts">` em origin distinto, ou shadow DOM com escopo restrito.

4. **INJECT SCOPE** — Forneça apenas `react` e `framer-motion` como resolver de módulos. Qualquer outro import deve lançar erro em tempo de resolução.

5. **RENDER** — Monte como `<Component {...payload.initialProps} />` dentro de um error boundary. Envolva em `<MotionConfig reducedMotion="user">`. Respeite `layout.height` / `layout.aspectRatio` no container.

6. **THEME** — Se `payload.theme` estiver definido, exponha as variáveis CSS (`--fg`, `--bg`, `--accent`, `--muted`) no container host antes de montar.

> **Nota de segurança:** O passo 3 (sandbox) é **obrigatório**. Avaliar código gerado por LLM no origin principal com acesso a dados do usuário é uma vulnerabilidade crítica. Hosts que pulam o sandbox expõem usuários a execução arbitrária de código.

### Ask User

Enable `askUser` to let the agent pause and ask the user structured questions mid-task:

```typescript
import { query } from "openclaude-sdk"
import type { AskUserRequest } from "openclaude-sdk"

const q = query({
  prompt: "Book a meeting for next week with the marketing team",
  options: { askUser: true },
})

q.onAskUser((req: AskUserRequest) => {
  console.log(`[agent asks] ${req.question}`)

  if (req.inputType === "choice" && req.choices) {
    q.respondToAskUser(req.callId, { type: "choice", id: req.choices[0].id })
  } else {
    q.respondToAskUser(req.callId, { type: "text", value: "Tuesday 2pm" })
  }
})

for await (const msg of q) {
  // process messages...
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `askUser` | `boolean` | `false` | Enable the ask_user built-in tool |
| `askUserTimeoutMs` | `number` | `undefined` | Auto-cancel unanswered questions after N ms |

**Input types:**

| inputType | Answer type | When to use |
|-----------|-------------|-------------|
| `text` | `{ type: "text", value: string }` | Free-form text input |
| `number` | `{ type: "number", value: number }` | Numeric values |
| `boolean` | `{ type: "boolean", value: boolean }` | Yes/no confirmations |
| `choice` | `{ type: "choice", id: string }` | Discrete options (requires `choices` array) |

To cancel a pending question:

```typescript
q.respondToAskUser(req.callId, { type: "cancelled" })
```

`askUser` and `richOutput` are orthogonal — both can be enabled simultaneously.
