# PRP-018 — MCP Servers Mapping

## Objetivo

Implementar o mapeamento de `Options.mcpServers` para os flags CLI `--mcp-server` e `--mcp-server-sse` em `buildCliArgs()`, e propagar env vars de servidores stdio ao child process.

Referencia: spec S-021 (D-032).

## Execution Mode

`implementar`

## Contexto

`Options.mcpServers?: Record<string, McpServerConfig>` esta tipado e documentado (`src/types/options.ts`, linhas 29-51 e 286), mas `buildCliArgs()` ignora o campo silenciosamente. Usuarios que configuram MCP servers nao veem nenhum efeito — divergencia entre tipo e comportamento.

Os tipos MCP ja existem:

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

Formato dos flags CLI do OpenClaude:

| Tipo | Flag | Formato |
|------|------|---------|
| stdio | `--mcp-server` | `name:command arg1 arg2` |
| sse | `--mcp-server-sse` | `name:url` |
| http | `--mcp-server-sse` | `name:url` (mesmo flag que SSE) |

## Especificacao

### 1. Import de tipos MCP em `src/process.ts`

Adicionar ao import existente de `Options`:

```typescript
import type { Options, McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig } from "./types/options.js"
```

### 2. Bloco de mapeamento em `buildCliArgs()` (`src/process.ts`)

Inserir imediatamente antes do bloco de `extraArgs` (que deve ser o ultimo por design — permite override):

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

### 3. Propagacao de env vars de servidores stdio em `query()` (`src/query.ts`)

Inserir apos a resolucao do registry (apos o bloco de `resolvedOptions` introduzido por PRP-017):

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

Nota: este bloco usa `resolvedOptions` introduzido por PRP-017 (F-040). Se PRP-017 nao tiver sido implementado, usar `options` e aplicar o mesmo padrao de copia local.

### Headers de SSE/HTTP

O CLI nao suporta headers customizados via flag. Se `headers` estiver presente, o campo sera ignorado silenciosamente — mesmo comportamento do SDK oficial da Anthropic.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-042 | mcpServersMapping | Mapear `options.mcpServers` para flags `--mcp-server` e `--mcp-server-sse` em `buildCliArgs()`, e propagar env vars de servidores stdio ao child process em `query()` |

## Limites

- NAO alterar os tipos MCP existentes em `src/types/options.ts`
- NAO implementar suporte a `headers` de SSE/HTTP — CLI nao suporta
- NAO mover o bloco apos `extraArgs` — extraArgs deve ser o ultimo (permite override)
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

- **PRP-017** (F-040): usa `resolvedOptions` introduzido pela correcao de imutabilidade. Se implementado antes de PRP-017, adaptar para usar `options` diretamente com copia local.
