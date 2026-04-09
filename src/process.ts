// ---------------------------------------------------------------------------
// Gerenciamento de subprocesso openclaude e parse de JSONL
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "node:child_process"
import { createInterface } from "node:readline"
import type { SDKMessage } from "./types/index.js"
import type { Options, McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig } from "./types/options.js"

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
    } else {
      if ("type" in options.systemPrompt && options.systemPrompt.type === "preset") {
        args.push("--system-prompt-preset", options.systemPrompt.preset)
      }
      if (options.systemPrompt.append) {
        args.push("--append-system-prompt", options.systemPrompt.append)
      }
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
  if (options.thinking?.type) {
    args.push("--thinking", options.thinking.type)
  }

  // Max budget
  if (options.maxBudgetUsd != null) {
    args.push("--max-budget-usd", String(options.maxBudgetUsd))
  }

  // Debug
  if (options.debug) {
    args.push("--debug")
  }

  // Agent
  if (options.agent) {
    args.push("--agent", options.agent)
  }

  // Agents config
  if (options.agents && Object.keys(options.agents).length > 0) {
    args.push("--agents-config", JSON.stringify(options.agents))
  }

  // Fallback model
  if (options.fallbackModel) {
    args.push("--fallback-model", options.fallbackModel)
  }

  // Fork session
  if (options.forkSession) {
    args.push("--fork-session")
  }

  // Include partial messages
  if (options.includePartialMessages) {
    args.push("--include-partial-messages")
  }

  // Max thinking tokens
  if (options.maxThinkingTokens != null) {
    args.push("--max-thinking-tokens", String(options.maxThinkingTokens))
  }

  // Permission prompt tool name
  if (options.permissionPromptToolName) {
    args.push("--permission-prompt-tool-name", options.permissionPromptToolName)
  }

  // Persist session
  if (options.persistSession) {
    args.push("--persist-session")
  }

  // Prompt suggestions (inverted: false means --no-prompt-suggestions)
  if (options.promptSuggestions === false) {
    args.push("--no-prompt-suggestions")
  }

  // Resume session at
  if (options.resumeSessionAt) {
    args.push("--resume-session-at", options.resumeSessionAt)
  }

  // Setting sources
  if (options.settingSources && options.settingSources.length > 0) {
    args.push("--setting-sources", options.settingSources.join(","))
  }

  // Tools
  if (options.tools) {
    if (Array.isArray(options.tools)) {
      args.push("--tools", options.tools.join(","))
    } else if (options.tools.type === "preset") {
      args.push("--tools-preset", options.tools.preset)
    }
  }

  // MCP Servers
  if (options.mcpServers) {
    for (const [name, config] of Object.entries(options.mcpServers)) {
      if (config.type === "sdk") {
        if (config._localPort == null) {
          throw new Error(
            `SDK MCP server "${config.name}" has no local transport. Call startSdkServerTransport() before spawning the CLI.`,
          )
        }
        args.push("--mcp-server-sse", `${config.name}:http://localhost:${config._localPort}/mcp`)
        continue
      } else if (!config.type || config.type === "stdio") {
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
// Helper: split de JSONs concatenados na mesma linha
// ---------------------------------------------------------------------------

function splitConcatenatedJson(text: string): object[] | null {
  const objects: object[] = []
  let depth = 0
  let start = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === "\\") {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        try {
          objects.push(JSON.parse(slice))
        } catch {
          return null // parse failure — not valid concatenated JSON
        }
      }
    }
  }

  // If depth != 0, text contains incomplete JSON
  if (depth !== 0) return null

  return objects.length > 1 ? objects : null
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
  writeStdin: (data: string) => void
  close: () => Promise<void>
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
  let shutdownFallbackTimer: ReturnType<typeof setTimeout> | undefined
  const onAbort = () => {
    // Stage 1: close stdin (signals EOF to CLI for graceful save)
    stdinClosed = true
    proc.stdin?.end()

    let sigkillTimer: ReturnType<typeof setTimeout> | undefined

    // Limpar timers quando o processo sair
    proc.once("exit", () => {
      if (shutdownFallbackTimer) clearTimeout(shutdownFallbackTimer)
      if (sigkillTimer) clearTimeout(sigkillTimer)
    })

    // Stage 2: after 5s without exit, escalate to SIGTERM
    shutdownFallbackTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill("SIGTERM")

        // Stage 3: after 5s without exit, escalate to SIGKILL
        sigkillTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            proc.kill("SIGKILL")
          }
        }, 5000)
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
  let stdinClosed = false
  proc.stdin?.write(prompt + "\n")
  if (closeAfterPrompt) {
    stdinClosed = true
    proc.stdin?.end()
  }

  function writeStdin(data: string): void {
    if (stdinClosed) {
      throw new Error("writeStdin: stdin already closed")
    }
    if (proc.exitCode !== null || proc.killed) {
      throw new Error("writeStdin: process has already exited")
    }
    proc.stdin?.write(data)
  }

  function close(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Processo ja encerrado: resolver imediatamente
      if (proc.exitCode !== null) {
        resolve()
        return
      }

      // Estagio 1: fechar stdin (sinaliza EOF ao CLI)
      stdinClosed = true
      proc.stdin?.end()

      let sigtermTimer: ReturnType<typeof setTimeout> | undefined
      let sigkillTimer: ReturnType<typeof setTimeout> | undefined

      // Limpar timers e resolver quando o processo sair
      proc.once("exit", () => {
        if (sigtermTimer) clearTimeout(sigtermTimer)
        if (sigkillTimer) clearTimeout(sigkillTimer)
        resolve()
      })

      // Estagio 2: apos 5s sem exit, enviar SIGTERM
      sigtermTimer = setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill("SIGTERM")

          // Estagio 3: apos mais 5s, enviar SIGKILL
          sigkillTimer = setTimeout(() => {
            if (proc.exitCode === null) {
              proc.kill("SIGKILL")
            }
          }, 5000)
        }
      }, 5000)
    })
  }

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
            const parsed = JSON.parse(jsonBuffer) as SDKMessage
            jsonBuffer = ""
            yield parsed
          } catch {
            // Try splitting concatenated JSONs before continuing accumulation
            const parts = splitConcatenatedJson(jsonBuffer)
            if (parts) {
              jsonBuffer = ""
              for (const obj of parts) {
                yield obj as SDKMessage
              }
            }
            // else: partial JSON — continue accumulating
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
    if (shutdownFallbackTimer) clearTimeout(shutdownFallbackTimer)
    options.signal?.removeEventListener("abort", onAbort)

    if (stderr && !options.signal?.aborted) {
      process.stderr.write(`[openclaude stderr] ${stderr.substring(0, 500)}\n`)
    }
  }

  return { stream: streamGen(), writeStdin, close }
}
