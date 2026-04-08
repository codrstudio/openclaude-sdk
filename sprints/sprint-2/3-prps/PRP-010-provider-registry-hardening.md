# PRP-010 — Provider Registry Hardening

## Objetivo

Tratar providers `bedrock` e `vertex` explicitamente em `resolveModelEnv()`, adicionar exhaustive check ao switch, e validar inputs de `createOpenRouterRegistry()`.

Referencia: spec S-011 (D-014, D-018).

## Execution Mode

`implementar`

## Contexto

Dois problemas em `src/registry.ts`:
1. O tipo `Provider.type` inclui `"bedrock" | "vertex"`, mas `resolveModelEnv()` so trata `"openai"`, `"gemini"` e `"github"`. Providers bedrock/vertex caem no `default` que retorna apenas `{ OPENAI_MODEL: modelId }` — insuficiente para autenticacao, causando falha silenciosa.
2. `createOpenRouterRegistry()` aceita `apiKey: ""` e `models: []` sem erro, causando falhas confusas em runtime na primeira query.

## Especificacao

### 1. Cases bedrock/vertex em resolveModelEnv()

Adicionar antes do `default`:

```typescript
case "bedrock":
  throw new Error(
    `Provider type "bedrock" is not yet supported. ` +
    `Configure bedrock credentials via environment variables directly.`
  )
case "vertex":
  throw new Error(
    `Provider type "vertex" is not yet supported. ` +
    `Configure vertex credentials via environment variables directly.`
  )
```

### 2. Exhaustive check no default

Substituir o `default` generico por:

```typescript
default: {
  const _exhaustive: never = provider.type
  throw new Error(`Unknown provider type: ${_exhaustive}`)
}
```

O pattern `never` garante que adicionar um novo tipo ao union sem tratamento no switch causa erro de compilacao.

### 3. Validacao em createOpenRouterRegistry()

Adicionar no inicio da funcao:

```typescript
if (!config.apiKey) {
  throw new Error("createOpenRouterRegistry: apiKey must not be empty")
}
if (!config.models.length) {
  throw new Error("createOpenRouterRegistry: models array must not be empty")
}
```

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-027 | Bedrock/Vertex errors | Lancar erro explicito para providers nao suportados + exhaustive check |
| F-028 | Registry input validation | Validar `apiKey` e `models` em `createOpenRouterRegistry()` |

## Limites

- NAO implementar suporte real a bedrock/vertex — apenas lancar erro explicito
- NAO alterar a interface de `ProviderRegistry` ou `Provider`
- NAO adicionar dependencias

## Dependencias

Nenhuma. Alteracoes sao auto-contidas em `src/registry.ts`.
