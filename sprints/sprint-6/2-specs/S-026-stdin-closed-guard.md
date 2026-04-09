# openclaude-sdk - Flag stdinClosed para Prevenir EPIPE em writeStdin()

Adicionar flag `stdinClosed` em `spawnAndStream()` que previne escrita em stdin apos `close()` ou `onAbort`.

---

## Objetivo

Resolver D-037 (score 8): apos D-035 e D-036 implementarem o fechamento de stdin como primeiro estagio do shutdown, `writeStdin()` precisa de um guard adicional para detectar que stdin foi fechado.

**O problema**: entre `proc.stdin?.end()` e o exit do processo, existe uma janela onde:

- `proc.exitCode === null` (processo ainda vivo)
- `proc.killed === false` (nenhum sinal enviado ainda)
- stdin esta fechado

O guard atual de `writeStdin()` nao detecta esse estado:

```typescript
function writeStdin(data: string): void {
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("writeStdin: process has already exited")
  }
  proc.stdin?.write(data)  // EPIPE — stdin ja foi closed
}
```

Uma chamada a `writeStdin()` nessa janela causa `EPIPE` nao tratado que pode crashar o consumidor.

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `writeStdin()`, linhas 239-244

```typescript
function writeStdin(data: string): void {
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("writeStdin: process has already exited")
  }
  proc.stdin?.write(data)
}
```

**Arquivo**: `src/process.ts`, funcao `close()`, linhas 246-248

```typescript
function close(): void {
  proc.kill("SIGTERM")  // sera alterado por S-024
}
```

Nao existe flag `stdinClosed`. O guard verifica apenas `exitCode` e `killed`.

---

## Implementacao

### 1. Declarar flag `stdinClosed`

Adicionar apos a declaracao de `sigintFallbackTimer` (linha 206):

```typescript
let shutdownFallbackTimer: ReturnType<typeof setTimeout> | undefined
let stdinClosed = false
```

### 2. Atualizar `writeStdin()`

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

A verificacao de `stdinClosed` vem **antes** da verificacao de `exitCode`/`killed`. Isso garante a mensagem de erro mais precisa: se stdin foi fechado via `close()`, o erro indica isso — nao "process has already exited" (que seria enganoso durante a janela).

### 3. Setar flag em `close()` e `onAbort`

Ambos S-024 e S-025 ja incluem `stdinClosed = true` como primeira linha antes de `proc.stdin?.end()`. Esta spec formaliza a flag e o guard.

**Em `close()` (S-024)**:

```typescript
function close(): Promise<void> {
  stdinClosed = true  // ← esta linha
  // ...
  proc.stdin?.end()
  // ...
}
```

**Em `onAbort` (S-025)**:

```typescript
const onAbort = () => {
  stdinClosed = true  // ← esta linha
  proc.stdin?.end()
  // ...
}
```

### 4. Setar flag quando stdin e fechado apos prompt

O bloco que fecha stdin em `bypassPermissions`/`dontAsk` (linhas 231-237) tambem deve setar a flag:

```typescript
proc.stdin?.write(prompt + "\n")
if (closeAfterPrompt) {
  stdinClosed = true
  proc.stdin?.end()
}
```

Isso previne `writeStdin()` apos stdin ja ter sido fechado automaticamente — cenario pouco provavel (nao ha razao para escrever em stdin no modo bypass), mas o guard garante consistencia.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `writeStdin()` apos `close()`, antes do exit | ❌ EPIPE nao tratado | ✅ `Error("stdin already closed")` |
| `writeStdin()` apos `onAbort`, antes do exit | ❌ EPIPE nao tratado | ✅ `Error("stdin already closed")` |
| `writeStdin()` apos processo sair | ✅ `Error("process has already exited")` | ✅ Sem mudanca |
| `writeStdin()` em modo `bypassPermissions` | ❌ EPIPE (stdin ja foi closed na linha 236) | ✅ `Error("stdin already closed")` |
| `writeStdin()` normal (processo vivo, stdin aberto) | ✅ Funciona | ✅ Funciona (sem mudanca) |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | ~206 | Declarar `let stdinClosed = false` |
| `src/process.ts` | 239-244 | Adicionar guard `stdinClosed` em `writeStdin()` |
| `src/process.ts` | 235-237 | Setar `stdinClosed = true` antes de `proc.stdin?.end()` no `closeAfterPrompt` |
| `src/process.ts` | (close) | `stdinClosed = true` — ja coberto por S-024 |
| `src/process.ts` | (onAbort) | `stdinClosed = true` — ja coberto por S-025 |

---

## Criterios de Aceite

- [ ] Flag `stdinClosed` declarada como `let stdinClosed = false` dentro de `spawnAndStream()`
- [ ] `writeStdin()` verifica `stdinClosed` antes de `exitCode`/`killed`
- [ ] Mensagem de erro e `"writeStdin: stdin already closed"` (distinta de `"process has already exited"`)
- [ ] `stdinClosed` e setada em `close()` antes de `proc.stdin?.end()`
- [ ] `stdinClosed` e setada em `onAbort` antes de `proc.stdin?.end()`
- [ ] `stdinClosed` e setada no bloco `closeAfterPrompt` antes de `proc.stdin?.end()`
- [ ] Flag nao e exportada (variavel local de `spawnAndStream()`)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Flag `stdinClosed` | S-026 |
| Guard em `writeStdin()` | S-026 |
| Guard em `closeAfterPrompt` | S-026 |
| Discovery | D-037 |
| Dependentes | S-024 (seta flag em `close()`), S-025 (seta flag em `onAbort`) |
