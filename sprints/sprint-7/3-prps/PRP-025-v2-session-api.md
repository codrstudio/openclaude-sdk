# PRP-025 — V2 Session API

## Objetivo

Implementar API orientada a objeto para conversas multi-turn com `SDKSession` stateful (`createSession`, `resumeSession`) e funcao de conveniencia `prompt()` para one-shot.

Referencia: spec S-032 (D-044, D-045).

## Execution Mode

`implementar`

## Contexto

A V1 (`query()` + `continueSession()` em `src/query.ts`) funciona mas requer gerenciamento manual de `sessionId`:

```typescript
// V1 — verbose
const q1 = query({ prompt: "Hello", options: { sessionId: "abc" } })
const r1 = await collectMessages(q1)
const sid = r1.sessionId!

const q2 = continueSession({ sessionId: sid, prompt: "Follow up" })
const r2 = await collectMessages(q2)
```

A V2 encapsula essa logica num objeto `SDKSession` que gerencia `sessionId` e distingue primeiro turno (create) de turnos subsequentes (resume) automaticamente.

## Especificacao

### Feature F-059 — `SDKSession` interface e `createSession()`

**1. Criar arquivo `src/session-v2.ts`** com interface e implementacao:

```typescript
import { randomUUID } from "node:crypto"
import { query, collectMessages } from "./query.js"
import type { Query } from "./query.js"
import type { SDKMessage } from "./types/messages.js"
import type { Options } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"

export interface SDKSession {
  /** ID da sessao (gerado ou fornecido) */
  readonly sessionId: string
  /** Envia mensagem e inicia query — retorna stream de mensagens */
  send(prompt: string, options?: Partial<Options>): Query
  /** Conveniencia: envia mensagem e coleta resultado completo */
  collect(prompt: string, options?: Partial<Options>): Promise<{
    messages: SDKMessage[]
    result: string | null
    costUsd: number
    durationMs: number
  }>
  /** Fecha a sessao e mata qualquer query ativa */
  close(): Promise<void>
  /** Suporte a 'await using' (AsyncDisposable) */
  [Symbol.asyncDispose](): Promise<void>
}

export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}
```

**2. Implementar `createSession()`**:

```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const sessionId = opts.sessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      const mergedOptions: Options = {
        ...opts.options,
        ...turnOptions,
      }

      if (isFirstTurn) {
        activeQuery = query({
          prompt,
          model: opts.model,
          registry: opts.registry,
          options: { ...mergedOptions, sessionId },
        })
        isFirstTurn = false
      } else {
        activeQuery = query({
          prompt,
          model: opts.model,
          registry: opts.registry,
          options: { ...mergedOptions, resume: sessionId },
        })
      }

      return activeQuery
    },

    async collect(prompt: string, turnOptions?: Partial<Options>) {
      const q = this.send(prompt, turnOptions)
      const result = await collectMessages(q)
      return {
        messages: result.messages,
        result: result.result,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      }
    },

    async close() {
      if (activeQuery) {
        await activeQuery.close()
        activeQuery = null
      }
    },

    async [Symbol.asyncDispose]() {
      await this.close()
    },
  }
}
```

**Decisao de design**: `send()` retorna `Query` diretamente (que e um `AsyncGenerator`), nao separa `send()` + `stream()`. O caller faz `for await (const msg of session.send("..."))`.

### Feature F-060 — `resumeSession()`

Retoma sessao existente — sempre usa `resume: sessionId`, inclusive no primeiro turno.

```typescript
export interface ResumeSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}

export function resumeSession(
  sessionId: string,
  opts: ResumeSessionOptions = {},
): SDKSession {
  let activeQuery: Query | null = null

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      if (activeQuery) {
        activeQuery.close()
      }

      const mergedOptions: Options = {
        ...opts.options,
        ...turnOptions,
        resume: sessionId,
      }

      activeQuery = query({
        prompt,
        model: opts.model,
        registry: opts.registry,
        options: mergedOptions,
      })

      return activeQuery
    },

    async collect(prompt: string, turnOptions?: Partial<Options>) {
      const q = this.send(prompt, turnOptions)
      const result = await collectMessages(q)
      return {
        messages: result.messages,
        result: result.result,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
      }
    },

    async close() {
      if (activeQuery) {
        await activeQuery.close()
        activeQuery = null
      }
    },

    async [Symbol.asyncDispose]() {
      await this.close()
    },
  }
}
```

Diferenca principal: `resumeSession()` sempre usa `resume: sessionId`. `createSession()` usa `sessionId` no primeiro turno e `resume` nos subsequentes.

### Feature F-061 — `prompt()` one-shot e exports

**1. Implementar `prompt()`** em `src/session-v2.ts`:

```typescript
export interface PromptOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}

export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}> {
  const q = query({
    prompt: text,
    model: opts.model,
    registry: opts.registry,
    options: opts.options,
  })
  return collectMessages(q)
}
```

Thin wrapper sobre `query()` + `collectMessages()`. Retorna o mesmo shape para consistencia.

**2. Exportar em `src/index.ts`**:

```typescript
// V2 Session API
export { createSession, resumeSession, prompt } from "./session-v2.js"
export type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
} from "./session-v2.js"
```

### Comportamento por cenario

| Cenario | Comportamento |
|---------|--------------|
| `createSession()` sem sessionId | Gera UUID aleatorio |
| `createSession({ sessionId: "abc" })` | Usa sessionId fornecido |
| Primeiro `send()` de createSession | Usa `sessionId` (cria sessao) |
| Segundo `send()` de createSession | Usa `resume: sessionId` |
| `send()` com query anterior ativa | Fecha query anterior, inicia nova |
| `resumeSession("abc").send(...)` | Sempre usa `resume: sessionId` |
| `collect()` | Equivale a `send()` + `collectMessages()` |
| `close()` sem query ativa | Resolve imediatamente |
| `close()` com query ativa | Fecha query, limpa referencia |
| `await using session = createSession()` | `close()` chamado automaticamente ao sair do escopo |
| `prompt("What is 2+2?")` | One-shot: query + collectMessages |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-059 | createSession | Interface `SDKSession`, `CreateSessionOptions`, `createSession()` com gerenciamento automatico de first turn vs resume |
| F-060 | resumeSession | `ResumeSessionOptions`, `resumeSession()` — sempre usa `resume`, para retomar sessoes existentes |
| F-061 | promptOneShot | `prompt()` one-shot + `PromptOptions` + exports de tudo em `index.ts` |

## Limites

- NAO alterar `query()`, `continueSession()` ou `collectMessages()` em `src/query.ts` — a V2 e wrapper sobre a V1
- NAO deprecar a V1 — ambas APIs coexistem
- NAO adicionar gerenciamento de historico de mensagens no `SDKSession` — o caller gerencia via stream ou `collect()`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs. Depende apenas de `query()` e `collectMessages()` que ja existem em `src/query.ts`.
