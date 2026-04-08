# PRP-003 — Hierarquia de Erros Tipados

## Objetivo

Criar classes de erro tipadas para tratamento programatico de falhas da SDK e integrar com `collectMessages()`.

Referencia: spec S-003 (D-005).

## Execution Mode

`implementar`

## Contexto

Falhas durante a query chegam como `SDKResultMessage` com `subtype: "error_*"` ou como `SDKAssistantMessage` com campo `error`. Nao ha classes de erro exportadas para distinguir tipos de erro programaticamente.

## Especificacao

### 1. Criar `src/errors.ts`

Classe base e 9 subclasses:

```
OpenClaudeError (base)
  ├── AuthenticationError      (code: "authentication_failed")
  ├── BillingError             (code: "billing_error")
  ├── RateLimitError           (code: "rate_limit")
  ├── InvalidRequestError      (code: "invalid_request")
  ├── ServerError              (code: "server_error")
  ├── MaxTurnsError            (code: "max_turns")
  ├── MaxBudgetError           (code: "max_budget_usd")
  ├── ExecutionError           (code: "execution_error")
  └── StructuredOutputError    (code: "structured_output_retries")
```

#### Classe base

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

#### RateLimitError — campos extras

```typescript
export class RateLimitError extends OpenClaudeError {
  readonly resetsAt?: number
  readonly utilization?: number
}
```

### 2. Helper isRecoverable()

```typescript
export function isRecoverable(error: OpenClaudeError): boolean
```

Retorna `true` para: `RateLimitError`, `ServerError`, `MaxTurnsError`, `MaxBudgetError`, `StructuredOutputError`, `ExecutionError`.

Retorna `false` para: `AuthenticationError`, `BillingError`, `InvalidRequestError`.

### 3. Integrar com collectMessages()

Em `src/query.ts`, `collectMessages()` deve lancar o erro tipado correto quando o resultado indica falha:

- `SDKResultMessage` com `subtype === "error_max_turns"` → `throw new MaxTurnsError(...)`
- `SDKResultMessage` com `subtype === "error_max_budget_usd"` → `throw new MaxBudgetError(...)`
- `SDKResultMessage` com `subtype === "error_during_execution"` → `throw new ExecutionError(...)`
- `SDKResultMessage` com `subtype === "error_max_structured_output_retries"` → `throw new StructuredOutputError(...)`
- `SDKAssistantMessage` com `error === "authentication_failed"` → `throw new AuthenticationError(...)`
- `SDKAssistantMessage` com `error === "billing_error"` → `throw new BillingError(...)`
- `SDKAssistantMessage` com `error === "rate_limit"` → `throw new RateLimitError(...)`
- `SDKAssistantMessage` com `error === "invalid_request"` → `throw new InvalidRequestError(...)`
- `SDKAssistantMessage` com `error === "server_error"` → `throw new ServerError(...)`

`query()` (o AsyncGenerator) NAO lanca. Apenas `collectMessages()` lanca.

### 4. Exportar via index.ts

Exportar todas as classes de erro, `isRecoverable()`, e o tipo `OpenClaudeError` de `src/index.ts`.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-009 | Error classes | Criar `src/errors.ts` com base + 9 subclasses |
| F-010 | isRecoverable | Implementar helper `isRecoverable()` |
| F-011 | collectMessages integration | Lancar erros tipados em `collectMessages()` |

## Limites

- NAO modificar o comportamento de `query()` — ele continua yieldando mensagens normalmente
- NAO criar middleware de retry — apenas as classes de erro
- NAO capturar erros de I/O do subprocess (ENOENT, etc.) — apenas erros semanticos do CLI

## Dependencias

- **PRP-001** — projeto precisa estar configurado e compilando
