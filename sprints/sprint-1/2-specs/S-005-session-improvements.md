# openclaude-sdk - Melhorias de Session Management

Adicionar deep search em `listSessions()` e funcao de conveniencia `continueSession()`.

---

## Objetivo

Resolver D-007 e D-010: `listSessions()` so busca no diretorio imediato e nao ha funcao de alto nivel para continuar sessoes existentes.

---

## 1. listSessions() com Deep Search (D-007)

### Problema

Quando `dir` nao e especificado, `listSessions()` busca arquivos `.jsonl` apenas no root `~/.claude/projects/`. Os arquivos de sessao ficam em subdiretorios encodados (um por cwd), portanto a listagem root retorna vazio.

### Solucao

| Cenario | Comportamento |
|---------|---------------|
| `listSessions({ dir: "/my/project" })` | Busca em `~/.claude/projects/{encoded-dir}/` (sem mudanca) |
| `listSessions({})` ou `listSessions()` | Itera **todos** os subdiretorios de `~/.claude/projects/` e agrega sessoes |
| `listSessions({ deep: false })` | Busca apenas no root (comportamento original, para backward compat) |

### Nova opcao

```typescript
export interface ListSessionsOptions {
  dir?: string
  limit?: number
  deep?: boolean              // default: true quando dir nao especificado
  includeWorktrees?: boolean
}
```

### Implementacao

```typescript
export async function listSessions(options: ListSessionsOptions = {}): Promise<SDKSessionInfo[]> {
  if (options.dir) {
    // Busca em diretorio especifico (sem mudanca)
    return listSessionsInDir(join(getProjectsDir(), encodeCwd(options.dir)), options)
  }

  const deep = options.deep !== false // default true
  if (!deep) {
    return listSessionsInDir(getProjectsDir(), options)
  }

  // Deep: iterar subdiretorios
  const projectsDir = getProjectsDir()
  const entries = await readdir(projectsDir, { withFileTypes: true })
  const allSessions: SDKSessionInfo[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subSessions = await listSessionsInDir(join(projectsDir, entry.name), options)
      allSessions.push(...subSessions)
    }
  }

  allSessions.sort((a, b) => b.lastModified - a.lastModified)

  if (options.limit) {
    return allSessions.slice(0, options.limit)
  }

  return allSessions
}
```

### Performance

| Diretorio | Impacto |
|-----------|---------|
| < 50 projetos | Negligivel |
| > 50 projetos | Usar `limit` para limitar |

Nao fazer I/O paralelo com `Promise.all` em todos os subdiretorios — sequencial e suficiente e evita EMFILE.

---

## 2. continueSession() (D-010)

### API

```typescript
export function continueSession(params: {
  sessionId: string
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query
```

### Comportamento

1. Cria `Options` com `resume: params.sessionId`
2. Merge com `params.options` (options do usuario tem precedencia, exceto `resume`)
3. Delega para `query()`

### Implementacao

```typescript
export function continueSession(params: {
  sessionId: string
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query {
  const { sessionId, prompt, model, registry, options = {} } = params
  return query({
    prompt,
    model,
    registry,
    options: {
      ...options,
      resume: sessionId,  // sempre sobrescreve
    },
  })
}
```

### Arquivo

Adicionar em `src/query.ts` e exportar via `src/index.ts`.

---

## Criterios de Aceite

- [ ] `listSessions()` sem argumentos retorna sessoes de **todos** os projetos
- [ ] `listSessions({ dir: "/path" })` continua buscando apenas no diretorio especificado
- [ ] `listSessions({ deep: false })` busca apenas no root (backward compat)
- [ ] Resultado do deep search esta ordenado por `lastModified` desc
- [ ] `limit` funciona corretamente com deep search
- [ ] `continueSession({ sessionId: "abc", prompt: "ola" })` chama `query()` com `resume: "abc"`
- [ ] `continueSession()` esta exportado via `index.ts`

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `listSessions()` em `sessions.ts` | S-005 |
| `listSessionsInDir()` helper | S-005 |
| `continueSession()` em `query.ts` | S-005 |
| `ListSessionsOptions.deep` | S-005 |
| Discoveries | D-007, D-010 |
