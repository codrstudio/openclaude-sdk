# openclaude-sdk - Deep Search em getSessionMessages()

Corrigir `getSessionMessages()` para buscar sessoes em subdiretorios quando `dir` nao e fornecido, alinhando com o comportamento de `listSessions()`.

---

## Objetivo

Resolver D-031 (score 9): `getSessionMessages(sessionId)` sem `options.dir` busca o arquivo JSONL em `~/.claude/projects/` (raiz), mas todas as sessoes vivem em **subdiretorios** como `~/.claude/projects/-my-project-/{sessionId}.jsonl`. O resultado e sempre `[]`.

O fluxo natural esta quebrado:

```typescript
const sessions = await listSessions()                          // funciona — deep search
const msgs = await getSessionMessages(sessions[0].sessionId)   // retorna [] — BUG
```

`listSessions()` faz deep search por padrao (itera subdirs). `getSessionMessages()` nao.

---

## Estado Atual

**Arquivo**: `src/sessions.ts`, funcao `getSessionMessages()`, linhas 209-251

```typescript
export async function getSessionMessages(
  sessionId: string,
  options: GetSessionMessagesOptions = {},
): Promise<SessionMessage[]> {
  const baseDir = options.dir
    ? join(getProjectsDir(), sanitizePath(resolve(options.dir)))
    : getProjectsDir()   // <— busca na raiz, nao em subdirs

  const filePath = join(baseDir, `${sessionId}.jsonl`)
  // ...
}
```

Quando `options.dir` nao e fornecido, `baseDir` aponta para `~/.claude/projects/`. O `sessionId.jsonl` nunca esta neste diretorio — esta num subdir sanitizado.

---

## Implementacao

### Estrategia

Quando `dir` nao for fornecido, iterar subdiretorios de `getProjectsDir()` procurando `{sessionId}.jsonl` — mesma logica de `listSessions()` em modo deep.

### Codigo

Substituir o bloco de resolucao de `filePath` em `getSessionMessages()`:

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
  // Deep search: procurar em subdiretorios (identico a listSessions)
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

### Helper `findSessionFile()`

Adicionar como funcao privada em `src/sessions.ts`, junto aos outros helpers:

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

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `getSessionMessages(id)` sem `dir` | ❌ Retorna `[]` sempre | ✅ Deep search em subdirs |
| `getSessionMessages(id, { dir: "/my/project" })` | ✅ Busca correta | ✅ Sem mudanca |
| Sessao inexistente | ✅ Retorna `[]` | ✅ Retorna `[]` |
| Arquivo na raiz de `~/.claude/projects/` | ✅ Funciona | ✅ Funciona (tenta raiz primeiro) |

---

## Impacto em Funcoes Correlatas

`renameSession()` e `tagSession()` sofrem do **mesmo bug**: sem `dir`, apontam para a raiz e falham silenciosamente (tentam append num arquivo inexistente). Porem o escopo desta spec e `getSessionMessages()` — o fix das mutation functions pode ser derivado como spec separada se necessario.

`getSessionInfo()` nao e afetada: delega para `listSessions()` que ja faz deep search.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | 209-225 | Substituir resolucao de `filePath` por deep search |
| `src/sessions.ts` | (novo, helpers) | Adicionar funcao `findSessionFile()` |

---

## Criterios de Aceite

- [ ] `getSessionMessages(sessionId)` sem `dir` encontra sessao em subdiretorio
- [ ] `getSessionMessages(sessionId, { dir })` continua funcionando normalmente
- [ ] Sessao inexistente retorna `[]` (sem throw)
- [ ] Se o arquivo existir na raiz de `projects/`, e encontrado (fallback raiz)
- [ ] `findSessionFile()` nao e exportada (helper interno)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Deep search em `getSessionMessages()` | S-018 |
| Helper `findSessionFile()` | S-018 |
| Discovery | D-031 |
