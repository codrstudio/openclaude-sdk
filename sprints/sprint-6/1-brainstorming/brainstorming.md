# Brainstorming — openclaude-sdk (Sprint 6)

## Contexto

O TASK.md define o `openclaude-sdk` como um SDK TypeScript programático para o OpenClaude CLI. As waves 1–5 implementaram D-001 a D-034, cobrindo o feature set completo, polimento de bugs e MCP servers. O sprint 5 concluiu com F-038 a F-043 todas em status `passing`.

O foco desta wave é **confiabilidade no shutdown de subprocessos**:

O Run Prompt `shutdown-sigkill-fallback` (backlog/03) descreve o problema central: a função `close()` atual apenas chama `proc.kill("SIGTERM")` sem fechar stdin antes. Isso impede que o CLI salve a sessão corretamente (referência: issue #625 no Python SDK). Além disso, se o processo ignorar SIGTERM, ele fica pendente indefinidamente — não há SIGKILL como fallback.

O backlog/04 (`stdin-write-lock`) é o complemento natural: uma vez que `close()` feche stdin como primeiro estágio do shutdown, `writeStdin()` precisa de um guard que previna EPIPE quando chamado após `close()`.

---

## Funcionalidades mapeadas (estado atual da codebase)

### `src/process.ts` — foco da wave

**`resolveExecutable(options?)`** — resolve o comando `openclaude` com suporte Windows via `cmd /c`.

**`filterEnv(env)`** — filtra valores `undefined` de um env parcial antes de passar ao child process.

**`buildCliArgs(options)`** — mapeia `Options` completo para args do CLI: output format, permissions, session, system prompt, allowed/disallowed tools, model, maxTurns, additionalDirectories, betas, effort, thinking, maxBudgetUsd, debug, mcpServers (stdio + sse/http), extraArgs.

**`spawnAndStream(command, args, prompt, options)`** — função principal que:
- Spawna o processo com `stdio: ["pipe", "pipe", "pipe"]`
- Gerencia abort handling via `onAbort`:
  - Estágio 1: SIGINT (ou Ctrl+C byte no Windows)
  - Estágio 2: após 5s, SIGTERM
- Gerencia timeout via `setTimeout → SIGTERM`
- Envia prompt via stdin; fecha stdin imediatamente se `permissionMode` for `bypassPermissions` ou `dontAsk`
- Expõe `writeStdin(data)` com guard de processo vivo (`exitCode !== null || killed`)
- Expõe `close()` que apenas chama `proc.kill("SIGTERM")` — **sem fechar stdin, sem SIGKILL**
- Parse de JSONL via readline com buffer acumulativo (D-026), skip de não-JSON, limite 1MB

### Gaps identificados no shutdown atual

#### `close()` — 2 problemas

1. **Não fecha stdin antes de enviar sinal**: O CLI precisa receber EOF no stdin para saber que deve salvar a sessão e sair graciosamente. Sem EOF, o CLI pode interromper o write do arquivo de sessão ao receber SIGTERM, corrompendo o histórico (issue #625).

2. **Sem SIGKILL como fallback**: Se o CLI ignorar SIGTERM (ex: processo travado numa operação de I/O), o subprocesso fica pendente. O chamador de `close()` não tem como garantir que o processo realmente morreu.

#### `onAbort` handler — diferença intencional vs. `close()`

O `onAbort` atual usa SIGINT (ou Ctrl+C no Windows) — esse comportamento deve ser **mantido** para interrupções do usuário via `interrupt()`. Porém, para shutdowns programáticos (via `close()`), o padrão correto é fechar stdin primeiro, conforme a referência Python.

O Run Prompt detalha que `onAbort` também deve ser atualizado para o padrão de 3 estágios — mas a distinção entre `interrupt()` (preserva SIGINT) e `close()` (fecha stdin) deve permanecer clara.

#### `writeStdin()` — race condition com `close()`

O guard atual em `writeStdin()` verifica `proc.exitCode !== null || proc.killed`. Quando `close()` fechar stdin (`proc.stdin.end()`), o processo ainda estará vivo (`exitCode === null`, `killed === false`). Uma chamada a `writeStdin()` entre `stdin.end()` e o exit do processo lançará EPIPE não tratado — que pode crashar o consumidor da SDK.

A solução (backlog/04) é uma flag `stdinClosed` que é setada em `close()` antes de `proc.stdin?.end()`, e verificada em `writeStdin()`.

---

## Lacunas e oportunidades

### Gap 35 — `close()` não fecha stdin antes de enviar sinais (BUG, CRÍTICO)

**Arquivo**: `src/process.ts`, função `close()`, linha 246–248

**Problema**: `close()` chama diretamente `proc.kill("SIGTERM")` sem fechar stdin. O CLI não recebe EOF e pode não salvar a sessão antes de ser terminado.

**Fix**: Implementar 3 estágios:
1. `proc.stdin?.end()` — sinaliza EOF ao CLI
2. Aguardar 5s (setTimeout); se o processo não saiu: `proc.kill("SIGTERM")`
3. Após mais 5s: se ainda vivo, `proc.kill("SIGKILL")`

A implementação de `close()` precisa ser assíncrona ou usar um padrão baseado em timers aninhados (análogo ao `onAbort` existente).

### Gap 36 — `onAbort` sem SIGKILL como último estágio (MELHORIA)

**Arquivo**: `src/process.ts`, `onAbort` handler, linhas 207–219

**Problema**: O `onAbort` faz SIGINT → SIGTERM após 5s. Se o processo ignorar SIGTERM, fica pendente.

**Fix**: Adicionar SIGKILL como terceiro estágio:
```typescript
const onAbort = () => {
  proc.stdin?.end()
  sigintFallbackTimer = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM")
      setTimeout(() => {
        if (proc.exitCode === null) proc.kill("SIGKILL")
      }, 5000)
    }
  }, 5000)
}
```

Nota: O `onAbort` usa stdin.end como estágio 1 (igual ao `close()`), pois ambos representam shutdown programático. O `interrupt()` (SIGINT) permanece separado para interrupções do usuário.

### Gap 37 — `writeStdin()` lança EPIPE quando chamado após `close()` (BUG)

**Arquivo**: `src/process.ts`, função `writeStdin()`, linhas 239–243

**Problema**: Após `close()` fechar stdin com `proc.stdin?.end()`, o processo ainda está vivo momentaneamente. O guard atual (`exitCode !== null || killed`) não detecta stdin fechado. Uma chamada a `writeStdin()` nesse intervalo lança EPIPE.

**Fix**: Flag `stdinClosed` setada atomicamente em `close()`:
```typescript
let stdinClosed = false

function writeStdin(data: string): void {
  if (stdinClosed) throw new Error("writeStdin: stdin already closed")
  if (proc.exitCode !== null || proc.killed) throw new Error("writeStdin: process has already exited")
  proc.stdin?.write(data)
}

function close(): void {
  stdinClosed = true
  proc.stdin?.end()
  // ... rest of shutdown stages
}
```

---

## Priorização

| Discovery | Tipo | Descrição curta | Score | Justificativa |
|-----------|------|-----------------|-------|---------------|
| D-035 | bug | `close()` 3-stage shutdown (stdin.end → SIGTERM → SIGKILL) | 9 | Bug de integridade: sem EOF no stdin, a sessão pode não ser salva. Sem SIGKILL, processos travados ficam pendentes. Impacto direto em qualquer automação que chame `close()`. |
| D-036 | improvement | `onAbort` 3-stage: stdin.end → SIGTERM → SIGKILL | 7 | Consistência: o abort handler atual já tem 2 estágios. Adicionar stdin.end e SIGKILL alinha o comportamento com `close()` e com a referência Python. |
| D-037 | bug | `writeStdin()` flag `stdinClosed` para prevenir EPIPE | 8 | Bug de segurança: EPIPE não tratado pode crashar o consumidor. Complemento obrigatório de D-035 — uma vez que `close()` feche stdin, `writeStdin()` precisa do guard. |
