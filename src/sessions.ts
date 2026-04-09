// ---------------------------------------------------------------------------
// Session management — espelha @anthropic-ai/claude-agent-sdk
// ---------------------------------------------------------------------------

import { readdir, stat, readFile, appendFile, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { homedir } from "node:os"
import type {
  SDKSessionInfo,
  ListSessionsOptions,
  GetSessionMessagesOptions,
  GetSessionInfoOptions,
  SessionMutationOptions,
  SessionMessage,
} from "./types/sessions.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash djb2 de 32 bits em base36 — compativel com _simple_hash() do Python SDK */
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  let n = Math.abs(h)
  if (n === 0) return "0"
  let out = ""
  while (n > 0) {
    out = "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36] + out
    n = Math.floor(n / 36)
  }
  return out
}

const SANITIZE_RE = /[^a-zA-Z0-9]/g
const MAX_SANITIZED_LENGTH = 200

/** Sanitiza um path para nome de diretorio de sessao — alinhado com _sanitize_path() do Python SDK */
function sanitizePath(name: string): string {
  const sanitized = name.replace(SANITIZE_RE, "-")
  if (sanitized.length > MAX_SANITIZED_LENGTH) {
    return sanitized.slice(0, MAX_SANITIZED_LENGTH) + "-" + simpleHash(name)
  }
  return sanitized
}

function getProjectsDir(): string {
  return join(homedir(), ".claude", "projects")
}

function getSessionDir(dir?: string): string {
  if (dir) {
    return join(getProjectsDir(), sanitizePath(resolve(dir)))
  }
  return getProjectsDir()
}

async function findSessionFile(
  projectsDir: string,
  sessionId: string,
): Promise<string | null> {
  // Try root first
  const rootPath = join(projectsDir, `${sessionId}.jsonl`)
  try {
    await stat(rootPath)
    return rootPath
  } catch {
    // not found at root
  }

  // Iterate subdirectories
  let entries: string[]
  try {
    entries = await readdir(projectsDir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const entryPath = join(projectsDir, entry)
    try {
      const s = await stat(entryPath)
      if (!s.isDirectory()) continue
      const candidate = join(entryPath, `${sessionId}.jsonl`)
      await stat(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return null
}

async function readSessionFile(
  filePath: string,
): Promise<{
  messages: unknown[]
  sessionId: string
  firstPrompt?: string
  customTitle?: string
  tag?: string
}> {
  const content = await readFile(filePath, "utf-8")
  const lines = content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean) as unknown[]

  let sessionId = ""
  let firstPrompt: string | undefined
  let customTitle: string | undefined
  let tag: string | undefined

  for (const line of lines) {
    const obj = line as Record<string, unknown>
    if (obj.type === "system" && obj.subtype === "init" && obj.session_id) {
      sessionId = obj.session_id as string
    }
    if (obj.type === "user" && !firstPrompt) {
      const msg = obj.message as { content?: unknown } | undefined
      if (msg?.content && typeof msg.content === "string") {
        firstPrompt = msg.content
      }
    }
    if (obj.type === "custom_title") {
      customTitle = (obj as { title?: string }).title
    }
    if (obj.type === "tag") {
      tag = (obj as { tag?: string }).tag ?? undefined
    }
  }

  return { messages: lines, sessionId, firstPrompt, customTitle, tag }
}

// ---------------------------------------------------------------------------
// listSessions()
// ---------------------------------------------------------------------------

async function listSessionsInDir(
  baseDir: string,
  cwd?: string,
): Promise<SDKSessionInfo[]> {
  let files: string[]
  try {
    const entries = await readdir(baseDir)
    files = entries.filter((f) => f.endsWith(".jsonl"))
  } catch {
    return []
  }

  const sessions: SDKSessionInfo[] = []

  for (const file of files) {
    const filePath = join(baseDir, file)
    try {
      const fileStat = await stat(filePath)
      const { sessionId, firstPrompt, customTitle, tag } =
        await readSessionFile(filePath)

      sessions.push({
        sessionId: sessionId || file.replace(".jsonl", ""),
        summary: customTitle || firstPrompt || "(sem titulo)",
        lastModified: fileStat.mtimeMs,
        fileSize: fileStat.size,
        customTitle,
        firstPrompt,
        cwd,
        tag,
        createdAt: fileStat.birthtimeMs,
      })
    } catch {
      // Arquivo ilegivel, pular
    }
  }

  return sessions
}

export async function listSessions(
  options: ListSessionsOptions = {},
): Promise<SDKSessionInfo[]> {
  const projectsDir = getProjectsDir()
  const deep = options.deep !== false && !options.dir

  let sessions: SDKSessionInfo[]

  if (options.dir) {
    // Busca apenas no diretorio especificado
    const baseDir = join(projectsDir, sanitizePath(resolve(options.dir)))
    sessions = await listSessionsInDir(baseDir, options.dir)
  } else if (deep) {
    // Itera todos os subdiretorios sequencialmente
    sessions = []
    let subdirs: string[]
    try {
      const entries = await readdir(projectsDir)
      subdirs = []
      for (const entry of entries) {
        const entryPath = join(projectsDir, entry)
        try {
          const s = await stat(entryPath)
          if (s.isDirectory()) {
            subdirs.push(entry)
          }
        } catch {
          // ignorar
        }
      }
    } catch {
      subdirs = []
    }
    for (const subdir of subdirs) {
      const dirSessions = await listSessionsInDir(join(projectsDir, subdir))
      sessions.push(...dirSessions)
    }
  } else {
    // deep: false — busca apenas no root
    sessions = await listSessionsInDir(projectsDir)
  }

  // Ordenar por lastModified desc
  sessions.sort((a, b) => b.lastModified - a.lastModified)

  if (options.limit) {
    return sessions.slice(0, options.limit)
  }

  return sessions
}

// ---------------------------------------------------------------------------
// getSessionMessages()
// ---------------------------------------------------------------------------

export async function getSessionMessages(
  sessionId: string,
  options: GetSessionMessagesOptions = {},
): Promise<SessionMessage[]> {
  const projectsDir = getProjectsDir()
  let filePath: string

  if (options.dir) {
    filePath = join(projectsDir, sanitizePath(resolve(options.dir)), `${sessionId}.jsonl`)
  } else {
    const found = await findSessionFile(projectsDir, sessionId)
    if (!found) return []
    filePath = found
  }

  let data: { messages: unknown[] }
  try {
    data = await readSessionFile(filePath)
  } catch {
    return []
  }

  const sessionMessages: SessionMessage[] = data.messages
    .filter((m) => {
      const obj = m as { type?: string }
      return obj.type === "user" || obj.type === "assistant"
    })
    .map((m) => {
      const obj = m as Record<string, unknown>
      return {
        type: obj.type as "user" | "assistant",
        uuid: (obj.uuid as string) || "",
        session_id: (obj.session_id as string) || sessionId,
        message: obj.message,
        parent_tool_use_id: null,
      }
    })

  const offset = options.offset ?? 0
  const sliced = sessionMessages.slice(offset)

  if (options.limit) {
    return sliced.slice(0, options.limit)
  }

  return sliced
}

// ---------------------------------------------------------------------------
// getSessionInfo()
// ---------------------------------------------------------------------------

export async function getSessionInfo(
  sessionId: string,
  options: GetSessionInfoOptions = {},
): Promise<SDKSessionInfo | undefined> {
  const sessions = await listSessions({ dir: options.dir })
  return sessions.find((s) => s.sessionId === sessionId)
}

// ---------------------------------------------------------------------------
// renameSession()
// ---------------------------------------------------------------------------

export async function renameSession(
  sessionId: string,
  title: string,
  options: SessionMutationOptions = {},
): Promise<void> {
  const baseDir = options.dir
    ? join(getProjectsDir(), sanitizePath(resolve(options.dir)))
    : getProjectsDir()

  const filePath = join(baseDir, `${sessionId}.jsonl`)
  const entry = JSON.stringify({ type: "custom_title", title: title.trim() })
  await appendFile(filePath, "\n" + entry)
}

// ---------------------------------------------------------------------------
// tagSession()
// ---------------------------------------------------------------------------

export async function tagSession(
  sessionId: string,
  tag: string | null,
  options: SessionMutationOptions = {},
): Promise<void> {
  const baseDir = options.dir
    ? join(getProjectsDir(), sanitizePath(resolve(options.dir)))
    : getProjectsDir()

  const filePath = join(baseDir, `${sessionId}.jsonl`)
  const entry = JSON.stringify({ type: "tag", tag })
  await appendFile(filePath, "\n" + entry)
}
