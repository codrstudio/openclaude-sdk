# openclaude-sdk - Mapear mcpServers para Flags CLI

Implementar o mapeamento de `Options.mcpServers` para os flags `--mcp-server` e `--mcp-server-sse` em `buildCliArgs()`.

---

## Objetivo

Resolver D-032 (score 5): `Options.mcpServers?: Record<string, McpServerConfig>` esta tipado e documentado, mas `buildCliArgs()` ignora o campo silenciosamente. Usuarios que configuram MCP servers nao veem nenhum efeito.

---

## Estado Atual

### Tipo `McpServerConfig` (`src/types/options.ts`, linhas 29-51)

```typescript
export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig

export interface McpStdioServerConfig {
  type?: "stdio"
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpSSEServerConfig {
  type: "sse"
  url: string
  headers?: Record<string, string>
}

export interface McpHttpServerConfig {
  type: "http"
  url: string
  headers?: Record<string, string>
}
```

### `Options.mcpServers` (`src/types/options.ts`, linha 286)

```typescript
mcpServers?: Record<string, McpServerConfig>
```

### `buildCliArgs()` (`src/process.ts`, linhas 48-155)

Nao ha nenhum bloco tratando `options.mcpServers`.

---

## Formato dos Flags CLI

O OpenClaude CLI (herdado do Claude Code) aceita:

| Tipo | Flag | Formato |
|------|------|---------|
| stdio | `--mcp-server` | `name:command arg1 arg2` |
| sse | `--mcp-server-sse` | `name:url` (headers via env) |
| http | `--mcp-server-sse` | `name:url` (mesmo flag que SSE) |

Para servidores stdio com `env`, as vars devem ser injetadas no `env` do child process (ja passado via `spawnAndStream()`).

---

## Implementacao

### Adicionar bloco em `buildCliArgs()` (`src/process.ts`)

Inserir apos o bloco de `extraArgs` (que deve ser o ultimo por design — permite override), ou imediatamente antes dele:

```typescript
// MCP Servers
if (options.mcpServers) {
  for (const [name, config] of Object.entries(options.mcpServers)) {
    if (!config.type || config.type === "stdio") {
      const stdio = config as McpStdioServerConfig
      const parts = [stdio.command, ...(stdio.args ?? [])]
      args.push("--mcp-server", `${name}:${parts.join(" ")}`)
    } else if (config.type === "sse" || config.type === "http") {
      const remote = config as McpSSEServerConfig | McpHttpServerConfig
      args.push("--mcp-server-sse", `${name}:${remote.url}`)
    }
  }
}
```

### Import do tipo

Adicionar import de `McpStdioServerConfig`, `McpSSEServerConfig`, `McpHttpServerConfig` em `src/process.ts`:

```typescript
import type { Options, McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig } from "./types/options.js"
```

### Env de servidores stdio

Servidores stdio com `env` precisam que as vars sejam injetadas no processo filho. Isso ja acontece naturalmente se o caller colocar em `options.env`. Porem para melhor DX, `query()` deve propagar as env vars de cada servidor stdio para o `env` do spawn.

Adicionar em `query()` (`src/query.ts`), apos a resolucao do registry:

```typescript
// Propagar env de MCP stdio servers
if (resolvedOptions.mcpServers) {
  const mcpEnv: Record<string, string> = {}
  for (const config of Object.values(resolvedOptions.mcpServers)) {
    if ((!config.type || config.type === "stdio") && "env" in config && config.env) {
      Object.assign(mcpEnv, config.env)
    }
  }
  if (Object.keys(mcpEnv).length > 0) {
    resolvedOptions = {
      ...resolvedOptions,
      env: { ...resolvedOptions.env, ...mcpEnv },
    }
  }
}
```

### Headers de SSE/HTTP

O CLI nao suporta headers customizados via flag CLI. Se `headers` estiver presente, o campo sera ignorado silenciosamente (mesmo comportamento do SDK oficial da Anthropic). Nao ha flag equivalente no CLI.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | ~48, ~143 | Import de tipos MCP + bloco de mapeamento em `buildCliArgs()` |
| `src/query.ts` | ~52 | Propagacao de env vars de MCP stdio servers |

---

## Criterios de Aceite

- [ ] `options.mcpServers` com servidor stdio gera `--mcp-server name:command args`
- [ ] `options.mcpServers` com servidor SSE gera `--mcp-server-sse name:url`
- [ ] `options.mcpServers` com servidor HTTP gera `--mcp-server-sse name:url`
- [ ] Env vars de servidores stdio sao propagadas ao child process
- [ ] Headers de SSE/HTTP sao ignorados silenciosamente (sem erro)
- [ ] `extraArgs` continua sendo o ultimo bloco em `buildCliArgs()` (permite override)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Mapeamento de `mcpServers` em `buildCliArgs()` | S-021 |
| Propagacao de env MCP em `query()` | S-021 |
| Discovery | D-032 |
