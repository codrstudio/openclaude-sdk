# PRP-035 — Process & Session Safety

## Objetivo

Corrigir 3 problemas de seguranca em runtime: mutacao de objeto compartilhado em `startSdkServers()`, opcoes conflitantes em `createSession()`/`resumeSession()`, e opcoes `executable`/`executableArgs` ignoradas por `resolveExecutable()`.

Referencia: specs S-050 (D-059), S-053 (D-060), S-052 (D-058).

## Execution Mode

`implementar`

## Contexto

### Mutacao de config compartilhado (S-050)

`startSdkServers()` em `src/query.ts` (linhas 86-101) faz `sdkConfig._localPort = port` diretamente no objeto passado pelo usuario. Se o mesmo objeto `McpSdkServerConfig` for reutilizado em multiplas queries simultaneas, a porta da primeira query permanece no objeto quando a segunda query le — mas a primeira porta pode ja estar fechada. Padrao comum em automacoes:

```typescript
const server = await createSdkMcpServer({ name: "tools", tools: [...] })
// Duas queries simultanias — segunda query herda _localPort da primeira
const q1 = query({ prompt: "A", options: { mcpServers: { tools: server } } })
const q2 = query({ prompt: "B", options: { mcpServers: { tools: server } } })
```

### Opcoes conflitantes em session (S-053)

`createSession().send()` em `src/session-v2.ts` (linhas 53-81) aceita `turnOptions` do caller sem filtragem. Se o caller passar `resume`, `sessionId` ou `continue`, essas opcoes conflitam com o gerenciamento interno da sessao. Exemplo:

```typescript
const session = createSession()
session.send("Hello", { resume: "old-session" }) // conflito com sessionId interno
```

O mesmo problema existe em `resumeSession().send()` (linhas 126-145).

### Executable ignorado (S-052)

`resolveExecutable()` em `src/process.ts` (linhas 14-28) usa apenas `pathToClaudeCodeExecutable` e ignora `Options.executable` (`"bun" | "deno" | "node"`) e `Options.executableArgs` (`string[]`). Usuarios que configuram `executable: "node"` com `executableArgs: ["--experimental-vm-modules"]` nao tem efeito.

## Especificacao

### Feature F-081 — Eliminar mutacao de config compartilhado

**1. Alterar `startSdkServers()` em `src/query.ts` (linhas 86-101):**

Estado atual:
```typescript
async function startSdkServers(
  mcpServers: Record<string, import("./types/options.js").McpServerConfig>,
): Promise<RunningServer[]> {
  const running: RunningServer[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.type !== "sdk") continue

    const sdkConfig = config as McpSdkServerConfig
    const { port, close } = await startSdkServerTransport(sdkConfig)
    sdkConfig._localPort = port
    running.push({ name, close })
  }

  return running
}
```

Novo:
```typescript
async function startSdkServers(
  mcpServers: Record<string, import("./types/options.js").McpServerConfig>,
): Promise<{ running: RunningServer[]; portMap: Map<string, number> }> {
  const running: RunningServer[] = []
  const portMap = new Map<string, number>()

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.type !== "sdk") continue

    const sdkConfig = config as McpSdkServerConfig
    const { port, close } = await startSdkServerTransport(sdkConfig)
    portMap.set(name, port)
    running.push({ name, close })
  }

  return { running, portMap }
}
```

Mudancas:
- Retornar `portMap` (name → port) em vez de mutar `_localPort` no objeto original
- O tipo de retorno muda de `RunningServer[]` para `{ running: RunningServer[]; portMap: Map<string, number> }`

**2. Atualizar `lifecycleGenerator()` em `src/query.ts` (linhas 206-244) para criar copia local dos configs:**

Estado atual (linhas 208-214):
```typescript
if (resolvedOptions.mcpServers) {
  runningServers = await startSdkServers(resolvedOptions.mcpServers)
}

// Build CLI args after _localPort is set on SDK server configs
const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
```

Novo:
```typescript
let optionsForCli = resolvedOptions
if (resolvedOptions.mcpServers) {
  const { running, portMap } = await startSdkServers(resolvedOptions.mcpServers)
  runningServers = running

  // Create shallow copy of mcpServers with _localPort injected only in the copy
  if (portMap.size > 0) {
    const patchedServers: Record<string, import("./types/options.js").McpServerConfig> = {}
    for (const [name, config] of Object.entries(resolvedOptions.mcpServers)) {
      const port = portMap.get(name)
      if (port != null && config.type === "sdk") {
        patchedServers[name] = { ...config, _localPort: port } as McpSdkServerConfig
      } else {
        patchedServers[name] = config
      }
    }
    optionsForCli = { ...resolvedOptions, mcpServers: patchedServers }
  }
}

const args = [...prependArgs, ...buildCliArgs(optionsForCli)]
```

Mudancas:
- `_localPort` e injetado apenas na copia local (`patchedServers`), nao no objeto original
- `optionsForCli` e passado para `buildCliArgs()` em vez de `resolvedOptions`
- O objeto original do usuario nunca e mutado

### Feature F-082 — Filtrar opcoes conflitantes em createSession/resumeSession

**1. Alterar `createSession().send()` em `src/session-v2.ts` (linhas 53-81):**

Estado atual:
```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  const mergedOptions: Options = {
    ...opts.options,
    ...turnOptions,
  }

  if (isFirstTurn) {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, sessionId },
    })
    isFirstTurn = false
  } else {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, resume: sessionId },
    })
  }

  return activeQuery
}
```

Novo:
```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  // Strip session-control fields to prevent conflicts with internal management
  const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = opts.options ?? {}
  const { resume: _r2, sessionId: _s2, continue: _c2, ...safeTurnOptions } = turnOptions ?? {}

  const mergedOptions: Options = {
    ...safeBaseOptions,
    ...safeTurnOptions,
  }

  if (isFirstTurn) {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, sessionId },
    })
    isFirstTurn = false
  } else {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, resume: sessionId },
    })
  }

  return activeQuery
}
```

Mudancas:
- Destructurar `resume`, `sessionId`, `continue` de ambos `opts.options` e `turnOptions` antes do merge
- Usar prefixo `_` para variaveis descartadas (convencao TypeScript)
- O `sessionId` e `resume` sao re-adicionados de forma controlada pelo proprio `send()`

**2. Aplicar mesma filtragem em `resumeSession().send()` (linhas 126-145):**

Estado atual:
```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  const mergedOptions: Options = {
    ...opts.options,
    ...turnOptions,
    resume: sessionId,
  }

  activeQuery = query({
    prompt,
    model: opts.model,
    registry: opts.registry,
    options: mergedOptions,
  })

  return activeQuery
}
```

Novo:
```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  const { resume: _r, sessionId: _s, continue: _c, ...safeBaseOptions } = opts.options ?? {}
  const { resume: _r2, sessionId: _s2, continue: _c2, ...safeTurnOptions } = turnOptions ?? {}

  const mergedOptions: Options = {
    ...safeBaseOptions,
    ...safeTurnOptions,
    resume: sessionId,
  }

  activeQuery = query({
    prompt,
    model: opts.model,
    registry: opts.registry,
    options: mergedOptions,
  })

  return activeQuery
}
```

### Feature F-083 — Mapear executable e executableArgs em resolveExecutable

**1. Alterar `resolveExecutable()` em `src/process.ts` (linhas 14-28):**

Estado atual:
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

Novo:
```typescript
export function resolveExecutable(options?: Options): {
  command: string
  prependArgs: string[]
} {
  const base = options?.pathToClaudeCodeExecutable || "openclaude"
  const extraArgs = options?.executableArgs ?? []

  // Explicit executable: use it as command, base path as first script argument
  if (options?.executable) {
    const exe = options.executable // "bun" | "deno" | "node"

    if (process.platform === "win32") {
      return {
        command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        prependArgs: ["/c", exe, ...extraArgs, base],
      }
    }

    return { command: exe, prependArgs: [...extraArgs, base] }
  }

  // Default: use base path directly
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      prependArgs: ["/c", ...extraArgs, base],
    }
  }

  // executableArgs without explicit executable: prepend before base
  if (extraArgs.length > 0) {
    return { command: base, prependArgs: [...extraArgs] }
  }

  return { command: base, prependArgs: [] }
}
```

Mudancas:
- Quando `executable` esta definido, usa-o como comando e `base` como argumento de script
- `executableArgs` sao inseridos entre o executavel e o script path
- Windows wrapping em `cmd.exe /c` e mantido em todos os cenarios
- Sem `executable`, comportamento identico ao atual (exceto `executableArgs` que sao prepended)

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Mesmo `McpSdkServerConfig` em 2 queries | `_localPort` da query-1 vaza para query-2 | Cada query tem sua copia isolada |
| `createSession().send("x", { resume: "old" })` | `resume: "old"` conflita com sessionId interno | `resume` filtrado, sessionId interno prevalece |
| `resumeSession("id").send("x", { continue: true })` | `continue: true` conflita com `resume: id` | `continue` filtrado, `resume: id` prevalece |
| `executable: "node", executableArgs: ["--experimental-vm-modules"]` | Ignorado, usa `openclaude` diretamente | `node --experimental-vm-modules openclaude ...` |
| `executable: "bun"` no Windows | Ignorado | `cmd.exe /c bun openclaude ...` |
| Sem `executable` nem `executableArgs` | `openclaude` | `openclaude` (identico) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-081 | fixSharedConfigMutation | `startSdkServers()` retorna `portMap` em vez de mutar `_localPort`. `lifecycleGenerator()` cria copia local com portas injetadas |
| F-082 | filterConflictingSessionOptions | Filtrar `resume`, `sessionId`, `continue` de `turnOptions` em `createSession().send()` e `resumeSession().send()` |
| F-083 | mapExecutableOptions | `resolveExecutable()` usa `Options.executable` como comando e `executableArgs` como args intermediarios |

## Limites

- NAO alterar a assinatura publica de `query()` — continua sincrono, retorna `Query`
- NAO alterar `buildCliArgs()` — mapeamento de flags e escopo de PRP-034
- NAO alterar `startSdkServerTransport()` ou `stopSdkServers()` — apenas `startSdkServers()` e `lifecycleGenerator()`
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar `src/types/options.ts` — todos os campos ja existem na interface

## Dependencias

Nenhuma dependencia de outros PRPs do sprint-10. Independente.
