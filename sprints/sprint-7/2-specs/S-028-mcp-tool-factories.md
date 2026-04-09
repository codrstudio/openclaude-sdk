# openclaude-sdk - MCP Tool Factories: tool() e createSdkMcpServer()

Implementar `tool()` para definicao de MCP tools inline com Zod e `createSdkMcpServer()` para server in-process.

---

## Objetivo

Resolver D-039 (score 6) e D-040 (score 6): nao ha forma de definir MCP tools programaticamente nem criar MCP servers in-process. Usuarios que querem tools inline precisam criar um MCP server externo separado.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `tool()` nao existe | Sem forma type-safe de definir tools com Zod schema e handler |
| 2 | `createSdkMcpServer()` nao existe | Sem forma de criar server in-process compativel com `mcpServers` Options |

Referencia: `backlog/06-mcp-tool-factories/TASK.md`.

---

## Estado Atual

**Arquivo alvo**: `src/mcp.ts` (novo)

Nao existe nenhuma funcionalidade MCP programatica. `mcpServers` em Options suporta apenas `stdio`, `sse` e `http` — todos requerem server externo.

---

## Implementacao

### 1. Novo arquivo `src/mcp.ts`

Contera `tool()`, `createSdkMcpServer()` e os tipos associados.

### 2. Tipos novos

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

### 3. Funcao `tool()`

Cria uma definicao de MCP tool com schema Zod e handler async.

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

A funcao e um thin wrapper que garante type-safety via generics — o `Schema` propaga do `inputSchema` Zod para o tipo de `args` no handler.

### 4. Tipo `McpSdkServerConfig`

Adicionar ao `src/types/options.ts` um novo membro na union `McpServerConfig`:

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

### 5. Funcao `createSdkMcpServer()`

Cria um `McpServer` do `@modelcontextprotocol/sdk`, registra as tools e retorna config compativel com `mcpServers`.

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

**Nota sobre imports**: `@modelcontextprotocol/sdk` e `zod` sao `require()` dinamico para que consumidores que nao usam MCP programatico nao precisem instalar essas dependencias. Se nao estiverem instaladas, o erro e claro e acontece no momento do uso.

### 6. Propagacao em `buildCliArgs()`

O `type: "sdk"` precisa de tratamento especial em `src/process.ts`. MCP servers `sdk` nao geram flags `--mcp-config` — eles sao gerenciados in-process. A passagem do server instance para o subprocess requer que `spawnAndStream()` configure o transport (stdio pair) entre o child process e o `McpServer`.

**Abordagem**: Quando `mcpServers` contem entries `type: "sdk"`, `spawnAndStream()` deve:
1. Criar um `StdioServerTransport` para cada server `sdk`
2. Conectar o `McpServer` ao transport
3. Passar o pipe como `--mcp-config` com tipo `stdio` apontando para o file descriptor

Isso e complexo e pode ser implementado em duas fases:
- **Fase 1 (esta spec)**: `tool()` e `createSdkMcpServer()` criam os objetos e tipos. A integracao com `buildCliArgs()` lanca erro explicito se `type: "sdk"` for passado sem transport configurado.
- **Fase 2 (futura)**: Integracao completa do transport stdio in-process.

### 7. Exportacoes em `src/index.ts`

Adicionar ao `src/index.ts`:

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

---

## Dependencias

| Pacote | Tipo | Justificativa |
|--------|------|---------------|
| `zod` | peerDependency (opcional) | Schema definition — so necessario se usar `tool()` |
| `@modelcontextprotocol/sdk` | peerDependency (opcional) | MCP server runtime — so necessario se usar `createSdkMcpServer()` |

Adicionar ao `package.json`:

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

---

## Exemplo de Uso

```typescript
import { tool, createSdkMcpServer, query } from "openclaude-sdk"
import { z } from "zod"

const weatherTool = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text", text: `Weather in ${city}: 22C, sunny` }],
  }),
)

const server = createSdkMcpServer({
  name: "my-tools",
  tools: [weatherTool],
})

const q = query({
  prompt: "What's the weather in London?",
  options: {
    mcpServers: { "my-tools": server },
  },
})
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/mcp.ts` | Novo — `tool()`, `createSdkMcpServer()`, tipos |
| `src/types/options.ts` | Adicionar `McpSdkServerConfig` a union `McpServerConfig` |
| `src/index.ts` | Exportar `tool`, `createSdkMcpServer`, `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`, `McpSdkServerConfig` |
| `package.json` | Adicionar `peerDependencies` e `peerDependenciesMeta` |

---

## Criterios de Aceite

- [ ] `tool()` exportado e retorna `SdkMcpToolDefinition` com type-safety via generics Zod
- [ ] `createSdkMcpServer()` exportado e retorna `McpSdkServerConfig` com `type: "sdk"`
- [ ] Tipos `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition` exportados
- [ ] `McpSdkServerConfig` adicionado a union `McpServerConfig`
- [ ] `zod` e `@modelcontextprotocol/sdk` como peerDependencies opcionais
- [ ] Import dinamico (`require`) para evitar dep obrigatoria
- [ ] Erro explicito se `type: "sdk"` for passado a `buildCliArgs()` sem transport
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `tool()` factory | S-028 |
| `createSdkMcpServer()` | S-028 |
| `McpSdkServerConfig` tipo | S-028 |
| Tipos MCP (ToolAnnotations, CallToolResult, SdkMcpToolDefinition) | S-028 |
| Discovery | D-039, D-040 |
| Referencia | `backlog/06-mcp-tool-factories/TASK.md` |
