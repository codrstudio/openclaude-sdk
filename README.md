# openclaude-sdk

TypeScript SDK wrapper for the OpenClaude CLI.

## Installation

```bash
npm install openclaude-sdk
```

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

| Method | Description |
|--------|-------------|
| `interrupt(): Promise<void>` | Gracefully interrupt the running agent |
| `close(): void` | Immediately terminate the subprocess |
| `respondToPermission(response: PermissionResponse): void` | Respond to a tool permission request (plan mode) |

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
| `env` | `Record<string, string>` | Additional environment variables for the subprocess |
| `pathToClaudeCodeExecutable` | `string` | Override the path to the OpenClaude executable (default: `"openclaude"`) |

---

## Error Handling

`collectMessages()` throws typed errors when the agent terminates abnormally. Use `isRecoverable()` to decide whether to retry.

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
import { createOpenRouterRegistry, query, collectMessages } from "openclaude-sdk"

const registry = createOpenRouterRegistry({
  apiKey: process.env.OPENROUTER_API_KEY!,
  models: [
    {
      id: "anthropic/claude-3.5-sonnet",
      label: "Claude 3.5 Sonnet",
      contextWindow: 200000,
    },
    {
      id: "openai/gpt-4o",
      label: "GPT-4o",
      contextWindow: 128000,
    },
  ],
})

const q = query({
  prompt: "Summarize this codebase",
  model: "anthropic/claude-3.5-sonnet",
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
