// ---------------------------------------------------------------------------
// Gerenciamento de subprocesso openclaude e parse de JSONL
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "node:child_process"
import { createInterface } from "node:readline"
import type { SDKMessage } from "./types/index.js"
import type { Options } from "./types/options.js"

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
    args.push("--allowedTools", options.allowedTools.join(","))
  }

  // Disallowed tools
  if (options.disallowedTools && options.disallowedTools.length > 0) {
    args.push("--disallowedTools", options.disallowedTools.join(","))
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

export async function* spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: {
    cwd?: string
    env?: Record<string, string | undefined>
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
): AsyncGenerator<SDKMessage> {
  const childEnv = {
    ...process.env,
    ...(options.env as Record<string, string>),
  }

  // No Windows, spawn via cmd /c para evitar ENOENT
  const spawnCmd =
    process.platform === "win32"
      ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
      : command
  const spawnArgs =
    process.platform === "win32" ? ["/c", command, ...args] : args

  const proc: ChildProcess = spawn(spawnCmd, spawnArgs, {
    cwd: options.cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...childEnv,
      ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
    },
  })

  // Abort handling
  const onAbort = () => proc.kill("SIGTERM")
  options.signal?.addEventListener("abort", onAbort, { once: true })

  // Timeout
  let timer: ReturnType<typeof setTimeout> | undefined
  if (options.timeoutMs) {
    timer = setTimeout(() => proc.kill("SIGTERM"), options.timeoutMs)
  }

  // Enviar prompt via stdin
  proc.stdin?.write(prompt)
  proc.stdin?.end()

  // Coletar stderr (nao bloqueia)
  let stderr = ""
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  // Parse JSONL do stdout
  if (proc.stdout) {
    const rl = createInterface({ input: proc.stdout })

    try {
      for await (const line of rl) {
        if (options.signal?.aborted) break

        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed) as SDKMessage
          yield parsed
        } catch {
          // Linha nao-JSON — debug output do CLI, ignorar
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
  options.signal?.removeEventListener("abort", onAbort)

  if (stderr && !options.signal?.aborted) {
    process.stderr.write(`[openclaude stderr] ${stderr.substring(0, 500)}\n`)
  }
}
