# openclaude-sdk - Mapear executable e executableArgs em resolveExecutable

Implementar suporte a `Options.executable` e `Options.executableArgs` em `resolveExecutable()`.

---

## Objetivo

Resolver D-058 (score 5): a interface `Options` tem `executable?: "bun" | "deno" | "node"` e `executableArgs?: string[]` mas `resolveExecutable()` nunca os usa. O CLI do OpenClaude pode ser invocado com runtimes alternativos (ex: `node --experimental-vm-modules openclaude`). Silenciosamente ignorado.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `executable` ignorado | Impossivel usar runtime alternativo (bun, deno) |
| 2 | `executableArgs` ignorado | Flags de runtime (ex: `--experimental-vm-modules`) nao passadas |

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `resolveExecutable()`, linhas 14-28

```typescript
export function resolveExecutable(options?: Options): {
  command: string
  prependArgs: string[]
} {
  const base = options?.pathToClaudeCodeExecutable || "openclaude"

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", base],
    }
  }

  return { command: base, prependArgs: [] }
}
```

---

## Implementacao

**Arquivo**: `src/process.ts`, substituir `resolveExecutable()` (linhas 14-28)

**Antes:**

```typescript
export function resolveExecutable(options?: Options): {
  command: string
  prependArgs: string[]
} {
  const base = options?.pathToClaudeCodeExecutable || "openclaude"

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", base],
    }
  }

  return { command: base, prependArgs: [] }
}
```

**Depois:**

```typescript
export function resolveExecutable(options?: Options): {
  command: string
  prependArgs: string[]
} {
  const base = options?.pathToClaudeCodeExecutable || "openclaude"
  const extraArgs = options?.executableArgs ?? []

  if (options?.executable) {
    // Runtime explicito: usar executable como command, base como script arg
    if (process.platform === "win32") {
      return {
        command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        prependArgs: ["/c", options.executable, ...extraArgs, base],
      }
    }
    return { command: options.executable, prependArgs: [...extraArgs, base] }
  }

  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", base, ...extraArgs],
    }
  }

  return { command: base, prependArgs: [...extraArgs] }
}
```

Logica:
- Sem `executable`: comportamento atual (base como command, extraArgs apos)
- Com `executable`: usa-o como command, base como primeiro arg do script, extraArgs entre eles
- Windows: sempre envolve em `cmd.exe /c`

---

## Criterios de Aceite

- [ ] `executable: "node"` gera `node openclaude` como comando
- [ ] `executable: "bun"` gera `bun openclaude`
- [ ] `executableArgs: ["--experimental-vm-modules"]` gera `node --experimental-vm-modules openclaude`
- [ ] Sem `executable` nem `executableArgs`: comportamento identico ao atual
- [ ] Windows: `cmd.exe /c` envolve corretamente em todos os cenarios
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `resolveExecutable()` | S-052 |
| `Options.executable` | S-052 |
| `Options.executableArgs` | S-052 |
| Discovery | D-058 |
