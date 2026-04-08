# openclaude-sdk - Filtragem Segura de Environment Variables

Eliminar valores `undefined` do env passado ao child process em todos os pontos de merge e cast.

---

## Objetivo

Resolver D-011 e D-017: `options.env` e tipado como `Record<string, string | undefined>`, mas e castado inseguramente para `Record<string, string>` em `process.ts:165` e `query.ts:58`. Alem disso, o merge de env com `envFromRegistry` em `query.ts:49-51` nao filtra `undefined` values herdados de `options.env`.

---

## Problema

### Cast inseguro (process.ts:165)

```typescript
// Atual — INSEGURO
const childEnv = {
  ...process.env,
  ...(options.env as Record<string, string>),
}
```

O cast `as Record<string, string>` silencia o compilador mas permite que `undefined` values sejam passados ao child process via `spawn()`. O comportamento de `undefined` em env vars e indefinido no Node.js.

### Merge sem filtragem (query.ts:49-51)

```typescript
// Atual — permite undefined
options.env = { ...options.env, ...envFromRegistry }
```

Se `options.env` ja continha entries com `undefined`, elas permanecem apos o merge. O resultado e passado para `spawnAndStream()` com o mesmo cast inseguro.

### Cast em query.ts:58

```typescript
// Atual — INSEGURO
env: options.env as Record<string, string>,
```

Segundo ponto de cast inseguro na cadeia.

---

## Correcao

### Helper `filterEnv()`

Criar helper local (nao exportado) em `process.ts`:

```typescript
function filterEnv(
  env: Record<string, string | undefined> | undefined,
): Record<string, string> {
  if (!env) return {}
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}
```

### Aplicar em process.ts:163-166

```typescript
// Corrigido
const childEnv = {
  ...process.env,
  ...filterEnv(options.env),
}
```

Remover o cast `as Record<string, string>`.

### Aplicar em query.ts:49-51

```typescript
// Corrigido — filtrar ANTES de passar adiante
if (registry && model) {
  const envFromRegistry = resolveModelEnv(registry, model)
  options.env = { ...options.env, ...envFromRegistry }
}
```

Nao e necessario filtrar aqui porque `envFromRegistry` ja e `Record<string, string>`. A filtragem final acontece em `spawnAndStream()`.

### Remover cast em query.ts:58

```typescript
// Corrigido — sem cast, a funcao filterEnv ja aceita o tipo correto
env: options.env,
```

A assinatura de `spawnAndStream` ja aceita `Record<string, string | undefined>` no campo `env`. O `filterEnv()` e aplicado internamente.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | 163-166 | Usar `filterEnv()` em vez de cast |
| `src/process.ts` | (novo) | Adicionar helper `filterEnv()` |
| `src/query.ts` | 58 | Remover cast `as Record<string, string>` |

---

## Criterios de Aceite

- [ ] `filterEnv()` remove todas as entries com valor `undefined`
- [ ] Nenhum cast `as Record<string, string>` permanece em `process.ts` ou `query.ts` para env
- [ ] `spawnAndStream()` nunca passa `undefined` como valor de env var ao `spawn()`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `filterEnv()` em `process.ts` | S-008 |
| Cast removal em `query.ts` | S-008 |
| Discoveries | D-011, D-017 |
