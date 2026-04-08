# openclaude-sdk - Correcoes de Gerenciamento de Processo

Corrigir sinal de interrupt (SIGINT vs SIGTERM) e deduplicar resolucao de comando.

---

## Objetivo

Resolver D-008 e D-009: o interrupt usa SIGTERM (pode nao salvar historico) e a resolucao do comando do subprocess tem tres mecanismos sobrepostos.

---

## 1. Interrupt com SIGINT (D-008)

### Problema

`spawnAndStream()` registra abort handler com `proc.kill("SIGTERM")`. O CLI espera SIGINT (Ctrl+C) para interromper graciosamente e salvar historico da sessao.

### Correcao

| Plataforma | Sinal | Justificativa |
|------------|-------|---------------|
| Linux/macOS | `SIGINT` | Sinal padrao de interrupcao gracioso |
| Windows | `SIGINT` via `process.kill(proc.pid!, "SIGINT")` | Windows nao suporta SIGINT via `proc.kill()` nativamente — testar e documentar fallback |

### Implementacao

```typescript
// Em spawnAndStream():
const onAbort = () => {
  if (proc.pid) {
    proc.kill("SIGINT")
  }
}
```

### Fallback Windows

Se `SIGINT` nao funcionar no Windows (ChildProcess.kill pode ignorar), usar:

```typescript
const onAbort = () => {
  if (process.platform === "win32" && proc.pid) {
    // Windows: gerar evento Ctrl+C via stdin
    proc.stdin?.write("\x03")
  } else if (proc.pid) {
    proc.kill("SIGINT")
  }
}
```

### Timeout fallback

Se o processo nao encerrar em 5s apos SIGINT, enviar SIGTERM:

```typescript
const onAbort = () => {
  if (proc.pid) {
    proc.kill("SIGINT")
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill("SIGTERM")
      }
    }, 5000)
  }
}
```

---

## 2. Deduplicar Resolucao de Comando (D-009)

### Problema

Tres mecanismos sobrepostos para resolver o executavel:

| Mecanismo | Local | Comportamento |
|-----------|-------|---------------|
| `resolveCommand()` | `registry.ts` | Sempre retorna `"openclaude"` |
| `options.pathToClaudeCodeExecutable` | `query.ts` | Override do caminho |
| Logica Windows `cmd /c` | `spawnAndStream()` | Wrapping para evitar ENOENT |

### Solucao

1. **Eliminar `resolveCommand()`** — funcao inutil (retorna constante). Marcar como deprecated e remover do uso interno.
2. **Unificar em `resolveExecutable()`** — nova funcao em `process.ts`:

```typescript
export function resolveExecutable(options: Options = {}): {
  command: string
  prependArgs: string[]
} {
  const base = options.pathToClaudeCodeExecutable || "openclaude"

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", base],
    }
  }

  return { command: base, prependArgs: [] }
}
```

3. **Atualizar `query()`** para usar `resolveExecutable()`:

```typescript
const { command, prependArgs } = resolveExecutable(options)
const args = [...prependArgs, ...buildCliArgs(options)]
```

4. **Simplificar `spawnAndStream()`** — remover logica Windows interna. Recebe `command` e `args` ja resolvidos.

---

## Criterios de Aceite

- [ ] `interrupt()` envia SIGINT (nao SIGTERM)
- [ ] Apos 5s sem encerrar, SIGTERM e enviado como fallback
- [ ] No Windows, Ctrl+C (0x03) e enviado via stdin
- [ ] `resolveExecutable()` unifica resolucao de comando + Windows wrapping
- [ ] `spawnAndStream()` nao tem mais logica de Windows interna
- [ ] `resolveCommand()` esta marcada como deprecated
- [ ] `pathToClaudeCodeExecutable` continua funcionando como override

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `spawnAndStream()` abort handler | S-004 |
| `resolveExecutable()` em `process.ts` | S-004 |
| `resolveCommand()` deprecation | S-004 |
| `query()` em `query.ts` | S-004 |
| Discoveries | D-008, D-009 |
