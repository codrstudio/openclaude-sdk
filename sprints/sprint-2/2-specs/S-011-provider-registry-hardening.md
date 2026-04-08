# openclaude-sdk - Hardening do Provider Registry

Tratar providers bedrock/vertex e validar inputs de `createOpenRouterRegistry()`.

---

## Objetivo

Resolver D-014 e D-018:
- `resolveModelEnv()` nao trata os tipos `"bedrock"` e `"vertex"` declarados no tipo `Provider` — caem no `default` silenciosamente
- `createOpenRouterRegistry()` aceita `apiKey: ""` e `models: []` sem erro, causando falhas confusas em runtime

---

## 1. Tratar bedrock/vertex em resolveModelEnv() (D-014)

### Problema

O tipo `Provider.type` inclui `"bedrock" | "vertex"`, mas o switch em `resolveModelEnv()` so trata `"openai"`, `"gemini"` e `"github"`. Providers bedrock e vertex caem no `default` que retorna apenas `{ OPENAI_MODEL: modelId }` — insuficiente para autenticacao.

### Correcao

Como a SDK nao suporta oficialmente bedrock e vertex neste momento, lancar erro explicito em vez de falhar silenciosamente:

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

Remover tambem o `default` generico que retorna `{ OPENAI_MODEL: modelId }` — substituir por:

```typescript
default: {
  const _exhaustive: never = provider.type
  throw new Error(`Unknown provider type: ${_exhaustive}`)
}
```

O pattern `never` garante que o TypeScript reclame se um novo tipo for adicionado ao union sem tratamento no switch.

---

## 2. Validar inputs de createOpenRouterRegistry() (D-018)

### Problema

```typescript
// Aceita sem reclamar:
createOpenRouterRegistry({ apiKey: "", models: [] })
// Resulta em: defaultModel: "", apiKey: "" → falha confusa na primeira query
```

### Correcao

Adicionar validacao no inicio da funcao:

```typescript
export function createOpenRouterRegistry(config: {
  apiKey: string
  models: { id: string; label: string; contextWindow?: number; supportsVision?: boolean }[]
}): ProviderRegistry {
  if (!config.apiKey) {
    throw new Error("createOpenRouterRegistry: apiKey must not be empty")
  }
  if (!config.models.length) {
    throw new Error("createOpenRouterRegistry: models array must not be empty")
  }

  // ... resto da implementacao
}
```

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/registry.ts` | 21-42 | Adicionar cases bedrock/vertex + exhaustive default |
| `src/registry.ts` | 49-71 | Adicionar validacao de apiKey e models |

---

## Criterios de Aceite

- [ ] `resolveModelEnv()` com provider type `"bedrock"` lanca erro explicito com mensagem util
- [ ] `resolveModelEnv()` com provider type `"vertex"` lanca erro explicito com mensagem util
- [ ] Switch tem exhaustive check (`never`) no default — adicionar novo tipo ao union causa erro de compilacao
- [ ] `createOpenRouterRegistry({ apiKey: "", models: [...] })` lanca erro
- [ ] `createOpenRouterRegistry({ apiKey: "sk-...", models: [] })` lanca erro
- [ ] Uso valido continua funcionando normalmente
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `resolveModelEnv()` bedrock/vertex | S-011 |
| `resolveModelEnv()` exhaustive check | S-011 |
| `createOpenRouterRegistry()` validacao | S-011 |
| Discoveries | D-014, D-018 |
