# PRP-016 — Session Deep Search & Delete

## Objetivo

Corrigir `getSessionMessages()` para fazer deep search em subdiretorios quando `dir` nao e fornecido, e adicionar `deleteSession()` para completar o CRUD de sessions.

Referencia: specs S-018 (D-031) e S-022 (D-034).

## Execution Mode

`implementar`

## Contexto

O modulo de sessions (`src/sessions.ts`) tem uma assimetria: `listSessions()` faz deep search por padrao (itera subdiretorios de `~/.claude/projects/`), mas `getSessionMessages()` so busca na raiz. O fluxo natural esta quebrado:

```typescript
const sessions = await listSessions()                          // funciona — deep search
const msgs = await getSessionMessages(sessions[0].sessionId)   // retorna [] — BUG
```

Quando `options.dir` nao e fornecido, `baseDir` aponta para `~/.claude/projects/`, mas os arquivos `.jsonl` vivem em subdiretorios sanitizados como `~/.claude/projects/-my-project-/`.

Alem disso, o CRUD de sessions esta incompleto: existe `renameSession()` e `tagSession()` mas nao existe `deleteSession()`. Usuarios precisam manipular o filesystem diretamente para cleanup.

## Especificacao

### 1. Helper `findSessionFile()` em `src/sessions.ts`

Criar funcao privada (nao exportada):

```typescript
async function findSessionFile(
  projectsDir: string,
  sessionId: string,
): Promise<string | null> {
  // Tentar raiz primeiro
  const rootPath = join(projectsDir, `${sessionId}.jsonl`)
  try {
    await stat(rootPath)
    return rootPath
  } catch {
    // nao encontrado na raiz
  }

  // Iterar subdiretorios
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
```

### 2. Substituir resolucao de `filePath` em `getSessionMessages()` (linhas 209-225)

**Antes:**

```typescript
const baseDir = options.dir
  ? join(getProjectsDir(), sanitizePath(resolve(options.dir)))
  : getProjectsDir()

const filePath = join(baseDir, `${sessionId}.jsonl`)

let data: { messages: unknown[] }
try {
  data = await readSessionFile(filePath)
} catch {
  return []
}
```

**Depois:**

```typescript
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
```

### 3. Adicionar `deleteSession()` em `src/sessions.ts` (apos `tagSession()`)

```typescript
export async function deleteSession(
  sessionId: string,
  options: SessionMutationOptions = {},
): Promise<boolean> {
  let filePath: string

  if (options.dir) {
    filePath = join(
      getProjectsDir(),
      sanitizePath(resolve(options.dir)),
      `${sessionId}.jsonl`,
    )
  } else {
    const found = await findSessionFile(getProjectsDir(), sessionId)
    if (!found) return false
    filePath = found
  }

  try {
    await unlink(filePath)
    return true
  } catch {
    return false
  }
}
```

### 4. Import adicional em `src/sessions.ts`

Adicionar `unlink` ao import de `node:fs/promises`:

```typescript
import { readdir, stat, readFile, appendFile, unlink } from "node:fs/promises"
```

### 5. Exportar `deleteSession` em `src/index.ts`

Adicionar `deleteSession` a lista de exports de sessions:

```typescript
export { listSessions, getSessionMessages, getSessionInfo, renameSession, tagSession, deleteSession } from "./sessions.js"
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `getSessionMessages(id)` sem `dir` | Retorna `[]` sempre | Deep search em subdirs |
| `getSessionMessages(id, { dir })` | Busca correta | Sem mudanca |
| Sessao inexistente | Retorna `[]` | Retorna `[]` |
| Arquivo na raiz de `projects/` | Funciona | Funciona (tenta raiz primeiro) |
| `deleteSession(id)` sem `dir` | N/A | Deep search + unlink |
| `deleteSession(id, { dir })` | N/A | Resolve path + unlink |
| `deleteSession(id)` inexistente | N/A | Retorna `false` |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-038 | sessionDeepSearch | Criar `findSessionFile()` e substituir resolucao de path em `getSessionMessages()` para deep search quando `dir` nao fornecido |
| F-039 | deleteSession | Adicionar `deleteSession(sessionId, options?)` com deep search, retorno boolean, e export em `index.ts` |

## Limites

- NAO alterar `listSessions()` — ja funciona corretamente
- NAO alterar `renameSession()` ou `tagSession()` — sofrem do mesmo bug de resolucao sem `dir`, mas estao fora do escopo
- NAO exportar `findSessionFile()` — e helper interno
- NAO lancar erro para sessao inexistente em `deleteSession()` — retornar `false`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs.
