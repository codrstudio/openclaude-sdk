# PRP-020 — Shutdown 3-Stage Graceful

## Objetivo

Implementar shutdown gracioso de 3 estagios (stdin.end → SIGTERM → SIGKILL) em `close()` e `onAbort`, e adicionar flag `stdinClosed` em `writeStdin()` para prevenir EPIPE na janela entre stdin.end e exit do processo.

Referencia: specs S-024 (D-035), S-025 (D-036), S-026 (D-037).

## Execution Mode

`implementar`

## Contexto

O shutdown atual em `src/process.ts` tem falhas de confiabilidade:

1. **`close()` (linha 246-248)**: chama `proc.kill("SIGTERM")` diretamente, sem fechar stdin antes. O CLI nao recebe EOF e pode nao salvar a sessao antes de morrer (issue #625 Python SDK). Sem SIGKILL, processos que ignoram SIGTERM ficam pendentes.

2. **`onAbort` (linhas 207-219)**: usa SIGINT como primeiro estagio para shutdowns programaticos (AbortController). O padrao correto para shutdown programatico e fechar stdin (EOF), nao SIGINT. Sem SIGKILL como fallback final.

3. **`writeStdin()` (linhas 239-244)**: apos `close()` ou `onAbort` fecharem stdin, existe uma janela onde `proc.exitCode === null` e `proc.killed === false` mas stdin esta fechado. O guard atual nao detecta esse estado, causando EPIPE nao tratado.

Referencia Python: `ref/subprocess_cli.py`, metodo `close()` (linhas 451-499) implementa o padrao de 3 estagios.

## Especificacao

### Feature F-044 — Flag `stdinClosed` e guard em `writeStdin()`

**Pré-requisito** das demais features. Adiciona a infraestrutura que F-045 e F-046 consomem.

**1. Declarar flag `stdinClosed`** dentro de `spawnAndStream()`, apos a declaracao de `sigintFallbackTimer` (linha ~206):

```typescript
let stdinClosed = false
```

**2. Atualizar `writeStdin()`** (linhas 239-244) — adicionar guard `stdinClosed` como primeira verificacao:

```typescript
function writeStdin(data: string): void {
  if (stdinClosed) {
    throw new Error("writeStdin: stdin already closed")
  }
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("writeStdin: process has already exited")
  }
  proc.stdin?.write(data)
}
```

A verificacao de `stdinClosed` vem **antes** de `exitCode`/`killed` para garantir a mensagem de erro mais precisa.

**3. Setar flag no bloco `closeAfterPrompt`** (linhas 231-237) — o trecho que fecha stdin apos enviar prompt em modo `bypassPermissions`/`dontAsk`:

```typescript
proc.stdin?.write(prompt + "\n")
if (closeAfterPrompt) {
  stdinClosed = true
  proc.stdin?.end()
}
```

A flag nao e exportada — e variavel local de `spawnAndStream()`.

### Feature F-045 — `close()` com shutdown de 3 estagios

**1. Tornar `close()` assincrona** — muda de `() => void` para `() => Promise<void>`.

**2. Implementar os 3 estagios**:

```typescript
function close(): Promise<void> {
  stdinClosed = true

  return new Promise<void>((resolve) => {
    if (proc.exitCode !== null) {
      resolve()
      return
    }

    const onExit = () => {
      clearTimeout(sigtermTimer)
      clearTimeout(sigkillTimer)
      resolve()
    }
    proc.once("exit", onExit)

    // Estagio 1: fechar stdin (EOF)
    proc.stdin?.end()

    // Estagio 2: apos 5s sem exit, SIGTERM
    let sigkillTimer: ReturnType<typeof setTimeout>
    const sigtermTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill("SIGTERM")

        // Estagio 3: apos mais 5s, SIGKILL
        sigkillTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            proc.kill("SIGKILL")
          }
        }, 5000)
      }
    }, 5000)
  })
}
```

**3. Atualizar tipo de retorno de `spawnAndStream()`**:

```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: { /* ... */ },
): {
  stream: AsyncGenerator<SDKMessage>
  writeStdin: (data: string) => void
  close: () => Promise<void>  // era () => void
}
```

**4. Propagar mudanca de assinatura** — arquivos afetados:

| Arquivo | Mudanca |
|---------|---------|
| `src/process.ts` | Implementacao + tipo de retorno |
| `src/query.ts` | Adicionar `await` nas chamadas de `close()` |
| `src/types/index.ts` | Atualizar tipo se `close` estiver exposto no tipo `Query` |

### Feature F-046 — `onAbort` com shutdown de 3 estagios

**1. Renomear `sigintFallbackTimer`** → `shutdownFallbackTimer` (linha ~206):

```typescript
let shutdownFallbackTimer: ReturnType<typeof setTimeout> | undefined
```

Atualizar a referencia no cleanup do `streamGen()` (linha ~304):

```typescript
if (shutdownFallbackTimer) clearTimeout(shutdownFallbackTimer)
```

**2. Substituir o bloco `onAbort`** (linhas 207-219):

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

**3. `interrupt()` permanece inalterado** — continua usando SIGINT para interrupcoes do usuario. A distincao e intencional:

| Funcao | Uso | Estagio 1 |
|--------|-----|-----------|
| `close()` | Shutdown programatico | stdin.end (EOF) |
| `onAbort` | Shutdown via AbortController | stdin.end (EOF) |
| `interrupt()` | Interrupcao do usuario | SIGINT |

### Comportamento consolidado

| Cenario | Antes | Depois |
|---------|-------|--------|
| `close()` com processo responsivo | SIGTERM imediato, sessao pode nao salvar | stdin.end → exit gracioso, sessao salva |
| `close()` com processo que ignora EOF | SIGTERM imediato | stdin.end → 5s → SIGTERM |
| `close()` com processo travado | SIGTERM → pendente para sempre | stdin.end → 5s → SIGTERM → 5s → SIGKILL |
| `close()` com processo ja morto | `proc.kill()` lanca ESRCH | Resolve imediatamente |
| `abort()` com processo responsivo | SIGINT → exit | stdin.end → exit gracioso |
| `abort()` com processo travado | SIGINT → 5s → SIGTERM → pendente | stdin.end → 5s → SIGTERM → 5s → SIGKILL |
| `writeStdin()` apos `close()` | EPIPE nao tratado | `Error("stdin already closed")` |
| `writeStdin()` apos `onAbort` | EPIPE nao tratado | `Error("stdin already closed")` |
| `interrupt()` | SIGINT | Sem mudanca |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-044 | stdinClosedGuard | Declarar flag `stdinClosed`, adicionar guard em `writeStdin()`, setar flag em `closeAfterPrompt` |
| F-045 | closeThreeStage | Tornar `close()` async, implementar 3 estagios (stdin.end → SIGTERM → SIGKILL), propagar mudanca de assinatura |
| F-046 | onAbortThreeStage | Renomear timer, substituir `onAbort` por 3 estagios (stdin.end → SIGTERM → SIGKILL), cleanup de timers |

## Limites

- NAO alterar `interrupt()` em `query.ts` — continua usando SIGINT
- NAO alterar o mecanismo de timeout existente em `spawnAndStream()` (linhas 209-212)
- NAO exportar a flag `stdinClosed` — e variavel local de `spawnAndStream()`
- NAO extrair helper `waitForExit()` como funcao exportada — se necessario, manter local
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar `buildCliArgs()`, `resolveExecutable()` ou qualquer outra funcao de `process.ts`

## Dependencias

Nenhuma dependencia de outros PRPs. Todas as 3 features sao internas a este PRP, com ordem de implementacao: F-044 → F-045 → F-046.
