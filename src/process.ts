// ---------------------------------------------------------------------------
// Gerenciamento de subprocesso openclaude e parse de JSONL
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "node:child_process"
import { createInterface } from "node:readline"
import type { SDKMessage } from "./types/index.js"
import type { Options, McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig } from "./types/options.js"

export interface ControlResponseEnvelope {
  type: "control_response"
  response: {
    subtype: string
    request_id: string
    response?: unknown
    [key: string]: unknown
  }
}

function createAsyncQueue<T>(): {
  push: (value: T) => void
  close: () => void
  stream: AsyncGenerator<T>
} {
  const values: T[] = []
  const waiters: Array<(result: IteratorResult<T>) => void> = []
  let closed = false

  return {
    push(value: T) {
      if (closed) return
      const waiter = waiters.shift()
      if (waiter) {
        waiter({ value, done: false })
        return
      }
      values.push(value)
    },
    close() {
      if (closed) return
      closed = true
      while (waiters.length > 0) {
        const waiter = waiters.shift()
        waiter?.({ value: undefined, done: true })
      }
    },
    async *stream(): AsyncGenerator<T> {
      while (true) {
        if (values.length > 0) {
          yield values.shift() as T
          continue
        }
        if (closed) {
          return
        }
        const result = await new Promise<IteratorResult<T>>((resolve) => {
          waiters.push(resolve)
        })
        if (result.done) {
          return
        }
        yield result.value
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Resolver executavel do CLI considerando a plataforma
// ---------------------------------------------------------------------------

export function resolveExecutable(options?: Options): {
  command: string
  prependArgs: string[]
} {
  const base = options?.pathToClaudeCodeExecutable || "openclaude"

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", base],
    }
  }

  return { command: base, prependArgs: [] }
}

// ---------------------------------------------------------------------------
// Filtrar valores undefined de um env parcial
// ---------------------------------------------------------------------------

function filterEnv(env: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Construir args do CLI a partir de Options
// ---------------------------------------------------------------------------

export function buildCliArgs(options: Options = {}): string[] {
  const args = ["-p", "-", "--verbose"]

  // Output format
  if (options.outputFormat?.type === "json_schema") {
    args.push("--output-format", "json-schema")
    args.push("--json-schema", JSON.stringify(options.outputFormat.schema))
  } else {
    args.push("--output-format", "stream-json")
  }

  // Permissions
  if (options.allowDangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions")
  } else if (options.permissionMode) {
    args.push("--permission-mode", options.permissionMode)
  }

  // Session
  if (options.resume) {
    args.push("--resume", options.resume)
  } else if (options.continue) {
    args.push("--continue")
  }

  if (options.sessionId) {
    args.push("--session-id", options.sessionId)
  }

  // System prompt
  if (options.systemPrompt) {
    if (typeof options.systemPrompt === "string") {
      args.push("--system-prompt", options.systemPrompt)
    } else if (options.systemPrompt.append) {
      args.push("--append-system-prompt", options.systemPrompt.append)
    }
  }

  // Allowed tools
  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push("--allowed-tools", options.allowedTools.join(","))
  }

  // Disallowed tools
  if (options.disallowedTools && options.disallowedTools.length > 0) {
    args.push("--disallowed-tools", options.disallowedTools.join(","))
  }

  // Model
  if (options.model) {
    args.push("--model", options.model)
  }

  // Max turns
  if (options.maxTurns != null) {
    args.push("--max-turns", String(options.maxTurns))
  }

  // CWD — passed via spawn options, not as CLI flag

  // Additional directories
  if (options.additionalDirectories) {
    for (const dir of options.additionalDirectories) {
      args.push("--add-dir", dir)
    }
  }

  // Betas
  if (options.betas) {
    for (const beta of options.betas) {
      args.push("--beta", beta)
    }
  }

  // Effort
  if (options.effort) {
    args.push("--effort", options.effort)
  }

  // Thinking
  if (options.thinking?.type === "enabled") {
    args.push("--thinking", "enabled")
  } else if (options.thinking?.type === "disabled") {
    args.push("--thinking", "disabled")
  }

  // Max budget
  if (options.maxBudgetUsd != null) {
    args.push("--max-budget-usd", String(options.maxBudgetUsd))
  }

  // Debug
  if (options.debug) {
    args.push("--debug")
  }

  // MCP Servers
  if (options.mcpServers) {
    for (const [name, config] of Object.entries(options.mcpServers)) {
      if (!config.type || config.type === "stdio") {
        const stdio = config as McpStdioServerConfig
        const parts = [stdio.command, ...(stdio.args ?? [])]
        args.push("--mcp-server", `${name}:${parts.join(" ")}`)
      } else if (config.type === "sse" || config.type === "http") {
        const remote = config as McpSSEServerConfig | McpHttpServerConfig
        args.push("--mcp-server-sse", `${name}:${remote.url}`)
      }
    }
  }

  // Extra args — added last to allow override of any earlier flag
  if (options.extraArgs) {
    for (const [key, value] of Object.entries(options.extraArgs)) {
      args.push(`--${key}`)
      if (value !== null) {
        args.push(value)
      }
    }
  }

  return args
}

// ---------------------------------------------------------------------------
// Spawn do processo e stream de eventos JSONL
// ---------------------------------------------------------------------------

export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: {
    cwd?: string
    env?: Record<string, string | undefined>
    signal?: AbortSignal
    timeoutMs?: number
    permissionMode?: string
  } = {},
): {
  stream: AsyncGenerator<SDKMessage>
  controlResponses: AsyncGenerator<ControlResponseEnvelope>
  writeStdin: (data: string) => void
  close: () => void
} {
  const childEnv = {
    ...filterEnv(process.env as Record<string, string | undefined>),
    ...(options.env ? filterEnv(options.env) : {}),
  }

  const proc: ChildProcess = spawn(command, args, {
    cwd: options.cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...childEnv,
      ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
    },
  })

  // Abort handling
  let sigintFallbackTimer: ReturnType<typeof setTimeout> | undefined
  const onAbort = () => {
    if (process.platform === "win32") {
      proc.stdin?.write("\x03")
    } else {
      proc.kill("SIGINT")
    }
    // Fallback: if process hasn't exited in 5s, escalate to SIGTERM
    sigintFallbackTimer = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null) {
        proc.kill("SIGTERM")
      }
    }, 5000)
  }
  options.signal?.addEventListener("abort", onAbort, { once: true })

  // Timeout
  let timer: ReturnType<typeof setTimeout> | undefined
  if (options.timeoutMs) {
    timer = setTimeout(() => proc.kill("SIGTERM"), options.timeoutMs)
  }

  // Enviar prompt via stdin
  // Em plan mode (nem bypassPermissions nem dontAsk), manter stdin aberto para
  // receber respostas de permissao posteriores via writeStdin()
  const closeAfterPrompt =
    options.permissionMode === "bypassPermissions" ||
    options.permissionMode === "dontAsk"
  proc.stdin?.write(prompt + "\n")
  if (closeAfterPrompt) {
    proc.stdin?.end()
  }

  function writeStdin(data: string): void {
    if (proc.exitCode !== null || proc.killed) {
      throw new Error("writeStdin: process has already exited")
    }
    proc.stdin?.write(data)
  }

  function close(): void {
    proc.kill("SIGTERM")
  }

  const controlQueue = createAsyncQueue<ControlResponseEnvelope>()

  async function* streamGen(): AsyncGenerator<SDKMessage> {
    // Coletar stderr (nao bloqueia)
    let stderr = ""
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // Parse JSONL do stdout
    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout })

      let jsonBuffer = ""
      const MAX_BUFFER_SIZE = 1_048_576 // 1MB

      try {
        for await (const line of rl) {
          if (options.signal?.aborted) break

          const trimmed = line.trim()
          if (!trimmed) continue

          // Skip non-JSON lines when not mid-parse (e.g. [SandboxDebug])
          if (!jsonBuffer && !trimmed.startsWith("{")) continue

          jsonBuffer += trimmed

          if (jsonBuffer.length > MAX_BUFFER_SIZE) {
            jsonBuffer = ""
            throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
          }

          try {
            const parsed = JSON.parse(jsonBuffer) as SDKMessage | ControlResponseEnvelope
            jsonBuffer = ""
            if (parsed.type === "control_response") {
              controlQueue.push(parsed)
              continue
            }
            yield parsed
          } catch {
            // Partial JSON — continue accumulating
            continue
          }
        }
      } catch (err) {
        if (!options.signal?.aborted) {
          throw new Error(`Stream read error: ${err}`)
        }
      }
    }

    // Aguardar exit do processo
    await new Promise<void>((resolve) => {
      proc.on("exit", () => resolve())
      proc.on("error", () => resolve())
    })

    if (timer) clearTimeout(timer)
    if (sigintFallbackTimer) clearTimeout(sigintFallbackTimer)
    options.signal?.removeEventListener("abort", onAbort)
    controlQueue.close()

    if (stderr && !options.signal?.aborted) {
      process.stderr.write(`[openclaude stderr] ${stderr.substring(0, 500)}\n`)
    }
  }

  return { stream: streamGen(), controlResponses: controlQueue.stream(), writeStdin, close }
}
