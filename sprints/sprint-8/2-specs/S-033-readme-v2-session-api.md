# openclaude-sdk - Documentacao da V2 Session API no README

Adicionar secao ao README.md documentando `createSession()`, `resumeSession()` e `prompt()` com exemplos praticos.

---

## Objetivo

Resolver D-046 (score 9): as funcoes `createSession()`, `resumeSession()` e `prompt()` foram implementadas no sprint-7 (F-059/F-060/F-061) mas nao aparecem no README. Sao a API de maior impacto de DX — permitem conversas multi-turn stateful sem gerenciar `sessionId` manualmente, e cleanup automatico via `await using`.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `createSession()` nao documentada | Usuarios nao sabem que podem criar sessoes stateful |
| 2 | `resumeSession()` nao documentada | Retomada de sessoes via V2 invisivel |
| 3 | `prompt()` nao documentada | One-shot simplificado inacessivel |
| 4 | `SDKSession` interface nao documentada | Contrato da API invisivel |
| 5 | `await using` nao documentado | Padrao de cleanup automatico desconhecido |

---

## Estado Atual

**Arquivo**: `README.md`

O README documenta apenas a V1 (`query()`, `collectMessages()`, `continueSession()`) na secao "Session Management". Nao ha mencao a `createSession`, `resumeSession`, `prompt`, `SDKSession` ou `await using`.

A implementacao em `src/session-v2.ts` exporta:
- `createSession(opts?: CreateSessionOptions): SDKSession`
- `resumeSession(sessionId: string, opts?: ResumeSessionOptions): SDKSession`
- `prompt(text: string, opts?: PromptOptions): Promise<{ result, sessionId, costUsd, durationMs }>`
- Tipos: `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions`

---

## Implementacao

### 1. Nova secao "V2 Session API" no README

Inserir **apos** a secao "Session Management" e **antes** de "Plan Mode". A secao deve conter:

#### 1.1. Introducao

Uma frase explicando que a V2 Session API e o padrao recomendado para conversas multi-turn, substituindo o gerenciamento manual de `sessionId`.

#### 1.2. `createSession(opts?)`

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

#### 1.3. Tabela da interface `SDKSession`

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `send(prompt, options?)` | `Query` | Envia mensagem e retorna stream (AsyncGenerator) |
| `collect(prompt, options?)` | `Promise<{ messages, result, costUsd, durationMs }>` | Envia e coleta resultado completo |
| `close()` | `Promise<void>` | Fecha a sessao e mata query ativa |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Suporte a `await using` |

#### 1.4. Exemplo: Multi-turn com streaming

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

#### 1.5. `resumeSession(sessionId, opts?)`

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

#### 1.6. `prompt(text, opts?)` — one-shot

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

#### 1.7. Nota sobre `await using`

Bloco explicando que `SDKSession` implementa `AsyncDisposable` — `await using` garante cleanup automatico mesmo em caso de excecao. Requer TypeScript >= 5.2 com `target: "ES2022"` ou superior.

#### 1.8. Comparacao V1 vs V2

Tabela comparativa:

| Aspecto | V1 (`query` + `continueSession`) | V2 (`createSession`) |
|---------|----------------------------------|----------------------|
| Gerenciamento de sessionId | Manual | Automatico |
| Multi-turn | `continueSession()` a cada turno | `session.send()` encadeia |
| Cleanup | Manual (`q.close()`) | `await using` |
| One-shot | `query()` + `collectMessages()` | `prompt()` |

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `README.md` | Nova secao "V2 Session API" com assinaturas, tabelas e exemplos |

---

## Criterios de Aceite

- [ ] Secao "V2 Session API" inserida no README apos "Session Management"
- [ ] `createSession()` documentada com assinatura e `CreateSessionOptions`
- [ ] Tabela da interface `SDKSession` com todos os metodos
- [ ] Exemplo de multi-turn com `send()` e `collect()`
- [ ] `resumeSession()` documentada com assinatura e exemplo
- [ ] `prompt()` one-shot documentada com assinatura e exemplo
- [ ] Nota sobre `await using` e `AsyncDisposable`
- [ ] Tabela comparativa V1 vs V2
- [ ] Tipos `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions` mencionados
- [ ] Exemplos de codigo compilaveis (tipos corretos, imports presentes)
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Secao V2 Session API no README | S-033 |
| `createSession()` docs | S-033 |
| `resumeSession()` docs | S-033 |
| `prompt()` docs | S-033 |
| `SDKSession` interface docs | S-033 |
| Discovery | D-046 |
| Implementacao | `src/session-v2.ts` |
