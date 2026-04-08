# openclaude-sdk - Hierarquia de Erros Tipados

Criar classes de erro tipadas para tratamento programatico de falhas da SDK.

---

## Objetivo

Resolver D-005: falhas chegam como `SDKResultMessage` com `subtype: "error_*"` ou como `SDKAssistantMessage` com campo `error`. Nao ha classes exportadas para distinguir tipos de erro programaticamente.

---

## Hierarquia de Classes

```
OpenClaudeError (base)
  ├── AuthenticationError      (assistant.error === "authentication_failed")
  ├── BillingError             (assistant.error === "billing_error")
  ├── RateLimitError           (assistant.error === "rate_limit")
  ├── InvalidRequestError      (assistant.error === "invalid_request")
  ├── ServerError              (assistant.error === "server_error")
  ├── MaxTurnsError            (result.subtype === "error_max_turns")
  ├── MaxBudgetError           (result.subtype === "error_max_budget_usd")
  ├── ExecutionError           (result.subtype === "error_during_execution")
  └── StructuredOutputError    (result.subtype === "error_max_structured_output_retries")
```

---

## Classe Base

```typescript
export class OpenClaudeError extends Error {
  readonly code: string
  readonly sessionId: string | null
  readonly costUsd: number
  readonly durationMs: number

  constructor(params: {
    message: string
    code: string
    sessionId?: string | null
    costUsd?: number
    durationMs?: number
    cause?: unknown
  })
}
```

| Campo | Descricao |
|-------|-----------|
| `code` | Identificador unico do tipo de erro (ex: `"authentication_failed"`, `"max_turns"`) |
| `sessionId` | Session ID do CLI, quando disponivel |
| `costUsd` | Custo acumulado ate o erro |
| `durationMs` | Duracao ate o erro |
| `cause` | Erro original (para encadeamento) |

---

## Subclasses

| Classe | `code` | Origem | Recuperavel |
|--------|--------|--------|-------------|
| `AuthenticationError` | `"authentication_failed"` | `SDKAssistantMessage.error` | Nao |
| `BillingError` | `"billing_error"` | `SDKAssistantMessage.error` | Nao |
| `RateLimitError` | `"rate_limit"` | `SDKAssistantMessage.error` | Sim (retry com backoff) |
| `InvalidRequestError` | `"invalid_request"` | `SDKAssistantMessage.error` | Nao |
| `ServerError` | `"server_error"` | `SDKAssistantMessage.error` | Sim (retry) |
| `MaxTurnsError` | `"max_turns"` | `SDKResultMessage.subtype` | Sim (aumentar maxTurns) |
| `MaxBudgetError` | `"max_budget_usd"` | `SDKResultMessage.subtype` | Sim (aumentar budget) |
| `ExecutionError` | `"execution_error"` | `SDKResultMessage.subtype` | Depende do contexto |
| `StructuredOutputError` | `"structured_output_retries"` | `SDKResultMessage.subtype` | Sim (ajustar schema) |

### RateLimitError — campos extras

```typescript
export class RateLimitError extends OpenClaudeError {
  readonly resetsAt?: number      // timestamp quando o rate limit expira
  readonly utilization?: number   // 0-1, quanto do limite foi usado
}
```

Populado a partir de `SDKRateLimitEvent.rate_limit_info` quando disponivel na stream.

---

## Integracao com collectMessages()

`collectMessages()` deve lancar erros tipados quando o resultado indica falha:

```typescript
export async function collectMessages(q: Query): Promise<CollectResult> {
  // ... coleta mensagens ...

  // Apos consumir toda a stream:
  if (resultMsg?.subtype === "error_max_turns") {
    throw new MaxTurnsError({ sessionId, costUsd, durationMs, errors: resultMsg.errors })
  }
  // ... demais subtypes de erro ...

  return { messages, sessionId, result, costUsd, durationMs }
}
```

**Importante**: `query()` (o AsyncGenerator) NAO lanca — ele yielda mensagens normalmente. Apenas `collectMessages()` lanca, porque so ela consome o resultado final. Quem usa `query()` diretamente deve tratar erros via inspecao de mensagens.

---

## Helper: isRecoverable()

```typescript
export function isRecoverable(error: OpenClaudeError): boolean
```

| Retorna `true` | Retorna `false` |
|-----------------|------------------|
| `RateLimitError` | `AuthenticationError` |
| `ServerError` | `BillingError` |
| `MaxTurnsError` | `InvalidRequestError` |
| `MaxBudgetError` | |
| `StructuredOutputError` | |
| `ExecutionError` | |

---

## Arquivo

`src/errors.ts` — exportado via `src/index.ts`.

---

## Criterios de Aceite

- [ ] `OpenClaudeError` e base class com `code`, `sessionId`, `costUsd`, `durationMs`
- [ ] Todas as 9 subclasses estao implementadas e exportadas
- [ ] `collectMessages()` lanca o erro tipado correto para cada `subtype` de erro
- [ ] `query()` NAO lanca — apenas yielda mensagens
- [ ] `RateLimitError` tem campos `resetsAt` e `utilization`
- [ ] `isRecoverable()` esta implementado e exportado
- [ ] `instanceof AuthenticationError` funciona em consumidores

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/errors.ts` | S-003 |
| `collectMessages()` em `query.ts` | S-003 |
| `isRecoverable()` | S-003 |
| Discovery | D-005 |
