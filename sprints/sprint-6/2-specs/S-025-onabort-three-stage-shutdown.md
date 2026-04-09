# openclaude-sdk - Shutdown de 3 Estagios em onAbort

Atualizar o handler `onAbort` em `spawnAndStream()` para usar 3 estagios: fechar stdin, SIGTERM, SIGKILL.

---

## Objetivo

Resolver D-036 (score 7): o `onAbort` handler em `src/process.ts` (linhas 207-219) usa SIGINT/Ctrl+C como primeiro estagio e SIGTERM como fallback. Dois problemas:

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Usa SIGINT em vez de stdin.end | Para shutdowns programaticos (AbortController), o padrao correto e EOF no stdin, nao SIGINT |
| 2 | Sem SIGKILL como fallback final | Se SIGTERM nao funcionar, processo fica pendente |

**Distincao importante**: `interrupt()` (interrupcao do usuario) **mantem** SIGINT. `onAbort` (shutdown programatico via AbortController) muda para stdin.end.

---

## Estado Atual

**Arquivo**: `src/process.ts`, `onAbort` handler, linhas 207-219

```typescript
const onAbort = () => {
  if (process.platform === "win32") {
    proc.stdin?.write("\x03")
  } else {
    proc.kill("SIGINT")
  }
  // Fallback: if process hasn't exited in 5s, escalate to SIGTERM
  sigintFallbackTimer = setTimeout(() => {
    if (!proc.killed && proc.exitCode === null) {
      proc.kill("SIGTERM")
    }
  }, 5000)
}
```

Dois estagios: SIGINT → SIGTERM. Sem SIGKILL. Usa SIGINT para shutdown programatico.

---

## Implementacao

### Substituir o bloco `onAbort`

```typescript
const onAbort = () => {
  stdinClosed = true  // flag de S-026 — setar ANTES de end()

  // Estagio 1: fechar stdin (EOF)
  proc.stdin?.end()

  // Estagio 2: apos 5s sem exit, SIGTERM
  sigintFallbackTimer = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM")

      // Estagio 3: apos mais 5s, SIGKILL
      setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill("SIGKILL")
        }
      }, 5000)
    }
  }, 5000)
}
```

### Variavel `sigintFallbackTimer`

O nome `sigintFallbackTimer` torna-se impreciso pois nao ha mais SIGINT. Renomear para `shutdownFallbackTimer`:

```typescript
let shutdownFallbackTimer: ReturnType<typeof setTimeout> | undefined
```

Atualizar a referencia no cleanup do `streamGen()` (linha 304):

```typescript
if (shutdownFallbackTimer) clearTimeout(shutdownFallbackTimer)
```

### Cleanup de timers aninhados

O timer do estagio 3 (SIGKILL) precisa ser limpo se o processo sair antes. Duas abordagens:

**Abordagem A — listener de exit** (recomendada):

```typescript
const onAbort = () => {
  stdinClosed = true
  proc.stdin?.end()

  let sigkillTimer: ReturnType<typeof setTimeout> | undefined
  const cleanup = () => {
    if (shutdownFallbackTimer) clearTimeout(shutdownFallbackTimer)
    if (sigkillTimer) clearTimeout(sigkillTimer)
  }
  proc.once("exit", cleanup)

  shutdownFallbackTimer = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM")
      sigkillTimer = setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill("SIGKILL")
        }
      }, 5000)
    }
  }, 5000)
}
```

**Abordagem B — guard `exitCode === null`** (mais simples):

Os guards `if (proc.exitCode === null)` antes de cada `proc.kill()` ja previnem envio de sinais a processo morto. Os timers expiram inofensivamente. Aceitavel para timers curtos (5s).

### `interrupt()` permanece inalterado

A funcao `interrupt()` (exposta ao consumidor para interromper mid-stream) **nao e afetada** por esta spec. Ela continua usando SIGINT:

```typescript
// Em query.ts — nao modificar
function interrupt(): void {
  if (process.platform === "win32") {
    handle.writeStdin("\x03")
  } else {
    // SIGINT para interrupção do usuario — comportamento preservado
  }
}
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| AbortController.abort() com processo responsivo | SIGINT → processo sai | stdin.end → processo sai (sessao salva) |
| AbortController.abort() com processo lento | SIGINT → 5s → SIGTERM | stdin.end → 5s → SIGTERM |
| AbortController.abort() com processo travado | SIGINT → 5s → SIGTERM → pendente | stdin.end → 5s → SIGTERM → 5s → SIGKILL |
| `interrupt()` (usuario) | SIGINT | SIGINT (sem mudanca) |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | 206 | Renomear `sigintFallbackTimer` → `shutdownFallbackTimer` |
| `src/process.ts` | 207-219 | Substituir `onAbort` por versao de 3 estagios |
| `src/process.ts` | 304 | Atualizar referencia ao timer renomeado |

---

## Criterios de Aceite

- [ ] `onAbort` fecha stdin como estagio 1 (nao envia SIGINT)
- [ ] SIGTERM e estagio 2, enviado apos 5s se processo nao saiu
- [ ] SIGKILL e estagio 3, enviado apos mais 5s se processo nao saiu
- [ ] Flag `stdinClosed` e setada antes de `proc.stdin?.end()` (integracao com S-026)
- [ ] `sigintFallbackTimer` renomeado para `shutdownFallbackTimer`
- [ ] `interrupt()` em `query.ts` continua usando SIGINT (nao afetado)
- [ ] Timers sao limpos quando o processo sai antes do timeout
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Handler `onAbort` de 3 estagios | S-025 |
| Rename `sigintFallbackTimer` → `shutdownFallbackTimer` | S-025 |
| Discovery | D-036 |
| Dependencia direta | S-026 (flag `stdinClosed`) |
| Spec relacionada | S-024 (mesma sequencia de 3 estagios em `close()`) |
