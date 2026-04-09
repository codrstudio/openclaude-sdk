# openclaude-sdk - V2 Session API: createSession, resumeSession, prompt

Implementar API orientada a objeto para conversas multi-turn com `SDKSession` stateful.

---

## Objetivo

Resolver D-044 (score 5) e D-045 (score 4): nao ha API orientada a objeto para conversas multi-turn. O padrao atual (`continueSession()` + `query()`) requer que o caller gerencie o `sessionId` manualmente a cada turno.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `createSession()` + `SDKSession` nao existem | Sem objeto stateful que encadeie queries automaticamente |
| 2 | `resumeSession()` nao existe (como V2) | Sem forma de retomar sessao existente como `SDKSession` |
| 3 | `prompt()` one-shot nao existe | Padrao `query() → collectMessages()` verboso para caso mais comum |

Referencia: `backlog/08-v2-session-api/TASK.md`.

---

## Estado Atual

**Arquivo alvo**: `src/session-v2.ts` (novo)

A V1 (`query()` + `continueSession()` em `src/query.ts`) funciona mas requer gerenciamento manual de `sessionId`. O consumidor precisa:

```typescript
// V1 — verbose
const q1 = query({ prompt: "Hello", options: { sessionId: "abc" } })
const r1 = await collectMessages(q1)
const sid = r1.sessionId!

const q2 = continueSession({ sessionId: sid, prompt: "Follow up" })
const r2 = await collectMessages(q2)
```

---

## Implementacao

### 1. Interface `SDKSession`

```typescript
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
```

**Decisao de design**: `send()` retorna `Query` diretamente (que e um `AsyncGenerator`), nao separa `send()` + `stream()`. Isso simplifica a API e evita estado intermediario — o caller faz `for await (const msg of session.send("..."))`.

### 2. Funcao `createSession()`

```typescript
import { randomUUID } from "node:crypto"
import { query, collectMessages } from "./query.js"
import type { Query } from "./query.js"
import type { SDKMessage } from "./types/messages.js"
import type { Options } from "./types/options.js"
import type { ProviderRegistry } from "./types/provider.js"

export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}

export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const sessionId = opts.sessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true

  return {
    sessionId,

    send(prompt: string, turnOptions?: Partial<Options>): Query {
      // Fechar query anterior se ainda ativa
      if (activeQuery) {
        activeQuery.close()
      }

      const mergedOptions: Options = {
        ...opts.options,
        ...turnOptions,
      }

      if (isFirstTurn) {
        // Primeira mensagem — criar sessao nova
        activeQuery = query({
          prompt,
          model: opts.model,
          registry: opts.registry,
          options: { ...mergedOptions, sessionId },
        })
        isFirstTurn = false
      } else {
        // Turnos subsequentes — resume
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

### 3. Funcao `resumeSession()`

Analogo de `createSession()` para sessoes existentes:

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
  // Delega para createSession com sessionId fixo e isFirstTurn = false
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

**Nota**: `resumeSession()` sempre usa `resume: sessionId` — inclusive no primeiro turno. Isso e a diferenca principal de `createSession()`.

### 4. Funcao `prompt()` — one-shot convenience

```typescript
import type { SDKResultMessage } from "./types/messages.js"
import { ExecutionError } from "./errors.js"

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

`prompt()` e um thin wrapper sobre `query()` + `collectMessages()`. Retorna o mesmo shape de `collectMessages()` para consistencia.

### 5. Exportacoes em `src/index.ts`

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

---

## Exemplo de Uso

### Multi-turn com createSession

```typescript
import { createSession } from "openclaude-sdk"

await using session = createSession({ model: "sonnet" })

// Turno 1
for await (const msg of session.send("Create a hello.ts file")) {
  console.log(msg.type)
}

// Turno 2 (mesma sessao, automatico)
const result = await session.collect("Now add error handling")
console.log(result.result)
```

### Retomar sessao existente

```typescript
import { resumeSession } from "openclaude-sdk"

const session = resumeSession("abc-123-def")
const result = await session.collect("Continue where we left off")
await session.close()
```

### One-shot

```typescript
import { prompt } from "openclaude-sdk"

const result = await prompt("What is 2 + 2?")
console.log(result.result) // "4"
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/session-v2.ts` | Novo — `SDKSession`, `createSession()`, `resumeSession()`, `prompt()` |
| `src/index.ts` | Exportar `createSession`, `resumeSession`, `prompt`, `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions` |

---

## Criterios de Aceite

- [ ] `createSession()` retorna `SDKSession` funcional
- [ ] `SDKSession.send()` retorna `Query` (AsyncGenerator) para streaming
- [ ] `SDKSession.collect()` coleta resultado completo (wrapper sobre send + collectMessages)
- [ ] Primeiro turno usa `sessionId`, turnos subsequentes usam `resume`
- [ ] `resumeSession()` retoma sessao existente — sempre usa `resume`
- [ ] `prompt()` one-shot funciona (query + collectMessages)
- [ ] `await using session = createSession(...)` funciona (AsyncDisposable)
- [ ] `close()` fecha query ativa se houver
- [ ] Tipos `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions` exportados
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `createSession()` | S-032 |
| `resumeSession()` | S-032 |
| `prompt()` | S-032 |
| `SDKSession` interface | S-032 |
| Discovery | D-044, D-045 |
| Dependencia | `src/query.ts` — `query()`, `collectMessages()` |
| Referencia | `backlog/08-v2-session-api/TASK.md` |
