# openclaude-sdk - Corrigir Mutacao de Objeto Compartilhado em startSdkServers

Eliminar side effect de `startSdkServers()` que muta o `McpSdkServerConfig` do usuario.

---

## Objetivo

Resolver D-059 (score 7): `startSdkServers()` em `src/query.ts` faz `sdkConfig._localPort = port` diretamente no objeto passado pelo usuario. Se o mesmo objeto de configuracao for reutilizado em multiplas queries simultaneas, a porta da query anterior permanece no objeto. A segunda query le `_localPort` da primeira (que pode ja estar fechada), causando falha de conexao.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Mutacao direta do objeto do usuario | Queries simultaneas compartilham estado |
| 2 | `_localPort` da query anterior | Conexao ao MCP server falha silenciosamente |

---

## Estado Atual

**Arquivo**: `src/query.ts`, funcao `startSdkServers()`, linhas 86-101

```typescript
async function startSdkServers(
  mcpServers: Record<string, import("./types/options.js").McpServerConfig>,
): Promise<RunningServer[]> {
  const running: RunningServer[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.type !== "sdk") continue

    const sdkConfig = config as McpSdkServerConfig
    const { port, close } = await startSdkServerTransport(sdkConfig)
    sdkConfig._localPort = port  // ← mutacao do objeto compartilhado
    running.push({ name, close })
  }

  return running
}
```

O problema esta na linha `sdkConfig._localPort = port` — muta o objeto original.

---

## Implementacao

### 1. Retornar mapa de portas em vez de mutar config

**Arquivo**: `src/query.ts`

Alterar `startSdkServers()` para retornar um mapa `name → port` junto com os servers:

**Antes:**

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

**Depois:**

```typescript
interface StartedServers {
  running: RunningServer[]
  portMap: Map<string, number>
}

async function startSdkServers(
  mcpServers: Record<string, import("./types/options.js").McpServerConfig>,
): Promise<StartedServers> {
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

### 2. Ajustar `lifecycleGenerator()` para criar copia local com portas

**Arquivo**: `src/query.ts`, funcao `lifecycleGenerator()`, linhas 206-244

Na secao que chama `startSdkServers()`, criar uma copia shallow de `resolvedOptions.mcpServers` com `_localPort` injetado apenas na copia local:

**Antes:**

```typescript
if (resolvedOptions.mcpServers) {
  runningServers = await startSdkServers(resolvedOptions.mcpServers)
}

const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
```

**Depois:**

```typescript
let buildOptions = resolvedOptions
if (resolvedOptions.mcpServers) {
  const { running, portMap } = await startSdkServers(resolvedOptions.mcpServers)
  runningServers = running

  // Criar copia local com _localPort — sem mutar o objeto do usuario
  const patchedServers: Record<string, import("./types/options.js").McpServerConfig> = {}
  for (const [name, config] of Object.entries(resolvedOptions.mcpServers)) {
    if (config.type === "sdk" && portMap.has(name)) {
      patchedServers[name] = { ...config, _localPort: portMap.get(name) }
    } else {
      patchedServers[name] = config
    }
  }
  buildOptions = { ...resolvedOptions, mcpServers: patchedServers }
}

const args = [...prependArgs, ...buildCliArgs(buildOptions)]
```

---

## Criterios de Aceite

- [ ] `startSdkServers()` nao muta nenhum objeto passado como parametro
- [ ] `_localPort` e atribuido apenas em copia local dentro de `lifecycleGenerator()`
- [ ] Queries simultaneas com o mesmo `mcpServers` nao interferem entre si
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `startSdkServers()` | S-050 |
| `lifecycleGenerator()` | S-050 |
| `McpSdkServerConfig._localPort` | S-050 |
| Discovery | D-059 |
