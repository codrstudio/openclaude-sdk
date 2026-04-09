# PRP-022 — MCP Tool Factories

## Objetivo

Implementar `tool()` para definicao de MCP tools inline com Zod e `createSdkMcpServer()` para server in-process, habilitando MCP programatico sem servidor externo.

Referencia: spec S-028 (D-039, D-040).

## Execution Mode

`implementar`

## Contexto

`mcpServers` em Options suporta apenas `stdio`, `sse` e `http` — todos requerem server externo. Nao ha forma type-safe de definir tools inline com Zod nem criar MCP servers in-process. O SDK oficial da Anthropic oferece essa funcionalidade.

A integracao completa do transport stdio in-process (para que `type: "sdk"` funcione end-to-end com o CLI) e complexa e fica para uma fase futura. Esta PRP implementa a Fase 1: objetos, tipos, e erro explicito se `type: "sdk"` for passado sem transport.

## Especificacao

### Feature F-050 — `tool()` factory e tipos MCP

**1. Criar arquivo `src/mcp.ts`** com os tipos e a funcao `tool()`:

```typescript
import type { z } from "zod"

export interface ToolAnnotations {
  readOnly?: boolean
  destructive?: boolean
  idempotent?: boolean
  openWorld?: boolean
}

export interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >
  isError?: boolean
}

export interface SdkMcpToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

**2. Implementar `tool()`** — thin wrapper que garante type-safety via generics Zod:

```typescript
export function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<z.ZodObject<Schema>>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema> {
  return {
    name,
    description,
    inputSchema,
    handler,
    annotations: extras?.annotations,
  }
}
```

O `Schema` propaga do `inputSchema` Zod para o tipo de `args` no handler — type-safety end-to-end.

### Feature F-051 — `createSdkMcpServer()` e `McpSdkServerConfig`

**1. Adicionar `McpSdkServerConfig`** a union `McpServerConfig` em `src/types/options.ts`:

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  instance: unknown  // McpServer de @modelcontextprotocol/sdk — tipo opaco para evitar dep direta
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfig
```

**2. Implementar `createSdkMcpServer()`** em `src/mcp.ts`:

```typescript
export function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): McpSdkServerConfig {
  // Import dinamico para nao forcar dep em quem nao usa MCP
  const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
  const { z } = require("zod")

  const server = new McpServer({
    name: options.name,
    version: options.version ?? "1.0.0",
  })

  if (options.tools) {
    for (const toolDef of options.tools) {
      const zodShape = z.object(toolDef.inputSchema)
      server.tool(
        toolDef.name,
        toolDef.description,
        { inputSchema: zodShape },
        async (args: unknown, extra: unknown) => {
          return toolDef.handler(args as any, extra)
        },
      )
    }
  }

  return {
    type: "sdk" as const,
    instance: server,
  }
}
```

**Nota sobre imports**: `@modelcontextprotocol/sdk` e `zod` sao `require()` dinamico para que consumidores que nao usam MCP programatico nao precisem instalar essas dependencias.

**3. Adicionar guard em `buildCliArgs()`** (`src/process.ts`) — erro explicito se `type: "sdk"` for encontrado:

```typescript
// Dentro do loop de mcpServers em buildCliArgs()
if (config.type === "sdk") {
  throw new Error(
    `MCP server "${name}" has type "sdk" which requires in-process transport (not yet supported). ` +
    `Use stdio, sse, or http transport instead.`
  )
}
```

### Feature F-052 — Exports e peerDependencies

**1. Exportar em `src/index.ts`:**

```typescript
// MCP Tool Factories
export { tool, createSdkMcpServer } from "./mcp.js"
export type {
  ToolAnnotations,
  CallToolResult,
  SdkMcpToolDefinition,
} from "./mcp.js"
```

E adicionar `McpSdkServerConfig` as exportacoes de tipos de Options:

```typescript
export type {
  // ... existentes ...
  McpSdkServerConfig,
} from "./types/options.js"
```

**2. Adicionar peerDependencies ao `package.json`:**

```json
{
  "peerDependencies": {
    "zod": ">=3.0.0",
    "@modelcontextprotocol/sdk": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "zod": { "optional": true },
    "@modelcontextprotocol/sdk": { "optional": true }
  }
}
```

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-050 | toolFactory | Criar `src/mcp.ts` com `tool()`, tipos `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition` |
| F-051 | createSdkMcpServer | Implementar `createSdkMcpServer()`, adicionar `McpSdkServerConfig` a union, guard em `buildCliArgs()` |
| F-052 | mcpExportsAndDeps | Exportar funcoes e tipos em `index.ts`, adicionar peerDependencies opcionais ao `package.json` |

## Limites

- NAO implementar transport stdio in-process (Fase 2 futura)
- NAO tornar `zod` ou `@modelcontextprotocol/sdk` dependencias obrigatorias — sao peerDependencies opcionais
- NAO alterar o comportamento existente de `mcpServers` tipo `stdio`, `sse` ou `http`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs.
