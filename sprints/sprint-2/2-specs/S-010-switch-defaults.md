# openclaude-sdk - Default Cases nos Switches de collectMessages

Adicionar tratamento de subtypes e erros desconhecidos em `collectMessages()`.

---

## Objetivo

Resolver D-013: dois switches em `collectMessages()` (`query.ts:143-152` e `query.ts:158-168`) nao tem caso `default`. Subtypes de resultado ou tipos de erro desconhecidos sao silenciosamente ignorados — a query retorna `result: null` sem nenhuma indicacao de falha.

---

## Problema

### Switch de result subtype (query.ts:143-152)

```typescript
switch (msg.subtype) {
  case "error_max_turns":
    throw new MaxTurnsError(errParams)
  case "error_max_budget_usd":
    throw new MaxBudgetError(errParams)
  case "error_during_execution":
    throw new ExecutionError(errParams)
  case "error_max_structured_output_retries":
    throw new StructuredOutputError(errParams)
  // FALTA: default
}
```

Se o CLI introduzir um novo `subtype` de erro (ex: `"error_context_overflow"`), a SDK engole silenciosamente.

### Switch de assistant error (query.ts:158-168)

```typescript
switch (msg.error) {
  case "authentication_failed":
    throw new AuthenticationError(errParams)
  case "billing_error":
    throw new BillingError(errParams)
  case "rate_limit":
    throw new RateLimitError(errParams)
  case "invalid_request":
    throw new InvalidRequestError(errParams)
  case "server_error":
    throw new ServerError(errParams)
  // FALTA: default
}
```

---

## Correcao

### Default no switch de result subtype

```typescript
default:
  throw new ExecutionError({
    ...errParams,
    message: `Unknown error subtype: ${msg.subtype}. ${errMsg}`,
  })
```

Usar `ExecutionError` como tipo generico — e a classe mais generica da hierarquia de erros de execucao. O `code` sera `"execution_error"` e a mensagem incluira o subtype desconhecido para facilitar debug.

### Default no switch de assistant error

```typescript
default:
  throw new ServerError({
    ...errParams,
    message: `Unknown assistant error: ${msg.error}`,
  })
```

Usar `ServerError` como fallback — erros assistentes desconhecidos provavelmente sao problemas de servidor. O `code` sera `"server_error"` e a mensagem incluira o tipo de erro desconhecido.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/query.ts` | 143-152 | Adicionar `default` ao switch de `msg.subtype` |
| `src/query.ts` | 158-168 | Adicionar `default` ao switch de `msg.error` |

---

## Criterios de Aceite

- [ ] Switch de `msg.subtype` tem `default` que lanca `ExecutionError` com o subtype na mensagem
- [ ] Switch de `msg.error` tem `default` que lanca `ServerError` com o error type na mensagem
- [ ] Subtypes e errors conhecidos continuam lancando seus erros tipados especificos
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `collectMessages()` result switch | S-010 |
| `collectMessages()` error switch | S-010 |
| Discovery | D-013 |
