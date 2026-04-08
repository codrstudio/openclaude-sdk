# PRP-005 — Session Improvements

## Objetivo

Adicionar deep search em `listSessions()` e criar funcao de conveniencia `continueSession()`.

Referencia: spec S-005 (D-007, D-010).

## Execution Mode

`implementar`

## Contexto

`listSessions()` em `src/sessions.ts` so busca arquivos JSONL no diretorio imediato de um projeto. Quando `dir` nao e especificado, retorna vazio porque os arquivos ficam em subdiretorios encodados. Alem disso, nao ha funcao de alto nivel para continuar sessoes existentes.

## Especificacao

### 1. Deep search em listSessions()

#### Nova opcao na interface

```typescript
export interface ListSessionsOptions {
  dir?: string
  limit?: number
  deep?: boolean  // default: true quando dir nao especificado
}
```

#### Comportamento

| Cenario | Comportamento |
|---------|---------------|
| `listSessions({ dir: "/my/project" })` | Busca em `~/.claude/projects/{encoded-dir}/` (sem mudanca) |
| `listSessions()` ou `listSessions({})` | Itera todos os subdiretorios de `~/.claude/projects/` e agrega sessoes |
| `listSessions({ deep: false })` | Busca apenas no root (backward compat) |

#### Implementacao

Extrair a logica de leitura de um diretorio para `listSessionsInDir()` (funcao interna). No deep search, iterar subdiretorios sequencialmente (nao usar `Promise.all` para evitar EMFILE). Ordenar resultado por `lastModified` desc. Aplicar `limit` apos agregar.

### 2. continueSession()

Nova funcao em `src/query.ts`:

```typescript
export function continueSession(params: {
  sessionId: string
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query
```

Comportamento:
1. Cria `Options` com `resume: params.sessionId`
2. Faz merge com `params.options` (options do usuario tem precedencia, exceto `resume` que e sempre sobrescrito)
3. Delega para `query()`

### 3. Exportar via index.ts

Exportar `continueSession` de `src/index.ts`.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-015 | Deep search | `listSessions()` sem dir itera todos os subdiretorios |
| F-016 | continueSession | Funcao de conveniencia para continuar sessoes |

## Limites

- NAO modificar `getSessionMessages()`, `getSessionInfo()`, `renameSession()`, `tagSession()` — apenas `listSessions()`
- NAO fazer I/O paralelo no deep search (sequencial para evitar EMFILE)
- NAO adicionar cache de sessoes

## Dependencias

- **PRP-001** — projeto precisa estar configurado e compilando
