# openclaude-sdk - Implementar deleteSession()

Adicionar funcao `deleteSession()` ao modulo de session management para remocao de sessoes via SDK.

---

## Objetivo

Resolver D-034 (score 4): o modulo de sessions tem `renameSession()` e `tagSession()` mas nao tem delecao. Usuarios que precisam de cleanup de sessoes antigas ou sensiveis precisam manipular arquivos diretamente.

---

## Estado Atual

### Funcoes de mutacao existentes (`src/sessions.ts`)

| Funcao | Operacao |
|--------|----------|
| `renameSession(sessionId, title, options?)` | Append de `{"type":"custom_title"}` no JSONL |
| `tagSession(sessionId, tag, options?)` | Append de `{"type":"tag"}` no JSONL |

Ambas usam o mesmo padrao de resolucao de path:

```typescript
const baseDir = options.dir
  ? join(getProjectsDir(), sanitizePath(resolve(options.dir)))
  : getProjectsDir()
const filePath = join(baseDir, `${sessionId}.jsonl`)
```

### Tipo `SessionMutationOptions` (`src/types/sessions.ts`, linha 35)

```typescript
export interface SessionMutationOptions {
  dir?: string
}
```

---

## Implementacao

### Adicionar `deleteSession()` em `src/sessions.ts`

Inserir apos `tagSession()`:

```typescript
// ---------------------------------------------------------------------------
// deleteSession()
// ---------------------------------------------------------------------------

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
    // Deep search (identico a S-018)
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

### Dependencia de S-018

`deleteSession()` sem `dir` depende de `findSessionFile()` introduzida em S-018. Se S-018 nao tiver sido implementada, o helper deve ser criado junto com esta spec.

### Import adicional

Adicionar `unlink` ao import de `node:fs/promises`:

```typescript
import { readdir, stat, readFile, appendFile, unlink } from "node:fs/promises"
```

### Exportar em `src/index.ts`

Adicionar `deleteSession` a lista de exports de sessions:

```typescript
export { listSessions, getSessionMessages, getSessionInfo, renameSession, tagSession, deleteSession } from "./sessions.js"
```

### Retorno `boolean`

A funcao retorna `true` se deletou, `false` se nao encontrou. Nao lanca erro para sessao inexistente — alinhado com o padrao de `getSessionMessages()` que retorna `[]` em vez de throw.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | (novo, apos `tagSession`) | Adicionar funcao `deleteSession()` |
| `src/sessions.ts` | 5 | Adicionar `unlink` ao import |
| `src/index.ts` | (exports) | Adicionar `deleteSession` |

---

## Criterios de Aceite

- [ ] `deleteSession(sessionId, { dir })` remove o arquivo JSONL
- [ ] `deleteSession(sessionId)` sem `dir` faz deep search e remove
- [ ] Sessao inexistente retorna `false` (sem throw)
- [ ] Sessao deletada retorna `true`
- [ ] `deleteSession` e exportada em `index.ts`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `deleteSession()` em `sessions.ts` | S-022 |
| Export em `index.ts` | S-022 |
| Discovery | D-034 |
| Dependencia | S-018 (`findSessionFile`) |
