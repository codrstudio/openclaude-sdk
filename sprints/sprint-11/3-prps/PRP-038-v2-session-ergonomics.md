# PRP-038 — V2 Session API Ergonomics

## Objetivo

Melhorar a ergonomia da V2 Session API: aceitar `SDKUserMessage` em `send()`/`collect()`, retornar `SDKResultMessage` completo em `prompt()`, achatar `CreateSessionOptions`/`ResumeSessionOptions`/`PromptOptions`, e expor getter `currentQuery` em `SDKSession`.

Referencia: specs S-059 (D-067), S-060 (D-068), S-061 (D-069), S-062 (D-070).

## Execution Mode

`implementar`

## Contexto

A V2 Session API (`src/session-v2.ts`) foi implementada no sprint 8 (D-044, D-045) e polida no sprint 10 (D-060). Quatro lacunas de ergonomia foram identificadas no sprint 11:

### send() aceita apenas string (S-059)

`SDKSession.send()` e `collect()` aceitam apenas `string` no parametro `prompt`. O TASK.md especifica `string | SDKUserMessage` para permitir conteudo multi-modal (imagens via `ContentBlock[]`). O tipo `SDKUserMessage` ja e exportado pelo SDK em `src/types/messages.ts` (linhas 67-77) com campo `message.content: ContentBlock[]`.

### prompt() retorna subconjunto parcial (S-060)

`prompt()` retorna `{ result, sessionId, costUsd, durationMs }` — um subconjunto que omite campos uteis como `is_error`, `subtype`, `usage`, `num_turns`, `permission_denials`, `structured_output` presentes no `SDKResultMessage` (linhas 124-155 de `src/types/messages.ts`).

### Options aninhado (S-061)

`CreateSessionOptions`, `ResumeSessionOptions` e `PromptOptions` tem `options?: Options` criando nesting inconsistente: `model` no raiz, demais campos um nivel abaixo. Exemplo: `createSession({ model: "...", options: { maxTurns: 5 } })` deveria ser `createSession({ model: "...", maxTurns: 5 })`.

### Sem acesso a Query ativa (S-062)

A variavel `activeQuery` e local ao closure de `createSession()`/`resumeSession()`, sem getter publico. Consumidores nao conseguem acessar a `Query` ativa para operacoes avancadas (ex: `abort()` direto) sem usar `close()` que fecha a sessao inteira.

## Especificacao

### Feature F-088 — send() e collect() aceitam SDKUserMessage

**1. Adicionar import em `src/session-v2.ts` (linha 8):**

Estado atual:
```typescript
import type { SDKMessage } from "./types/messages.js"
```

Novo:
```typescript
import type { SDKMessage, SDKUserMessage, SDKResultMessage } from "./types/messages.js"
```

**2. Alterar interface SDKSession (linhas 20-22):**

Estado atual:
```typescript
send(prompt: string, options?: Partial<Options>): Query
collect(prompt: string, options?: Partial<Options>): Promise<{
```

Novo:
```typescript
send(prompt: string | SDKUserMessage, options?: Partial<Options>): Query
collect(prompt: string | SDKUserMessage, options?: Partial<Options>): Promise<{
```

**3. Alterar assinatura de send() em createSession() (linha 53):**

Estado atual:
```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
```

Novo:
```typescript
send(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>): Query {
```

**4. Extrair texto do SDKUserMessage no corpo de send() em createSession() (apos linha 60):**

Adicionar conversao antes do uso de `prompt` nas chamadas a `query()`:

```typescript
send(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  const text = typeof prompt === "string"
    ? prompt
    : JSON.stringify(prompt.message.content)

  const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = opts.options ?? {}
  const { resume: _r2, sessionId: _s2, continue: _c2, ...safeTurnOptions } = turnOptions ?? {}

  const mergedOptions: Options = {
    ...safeBaseOptions,
    ...safeTurnOptions,
  }

  if (isFirstTurn) {
    activeQuery = query({
      prompt: text,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, sessionId },
    })
    isFirstTurn = false
  } else {
    activeQuery = query({
      prompt: text,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, resume: sessionId },
    })
  }

  return activeQuery
}
```

**5. Aplicar mesma mudanca em collect() de createSession() (linha 87):**

Estado atual:
```typescript
async collect(prompt: string, turnOptions?: Partial<Options>) {
```

Novo:
```typescript
async collect(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>) {
```

O corpo de `collect()` ja delega para `this.send()`, nao precisa de conversao adicional.

**6. Aplicar mesmas mudancas em resumeSession():**

- Alterar assinatura de `send()` (linha 130) para `prompt: string | SDKUserMessage`
- Adicionar conversao `text` identica a de `createSession()`
- Alterar assinatura de `collect()` (linha 155) para `prompt: string | SDKUserMessage`

**Nota**: `SDKUserMessage` tem `message.content: ContentBlock[]`. O `query()` subjacente aceita `prompt: string`. A serializacao JSON e a forma mais segura de passar conteudo estruturado. Se `SDKUserMessage` tiver campo `message.content` como array de `ContentBlock`, o JSON.stringify garante que o CLI recebe o conteudo completo.

### Feature F-089 — prompt() retorna SDKResultMessage completo

**1. Criar interface PromptResult (antes de `prompt()`, apos `PromptOptions`):**

```typescript
export interface PromptResult {
  /** Texto do resultado (convenience) */
  result: string | null
  /** ID da sessao usada */
  sessionId: string | null
  /** Custo total em USD */
  costUsd: number
  /** Duracao total em ms */
  durationMs: number
  /** Mensagem de resultado completa do CLI */
  resultMessage: SDKResultMessage | null
}
```

**2. Alterar retorno de prompt() (linhas 189-205):**

Estado atual:
```typescript
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

Novo:
```typescript
export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<PromptResult> {
  const q = query({
    prompt: text,
    model: opts.model,
    registry: opts.registry,
    options: opts.options,
  })
  const collected = await collectMessages(q)

  const resultMessage = collected.messages.find(
    (m): m is SDKResultMessage => m.type === "result"
  ) ?? null

  return {
    result: collected.result,
    sessionId: collected.sessionId,
    costUsd: collected.costUsd,
    durationMs: collected.durationMs,
    resultMessage,
  }
}
```

**3. Exportar PromptResult em `src/index.ts` (linha 210):**

Estado atual:
```typescript
export type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
} from "./session-v2.js"
```

Novo:
```typescript
export type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
  PromptResult,
} from "./session-v2.js"
```

### Feature F-090 — Flatten CreateSessionOptions, ResumeSessionOptions, PromptOptions

**1. Alterar CreateSessionOptions (linhas 38-43):**

Estado atual:
```typescript
export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}
```

Novo:
```typescript
export interface CreateSessionOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
  sessionId?: string
}
```

**2. Alterar corpo de createSession() para extrair campos conhecidos:**

Estado atual (linhas 45-48):
```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const sessionId = opts.sessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true
```

Novo:
```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const { model, registry, sessionId: providedSessionId, ...options } = opts
  const sessionId = providedSessionId ?? randomUUID()
  let activeQuery: Query | null = null
  let isFirstTurn = true
```

**3. Atualizar send() em createSession() para usar os campos extraidos:**

Onde antes usava `opts.options`, agora usar `options`. Onde antes usava `opts.model`, agora usar `model`. Onde antes usava `opts.registry`, agora usar `registry`.

Estado atual do strip (linhas 59-60):
```typescript
const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = opts.options ?? {}
```

Novo:
```typescript
const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = options ?? {}
```

E nas chamadas a `query()`:
```typescript
activeQuery = query({
  prompt: text,
  model,
  registry,
  options: { ...mergedOptions, sessionId },
})
```

**4. Alterar ResumeSessionOptions (linhas 115-119):**

Estado atual:
```typescript
export interface ResumeSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}
```

Novo:
```typescript
export interface ResumeSessionOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
}
```

**5. Alterar corpo de resumeSession() para extrair campos:**

```typescript
export function resumeSession(
  sessionId: string,
  opts: ResumeSessionOptions = {},
): SDKSession {
  const { model, registry, ...options } = opts
  let activeQuery: Query | null = null
```

Atualizar `send()` em `resumeSession()` para usar `options`, `model`, `registry` extraidos (mesmo padrao de `createSession()`).

**6. Alterar PromptOptions (linhas 183-187):**

Estado atual:
```typescript
export interface PromptOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}
```

Novo:
```typescript
export interface PromptOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
}
```

**7. Alterar corpo de prompt() para usar os campos extraidos:**

```typescript
export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<PromptResult> {
  const { model, registry, ...options } = opts
  const q = query({
    prompt: text,
    model,
    registry,
    options,
  })
  // ...
}
```

**Nota de compatibilidade**: `Options` NAO tem campos `model`, `registry` ou `sessionId`, portanto nao ha conflitos de nomes. A mudanca e backwards-compatible — callers que usavam `options: { ... }` antes podem agora passar os campos diretamente no raiz. O campo `options` aninhado desaparece da interface, mas os campos que ele continha ficam disponiveis no raiz via `extends Partial<Options>`.

### Feature F-091 — Getter currentQuery em SDKSession

**1. Adicionar campo na interface SDKSession (apos linha 17):**

Estado atual:
```typescript
export interface SDKSession {
  readonly sessionId: string
  send(prompt: string | SDKUserMessage, options?: Partial<Options>): Query
```

Novo:
```typescript
export interface SDKSession {
  readonly sessionId: string
  /** Query ativa (null se nenhuma query em andamento) */
  readonly currentQuery: Query | null
  send(prompt: string | SDKUserMessage, options?: Partial<Options>): Query
```

**2. Adicionar getter no objeto retornado por createSession() (apos `sessionId,`):**

Estado atual (linha 51):
```typescript
return {
  sessionId,

  send(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>): Query {
```

Novo:
```typescript
return {
  sessionId,
  get currentQuery() { return activeQuery },

  send(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>): Query {
```

**3. Adicionar getter no objeto retornado por resumeSession():**

Mesma mudanca: adicionar `get currentQuery() { return activeQuery },` no objeto retornado.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `session.send("hello")` | Funciona | Funciona (identico) |
| `session.send({ type: "user", ... })` | Erro de tipo | Funciona, serializa content como JSON |
| `session.collect({ type: "user", ... })` | Erro de tipo | Funciona via delegacao a send() |
| `prompt("hello")` retorno | `{ result, sessionId, costUsd, durationMs }` | `{ result, sessionId, costUsd, durationMs, resultMessage }` |
| `prompt("hello").resultMessage` | Nao existe | `SDKResultMessage \| null` |
| `createSession({ model: "...", maxTurns: 5 })` | Erro de tipo (maxTurns nao existe) | Funciona (maxTurns via Partial\<Options\>) |
| `createSession({ model: "...", options: { maxTurns: 5 } })` | Funciona | Erro de tipo (options nao existe mais) |
| `session.currentQuery` antes de send() | Nao existe | `null` |
| `session.currentQuery` apos send() | Nao existe | `Query` ativa |
| `session.currentQuery` apos close() | Nao existe | `null` |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-088 | sendAcceptSdkUserMessage | `send()` e `collect()` aceitam `string \| SDKUserMessage` em `createSession()` e `resumeSession()` |
| F-089 | promptReturnFullResult | `prompt()` retorna `PromptResult` com `resultMessage: SDKResultMessage \| null`. Tipo exportado em `index.ts` |
| F-090 | flattenSessionOptions | `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions` estendem `Partial<Options>` eliminando nesting |
| F-091 | sessionCurrentQueryGetter | Getter readonly `currentQuery: Query \| null` em `SDKSession`, implementado em `createSession()` e `resumeSession()` |

## Limites

- NAO alterar `src/query.ts` — `query()` continua aceitando `prompt: string`
- NAO alterar `src/types/messages.ts` — tipos `SDKUserMessage` e `SDKResultMessage` ja existem
- NAO alterar `src/types/options.ts` — a interface `Options` nao muda
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar arquivos alem de `src/session-v2.ts` e `src/index.ts`
- NAO adicionar metodo `stream()` separado — o design atual (`send()` retorna `Query` iteravel) e superior ao spec TASK.md

## Dependencias

Nenhuma dependencia de outros PRPs. Independente.
