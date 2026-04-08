# PRP-004 — Correcoes de Gerenciamento de Processo

## Objetivo

Corrigir o sinal de interrupt (SIGINT em vez de SIGTERM) e unificar a resolucao do comando do subprocess eliminando duplicacao.

Referencia: spec S-004 (D-008, D-009).

## Execution Mode

`implementar`

## Contexto

Dois problemas no gerenciamento de processos:
1. `interrupt()` usa SIGTERM, mas o CLI espera SIGINT para encerrar graciosamente e salvar historico
2. Tres mecanismos sobrepostos para resolver o executavel: `resolveCommand()`, `pathToClaudeCodeExecutable`, e logica Windows em `spawnAndStream()`

## Especificacao

### 1. Corrigir sinal de interrupt

Em `src/process.ts`, alterar o abort handler de `spawnAndStream()`:

**Plataforma Linux/macOS:**
```typescript
proc.kill("SIGINT")
```

**Plataforma Windows:**
```typescript
proc.stdin?.write("\x03")  // Ctrl+C via stdin
```

**Timeout fallback:** se o processo nao encerrar em 5 segundos apos SIGINT, enviar SIGTERM:
```typescript
setTimeout(() => {
  if (!proc.killed) {
    proc.kill("SIGTERM")
  }
}, 5000)
```

### 2. Criar resolveExecutable()

Nova funcao em `src/process.ts`:

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

### 3. Deprecar resolveCommand()

Em `src/registry.ts`, marcar `resolveCommand()` com `@deprecated` JSDoc. Manter a funcao para backward compat mas nao usa-la internamente.

### 4. Atualizar query()

Em `src/query.ts`, usar `resolveExecutable()`:

```typescript
const { command, prependArgs } = resolveExecutable(options)
const args = [...prependArgs, ...buildCliArgs(options)]
```

### 5. Simplificar spawnAndStream()

Remover a logica de Windows wrapping interna de `spawnAndStream()`. Ela recebe `command` e `args` ja resolvidos.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-012 | SIGINT interrupt | Trocar SIGTERM por SIGINT com fallback Windows e timeout |
| F-013 | resolveExecutable | Criar funcao unificada de resolucao de comando |
| F-014 | Cleanup spawnAndStream | Remover logica Windows duplicada de spawnAndStream |

## Limites

- NAO remover `resolveCommand()` — apenas deprecar
- NAO alterar a interface publica de `query()`
- `pathToClaudeCodeExecutable` continua funcionando como override

## Dependencias

- **PRP-001** — projeto precisa estar configurado e compilando
