# PRP-026 — README: V2 Session API

## Objetivo

Adicionar secao ao README.md documentando `createSession()`, `resumeSession()` e `prompt()` com assinaturas, tabelas de interface e exemplos praticos, incluindo `await using` e comparacao V1 vs V2.

Referencia: spec S-033 (D-046).

## Execution Mode

`implementar`

## Contexto

O README documenta apenas a V1 (`query()`, `collectMessages()`, `continueSession()`) na secao "Session Management". As funcoes `createSession()`, `resumeSession()` e `prompt()` foram implementadas no sprint-7 (F-059/F-060/F-061) em `src/session-v2.ts` e exportadas em `src/index.ts`, mas nao aparecem no README. Sao a API de maior impacto de DX — permitem conversas multi-turn stateful sem gerenciar `sessionId` manualmente.

## Especificacao

### Feature F-062 — Secao V2 Session API no README

**1. Inserir nova secao "V2 Session API"** no `README.md`, apos a secao "Session Management" e antes de "Plan Mode".

**2. Conteudo obrigatorio da secao:**

#### Introducao

Uma frase explicando que a V2 Session API e o padrao recomendado para conversas multi-turn, substituindo o gerenciamento manual de `sessionId`.

#### `createSession(opts?)`

Assinatura completa com tipos:

```typescript
function createSession(opts?: CreateSessionOptions): SDKSession

interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string  // auto-gerado se omitido
}
```

#### Tabela da interface `SDKSession`

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `send(prompt, options?)` | `Query` | Envia mensagem e retorna stream (AsyncGenerator) |
| `collect(prompt, options?)` | `Promise<{ messages, result, costUsd, durationMs }>` | Envia e coleta resultado completo |
| `close()` | `Promise<void>` | Fecha a sessao e mata query ativa |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Suporte a `await using` |

#### Exemplo: Multi-turn com streaming

```typescript
import { createSession } from "openclaude-sdk"

await using session = createSession({ model: "sonnet" })

// Turno 1 — streaming
for await (const msg of session.send("Create a hello.ts file")) {
  if (msg.type === "assistant") {
    console.log(msg.message.content)
  }
}

// Turno 2 — coleta completa
const result = await session.collect("Now add error handling")
console.log(result.result)
```

#### `resumeSession(sessionId, opts?)`

Assinatura:

```typescript
function resumeSession(sessionId: string, opts?: ResumeSessionOptions): SDKSession

interface ResumeSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
}
```

Exemplo:

```typescript
import { resumeSession } from "openclaude-sdk"

const session = resumeSession("abc-123-def")
const result = await session.collect("Continue where we left off")
await session.close()
```

#### `prompt(text, opts?)` — one-shot

Assinatura:

```typescript
function prompt(text: string, opts?: PromptOptions): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}>
```

Exemplo:

```typescript
import { prompt } from "openclaude-sdk"

const { result, costUsd } = await prompt("What is 2 + 2?")
console.log(result) // "4"
```

#### Nota sobre `await using`

Bloco explicando que `SDKSession` implementa `AsyncDisposable` — `await using` garante cleanup automatico mesmo em caso de excecao. Requer TypeScript >= 5.2 com `target: "ES2022"` ou superior.

#### Comparacao V1 vs V2

| Aspecto | V1 (`query` + `continueSession`) | V2 (`createSession`) |
|---------|----------------------------------|----------------------|
| Gerenciamento de sessionId | Manual | Automatico |
| Multi-turn | `continueSession()` a cada turno | `session.send()` encadeia |
| Cleanup | Manual (`q.close()`) | `await using` |
| One-shot | `query()` + `collectMessages()` | `prompt()` |

#### Tipos exportados

Mencionar que os tipos abaixo sao exportados de `openclaude-sdk`:

```typescript
import type {
  SDKSession,
  CreateSessionOptions,
  ResumeSessionOptions,
  PromptOptions,
} from "openclaude-sdk"
```

**3. Todos os exemplos de codigo devem ser compilaveis** (tipos corretos, imports presentes).

**4. Texto em portugues, codigo em ingles.**

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-062 | readmeV2SessionApi | Secao "V2 Session API" no README com `createSession()`, `resumeSession()`, `prompt()`, tabela `SDKSession`, exemplos, `await using`, comparacao V1 vs V2 |

## Limites

- NAO alterar codigo em `src/` — este PRP e exclusivamente de documentacao
- NAO deprecar a V1 no README — ambas APIs coexistem
- NAO adicionar exemplos que dependam de features nao implementadas
- NAO remover ou reorganizar secoes existentes do README (apenas inserir nova secao)

## Dependencias

Nenhuma dependencia de outros PRPs.
