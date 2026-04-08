# PRP-009 — Error Handling Completeness

## Objetivo

Adicionar tratamento de subtypes e erros desconhecidos nos switches de `collectMessages()`, garantindo que nenhum erro do CLI seja engolido silenciosamente.

Referencia: spec S-010 (D-013).

## Execution Mode

`implementar`

## Contexto

Dois switches em `collectMessages()` (`query.ts:143-152` e `query.ts:158-168`) nao tem caso `default`. Quando o CLI introduz um novo subtype de erro ou tipo de erro assistente, a SDK ignora silenciosamente — a query retorna `result: null` sem indicacao de falha. Isso e perigoso em producao.

## Especificacao

### 1. Default no switch de result subtype (query.ts:143-152)

Apos os cases existentes (`error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`), adicionar:

```typescript
default:
  throw new ExecutionError({
    ...errParams,
    message: `Unknown error subtype: ${msg.subtype}. ${errMsg}`,
  })
```

`ExecutionError` e a classe mais generica da hierarquia de erros de execucao. O subtype desconhecido e incluido na mensagem para facilitar debug.

### 2. Default no switch de assistant error (query.ts:158-168)

Apos os cases existentes (`authentication_failed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error`), adicionar:

```typescript
default:
  throw new ServerError({
    ...errParams,
    message: `Unknown assistant error: ${msg.error}`,
  })
```

`ServerError` e o fallback adequado — erros assistentes desconhecidos provavelmente sao problemas de servidor.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-025 | Result subtype default | Adicionar `default` ao switch de `msg.subtype` lancando `ExecutionError` |
| F-026 | Assistant error default | Adicionar `default` ao switch de `msg.error` lancando `ServerError` |

## Limites

- NAO alterar os cases existentes — apenas adicionar `default`
- NAO criar novas classes de erro — usar as existentes (`ExecutionError`, `ServerError`)
- NAO alterar a interface publica de `collectMessages()`

## Dependencias

Nenhuma. Os erros `ExecutionError` e `ServerError` ja existem em `src/errors.ts`.
