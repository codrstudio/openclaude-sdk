# MCP Tool Factories — tool() e createSdkMcpServer()

Implementar as funcoes de criacao de MCP tools e servers in-process.

---

## Contexto

O Claude Code SDK expoe `tool()` e `createSdkMcpServer()` para definir MCP tools programaticamente com type-safety via Zod. O OpenClaude SDK hoje so suporta MCP servers via configuracao estatica (`mcpServers` em Options). Falta a capacidade de criar tools e servers inline no codigo.

---

## Funcoes a implementar

### 1. `tool()`

Cria uma definicao de MCP tool com schema Zod e handler.

```typescript
import { z } from "zod"

function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<z.ZodObject<Schema>>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>
```

### 2. `createSdkMcpServer()`

Cria um MCP server in-process que pode ser passado em `mcpServers`.

```typescript
function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): McpSdkServerConfigWithInstance
```

Retorna um objeto compativel com `McpServerConfig` type `"sdk"`:

```typescript
interface McpSdkServerConfigWithInstance {
  type: "sdk"
  name: string
  instance: McpServer  // @modelcontextprotocol/sdk
}
```

---

## Tipos novos

```typescript
interface ToolAnnotations {
  readOnly?: boolean
  destructive?: boolean
  idempotent?: boolean
  openWorld?: boolean
}

interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >
  isError?: boolean
}

interface SdkMcpToolDefinition<Schema extends z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

---

## Dependencias

| Pacote | Tipo | Justificativa |
|--------|------|---------------|
| `zod` | peerDependency | Schema definition (usuario ja deve ter) |
| `@modelcontextprotocol/sdk` | peerDependency | MCP server runtime |

Ambas como `peerDependencies` para nao forccar versao no consumidor.

---

## Exemplo de uso

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

## Prioridade

**Media** — Essencial para quem quer definir tools programaticamente, mas a maioria dos usuarios iniciais vai usar MCP servers externos via stdio/sse/http.

---

## Criterios de aceite

- [ ] `tool()` exportado e funcional com Zod schemas
- [ ] `createSdkMcpServer()` exportado, retorna config compativel com `mcpServers`
- [ ] Tipos `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition` exportados
- [ ] `zod` e `@modelcontextprotocol/sdk` como peerDependencies
- [ ] Typecheck passa
- [ ] Build passa

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Gap analysis | `.tmp/REPORT-1.md` |
| Claude Code SDK docs | `platform.claude.com/docs/en/agent-sdk/typescript-v2-preview` |
