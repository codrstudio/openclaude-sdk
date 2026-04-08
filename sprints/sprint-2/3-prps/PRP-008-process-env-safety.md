# PRP-008 — Process & Env Safety

## Objetivo

Eliminar casts inseguros de `options.env`, filtrar valores `undefined` antes de passar ao child process, e corrigir flags de tools para kebab-case.

Referencia: specs S-008 (D-011, D-017) e S-009 (D-012).

## Execution Mode

`implementar`

## Contexto

Dois problemas criticos no pipeline de spawn:
1. `options.env` e tipado como `Record<string, string | undefined>`, mas e castado para `Record<string, string>` em `process.ts:165` e `query.ts:58`. Valores `undefined` passam ao child process causando comportamento indefinido.
2. `buildCliArgs()` usa `--allowedTools` e `--disallowedTools` (camelCase), mas o Claude Code CLI espera kebab-case (`--allowed-tools`, `--disallowed-tools`). Flags desconhecidos sao ignorados silenciosamente.

## Especificacao

### 1. Helper `filterEnv()` em process.ts

Criar funcao local (nao exportada):

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

### 2. Aplicar filterEnv em process.ts:163-166

Substituir:
```typescript
const childEnv = {
  ...process.env,
  ...(options.env as Record<string, string>),
}
```

Por:
```typescript
const childEnv = {
  ...process.env,
  ...filterEnv(options.env),
}
```

### 3. Remover cast em query.ts:58

Substituir:
```typescript
env: options.env as Record<string, string>,
```

Por:
```typescript
env: options.env,
```

A assinatura de `spawnAndStream` aceita `Record<string, string | undefined>` no campo `env`. O `filterEnv()` e aplicado internamente.

### 4. Corrigir flags de tools em process.ts:73-79

Substituir:
```typescript
args.push("--allowedTools", options.allowedTools.join(","))
```

Por:
```typescript
args.push("--allowed-tools", options.allowedTools.join(","))
```

Substituir:
```typescript
args.push("--disallowedTools", options.disallowedTools.join(","))
```

Por:
```typescript
args.push("--disallowed-tools", options.disallowedTools.join(","))
```

Os nomes das propriedades TypeScript permanecem em camelCase — a correcao se aplica apenas aos flags CLI.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-022 | filterEnv helper | Criar `filterEnv()` e aplicar em `spawnAndStream()` |
| F-023 | Remove env cast | Remover cast `as Record<string, string>` em `query.ts` |
| F-024 | Kebab-case flags | Corrigir `--allowedTools` → `--allowed-tools` e `--disallowedTools` → `--disallowed-tools` |

## Limites

- NAO alterar a assinatura publica de `Options.env` — continua `Record<string, string | undefined>`
- NAO alterar os nomes das propriedades TypeScript (`allowedTools`, `disallowedTools`)
- NAO exportar `filterEnv()` — e helper interno

## Dependencias

Nenhuma. Alteracoes sao independentes.
