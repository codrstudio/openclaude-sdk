# Query Methods Design

## Goal

Add a first batch of `Query` methods whose protocol is already clear and whose
responses are explicitly structured.

This batch includes:

- `initializationResult()`
- `supportedCommands()`
- `supportedModels()`
- `supportedAgents()`
- `accountInfo()`
- `mcpServerStatus()`

This batch intentionally excludes fire-and-forget control methods such as
`setModel()` and `setPermissionMode()`, and excludes operations whose response
shape still needs investigation.

## Scope

### In scope

- Extend `Query` with the six methods above
- Cache initialization data for repeated reads
- Add control request/response routing for methods with structured replies
- Export the minimal new types required by the public API
- Keep existing streaming behavior for normal `SDKMessage` events

### Out of scope

- `setModel()`
- `setPermissionMode()`
- `setMaxThinkingTokens()`
- `rewindFiles()`
- `reconnectMcpServer()`
- `toggleMcpServer()`
- `setMcpServers()`
- `streamInput()`
- `stopTask()`
- Any generic control-protocol layer broader than what this batch needs

## Recommended Approach

Use a lightweight control dispatcher inside `query()`:

1. Capture and cache initialization data once
2. Track pending control requests in a `Map`
3. Route control responses to waiting promises
4. Continue yielding ordinary SDK stream messages unchanged

This is preferred over a one-off implementation because:

- `supportedCommands()`, `supportedModels()`, `supportedAgents()`, and `accountInfo()` can all be served from the same cached initialization result
- `mcpServerStatus()` can use the same request/response plumbing without forcing a broader runtime rewrite
- It leaves a clean path for later control-method expansion

## Public API

Extend `Query` with:

```ts
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
  close(): void
  respondToPermission(response: PermissionResponse): void

  initializationResult(): Promise<SDKControlInitializeResponse>
  supportedCommands(): Promise<SlashCommand[]>
  supportedModels(): Promise<ModelInfo[]>
  supportedAgents(): Promise<AgentInfo[]>
  accountInfo(): Promise<AccountInfo>
  mcpServerStatus(): Promise<McpServerStatus[]>
}
```

## Types

Add and export the following public types:

- `SDKControlInitializeResponse`
- `SlashCommand`
- `ModelInfo`
- `AgentInfo`
- `AccountInfo`
- `McpServerStatus`

Source of truth for shape should follow the reference OpenClaude control/core
schemas closely enough to avoid inventing new public structures.

## Runtime Design

### 1. Initialization cache

`query()` should create an internal promise for initialization data.

Behavior:

- Resolve when initialization data is observed
- Cache the resolved value for subsequent method calls
- Reject if the process exits before initialization completes

Method mapping:

- `initializationResult()` returns the cached initialization structure
- `supportedCommands()` returns `initializationResult().commands`
- `supportedModels()` returns `initializationResult().models`
- `supportedAgents()` returns `initializationResult().agents`
- `accountInfo()` returns `initializationResult().account`

### 2. Pending control requests

Create an internal structure such as:

```ts
type PendingControlRequest = {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  subtype: string
}
```

Managed via:

```ts
const pendingControlRequests = new Map<string, PendingControlRequest>()
```

This batch only needs this for `mcpServerStatus()`, but the shape should be
generic enough for later response-bearing methods.

### 3. Request format

`mcpServerStatus()` sends a structured control request over stdin.

Planned payload shape:

```json
{
  "type": "control_request",
  "id": "<generated-id>",
  "subtype": "mcp_status"
}
```

If implementation confirms the CLI uses a slightly different envelope, follow
the CLI exactly. The SDK must adapt to the real protocol rather than preserve
the provisional example above verbatim.

### 4. Response routing

The stdout stream must distinguish:

- ordinary `SDKMessage` events
- control responses

Handling rules:

- Ordinary SDK messages continue through the async generator unchanged
- Control responses are consumed internally and must not be yielded as normal
  user-facing stream messages
- Matching responses resolve the corresponding pending request by `id`
- Unknown control responses are ignored or surfaced as internal errors, but
  must not corrupt the SDK message stream

### 5. Process shutdown behavior

If the child process exits, aborts, or errors:

- reject all pending control requests
- reject the initialization promise if unresolved
- preserve current stream termination semantics

This avoids dangling promises on `mcpServerStatus()` or initialization readers.

## File-Level Changes

### `src/query.ts`

- Extend the `Query` interface
- Add initialization caching
- Add control request registration and promise lifecycle handling
- Add the six public methods
- Keep `interrupt()`, `close()`, and `respondToPermission()` behavior unchanged

### `src/process.ts`

- Extend stream parsing so control responses can be separated from ordinary
  `SDKMessage` output
- Preserve existing stdout JSONL handling for normal messages
- Do not break current permission-response flow

### `src/types/`

- Add a dedicated file or extend an existing one for control-response types
- Re-export the new public types from `src/index.ts`

## Error Handling

Method-level behavior:

- Calling a query method after process exit rejects with a clear error
- Calling initialization-derived methods before init completes waits instead of
  failing immediately
- Malformed control responses reject the corresponding method call
- `mcpServerStatus()` should reject if the CLI never returns a matching response

For this first batch, a bounded timeout for response-bearing control requests is
acceptable if needed, but only if it is implemented as an internal safeguard
and documented.

## Testing

Add tests that cover:

- initialization result is cached and reused
- `supportedCommands()`, `supportedModels()`, `supportedAgents()`, and
  `accountInfo()` all derive from the cached initialization data
- `mcpServerStatus()` sends the expected control request and resolves from the
  matching response
- pending control requests reject when the subprocess exits
- normal SDK messages continue to stream correctly while control responses are
  consumed internally

Use focused tests around `query()` and the stream/control boundary. Avoid
bundling in fire-and-forget methods during this phase.

## Acceptance Criteria

- The six selected methods exist on `Query`
- Public types compile and export cleanly
- `npm run typecheck` passes
- `npm run build` passes
- Existing query streaming behavior remains intact
- `mcpServerStatus()` works through a real request/response path

## Follow-up Work

Once this batch is stable, the next batch should target:

- `setModel()`
- `setPermissionMode()`
- `setMaxThinkingTokens()`

Those methods can reuse the same internal dispatcher, but they should be added
only after confirming whether the CLI treats them as acknowledged requests or
fire-and-forget writes.
