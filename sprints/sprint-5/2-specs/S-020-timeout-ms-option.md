# openclaude-sdk - Expor timeoutMs na API Publica

Adicionar `timeoutMs` ao tipo `Options` e conecta-lo ao mecanismo de timeout ja existente em `spawnAndStream()`.

---

## Objetivo

Resolver D-029 (score 6): `spawnAndStream()` ja aceita `timeoutMs` como parametro (linhas 168-169 de `src/process.ts`) e implementa o timeout via `setTimeout(() => proc.kill("SIGTERM"), options.timeoutMs)`. Porem `query()` nunca passa esse valor, e `Options` nao tem o campo. Usuarios de automacao precisam criar `AbortController` + `setTimeout()` manualmente.

---

## Estado Atual

### `src/process.ts` — timeout ja implementado (linhas 209-212)

```typescript
let timer: ReturnType<typeof setTimeout> | undefined
if (options.timeoutMs) {
  timer = setTimeout(() => proc.kill("SIGTERM"), options.timeoutMs)
}
```

### `src/query.ts` — nao passa timeoutMs (linhas 57-62)

```typescript
const { stream, writeStdin } = spawnAndStream(command, args, prompt, {
  cwd: options.cwd,
  env: options.env,
  signal: abortController.signal,
  permissionMode: options.permissionMode,
})
```

### `src/types/options.ts` — campo ausente

`Options` nao tem `timeoutMs`.

---

## Implementacao

### 1. Adicionar campo em `Options` (`src/types/options.ts`)

```typescript
export interface Options {
  // ... campos existentes ...
  timeoutMs?: number
  // ...
}
```

Inserir apos `thinking?: ThinkingConfig` (linha 303), mantendo ordem alfabetica aproximada do bloco.

### 2. Passar em `query()` (`src/query.ts`)

**Antes:**

```typescript
const { stream, writeStdin } = spawnAndStream(command, args, prompt, {
  cwd: options.cwd,
  env: options.env,
  signal: abortController.signal,
  permissionMode: options.permissionMode,
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

Nota: usa `resolvedOptions` assumindo que S-019 ja foi aplicada. Se implementada antes de S-019, usar `options` no lugar.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/types/options.ts` | ~303 | Adicionar `timeoutMs?: number` ao `Options` |
| `src/query.ts` | 57-62 | Passar `timeoutMs` para `spawnAndStream()` |

---

## Criterios de Aceite

- [ ] `Options` exporta `timeoutMs?: number`
- [ ] `query({ prompt, options: { timeoutMs: 30000 } })` encerra o processo apos 30s
- [ ] Sem `timeoutMs`, comportamento e identico ao atual (sem timeout)
- [ ] Timer e limpo no exit do processo (ja implementado em `spawnAndStream`)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `timeoutMs` em `Options` | S-020 |
| Passagem de `timeoutMs` em `query()` | S-020 |
| Discovery | D-029 |
