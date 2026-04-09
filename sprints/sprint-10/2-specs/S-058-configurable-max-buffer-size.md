# openclaude-sdk - Tornar MAX_BUFFER_SIZE Configuravel via Options

Adicionar `Options.maxBufferSize` para permitir ajuste do limite de buffer do parser JSON.

---

## Objetivo

Resolver D-066 (score 3): o limite de buffer para JSON multi-linha esta fixo em `1_048_576` bytes (1MB). Prompts grandes com imagens base64 ou ferramentas que retornam dados binarios extensos podem exceder 1MB legitimamente. O limite deve ser configuravel via `Options.maxBufferSize`. Re-introducao do gap do sprint-8.

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `streamGen()`, linha 323

```typescript
const MAX_BUFFER_SIZE = 1_048_576 // 1MB
```

Valor hardcoded, sem forma de ajuste.

**Arquivo**: `src/types/options.ts`, interface `Options`

Nao possui campo `maxBufferSize`.

---

## Implementacao

### 1. Adicionar campo a `Options`

**Arquivo**: `src/types/options.ts`, adicionar a interface `Options`

```typescript
/** Tamanho maximo do buffer JSON em bytes (padrao: 1MB) */
maxBufferSize?: number
```

### 2. Propagar para `spawnAndStream()`

**Arquivo**: `src/process.ts`, funcao `spawnAndStream()` — adicionar `maxBufferSize` ao objeto de opcoes

**Antes** (linha 187):

```typescript
options: {
  cwd?: string
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  permissionMode?: string
} = {},
```

**Depois:**

```typescript
options: {
  cwd?: string
  env?: Record<string, string | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  permissionMode?: string
  maxBufferSize?: number
} = {},
```

### 3. Usar valor configuravel em `streamGen()`

**Arquivo**: `src/process.ts`, funcao `streamGen()`, linha 323

**Antes:**

```typescript
const MAX_BUFFER_SIZE = 1_048_576 // 1MB
```

**Depois:**

```typescript
const MAX_BUFFER_SIZE = options.maxBufferSize ?? 1_048_576 // 1MB default
```

### 4. Passar opcao em `query()`

**Arquivo**: `src/query.ts`, chamada a `spawnAndStream()` (linha 217)

**Antes:**

```typescript
const { stream, writeStdin, close: closeProc } = spawnAndStream(command, args, prompt, {
  cwd: resolvedOptions.cwd,
  env: resolvedOptions.env,
  signal: abortController.signal,
  permissionMode: resolvedOptions.permissionMode,
  timeoutMs: resolvedOptions.timeoutMs,
})
```

**Depois:**

```typescript
const { stream, writeStdin, close: closeProc } = spawnAndStream(command, args, prompt, {
  cwd: resolvedOptions.cwd,
  env: resolvedOptions.env,
  signal: abortController.signal,
  permissionMode: resolvedOptions.permissionMode,
  timeoutMs: resolvedOptions.timeoutMs,
  maxBufferSize: resolvedOptions.maxBufferSize,
})
```

---

## Criterios de Aceite

- [ ] `Options.maxBufferSize` existe e e opcional
- [ ] Sem `maxBufferSize`: limite padrao de 1MB (regressao)
- [ ] `maxBufferSize: 5_242_880` permite buffer de ate 5MB
- [ ] Buffer excedendo o limite configurado lanca erro com tamanho no texto
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `Options.maxBufferSize` | S-058 |
| `spawnAndStream()` — buffer limit | S-058 |
| `streamGen()` — MAX_BUFFER_SIZE | S-058 |
| Discovery | D-066 |
| Spec anterior | sprint-8 (dropped no sprint-9) |
