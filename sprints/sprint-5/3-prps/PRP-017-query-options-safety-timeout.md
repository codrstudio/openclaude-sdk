# PRP-017 — Query Options Safety & Timeout

## Objetivo

Eliminar a mutacao de `options.env` em `query()` e expor `timeoutMs` na API publica, conectando-o ao mecanismo de timeout ja existente em `spawnAndStream()`.

Referencia: specs S-019 (D-030) e S-020 (D-029).

## Execution Mode

`implementar`

## Contexto

Dois problemas relacionados em `src/query.ts`:

1. **Mutacao de `options`** (D-030, score 7): `query()` faz `options.env = { ...options.env, ...envFromRegistry }` na linha 50, mutando o objeto do caller. Se o mesmo `options` for reutilizado entre queries com diferentes registries, o `env` acumula vars de cada chamada anterior. Bug silencioso e dificil de debugar.

2. **`timeoutMs` inacessivel** (D-029, score 6): `spawnAndStream()` ja implementa timeout via `setTimeout(() => proc.kill("SIGTERM"), options.timeoutMs)` (linhas 209-212 de `src/process.ts`), mas `query()` nunca passa esse valor. O tipo `Options` nao tem o campo. Usuarios de automacao precisam criar `AbortController` + `setTimeout()` manualmente como workaround.

## Especificacao

### 1. Eliminar mutacao de `options` em `query()` (`src/query.ts`, linhas 45-62)

**Antes:**

```typescript
const { prompt, model, registry, options = {} } = params

if (registry && model) {
  const envFromRegistry = resolveModelEnv(registry, model)
  options.env = { ...options.env, ...envFromRegistry }
}

const { command, prependArgs } = resolveExecutable(options)
const args = [...prependArgs, ...buildCliArgs(options)]
const abortController = options.abortController ?? new AbortController()
```

**Depois:**

```typescript
const { prompt, model, registry, options = {} } = params

let resolvedOptions = options
if (registry && model) {
  const envFromRegistry = resolveModelEnv(registry, model)
  resolvedOptions = { ...options, env: { ...options.env, ...envFromRegistry } }
}

const { command, prependArgs } = resolveExecutable(resolvedOptions)
const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
const abortController = resolvedOptions.abortController ?? new AbortController()
```

Substituir **todas** as referencias a `options` apos o bloco por `resolvedOptions`:

| Referencia | Antes | Depois |
|------------|-------|--------|
| `resolveExecutable(...)` | `options` | `resolvedOptions` |
| `buildCliArgs(...)` | `options` | `resolvedOptions` |
| `options.abortController` | `options.abortController` | `resolvedOptions.abortController` |
| `options.cwd` | `options.cwd` | `resolvedOptions.cwd` |
| `options.env` | `options.env` | `resolvedOptions.env` |
| `options.permissionMode` | `options.permissionMode` | `resolvedOptions.permissionMode` |

### 2. Adicionar `timeoutMs` ao tipo `Options` (`src/types/options.ts`)

Inserir apos `thinking?: ThinkingConfig` (linha ~303):

```typescript
timeoutMs?: number
```

### 3. Passar `timeoutMs` para `spawnAndStream()` em `query()` (`src/query.ts`)

**Antes:**

```typescript
const { stream, writeStdin } = spawnAndStream(command, args, prompt, {
  cwd: resolvedOptions.cwd,
  env: resolvedOptions.env,
  signal: abortController.signal,
  permissionMode: resolvedOptions.permissionMode,
})
```

**Depois:**

```typescript
const { stream, writeStdin } = spawnAndStream(command, args, prompt, {
  cwd: resolvedOptions.cwd,
  env: resolvedOptions.env,
  signal: abortController.signal,
  timeoutMs: resolvedOptions.timeoutMs,
  permissionMode: resolvedOptions.permissionMode,
})
```

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-040 | queryOptionsImmutability | Substituir mutacao de `options.env` por copia local `resolvedOptions` em `query()` |
| F-041 | timeoutMsOption | Adicionar `timeoutMs?: number` ao `Options` e passar para `spawnAndStream()` em `query()` |

## Limites

- NAO alterar a assinatura publica de `query()` — os parametros continuam os mesmos
- NAO alterar o mecanismo de timeout em `spawnAndStream()` — ja esta implementado e correto
- NAO adicionar validacao de `timeoutMs` (ex: minimo, maximo) — o consumidor e responsavel
- NAO alterar `continueSession()` — delega para `query()` e herda o fix automaticamente
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs.
