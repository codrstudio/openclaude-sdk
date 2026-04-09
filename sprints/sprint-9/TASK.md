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

---

# Projeto

# openclaude-sdk

Um SDK em TypeScript que permite usar o OpenClaude (fork open-source do Claude Code) de forma programática, dentro de aplicações Node.js.

## Problema que resolve

O OpenClaude CLI é uma ferramenta interativa de terminal — você digita prompts e o agente responde. Mas para quem quer **integrar um agente de código em seus próprios sistemas** (automações, pipelines, produtos), usar o terminal não serve. É preciso uma interface programática.

O openclaude-sdk faz essa ponte: transforma o CLI num componente controlável por código.

## O que permite fazer

- **Conversar com o agente** — enviar prompts e receber respostas em streaming, como um chat programático
- **Controlar permissões** — aprovar ou negar ações do agente (leitura de arquivos, execução de comandos) sem intervenção humana
- **Gerenciar sessões** — retomar conversas anteriores, listar histórico, organizar sessões com títulos e tags
- **Usar múltiplos providers** — rotear requests para OpenRouter ou qualquer API compatível com OpenAI, não ficando preso a um único provedor
- **Tratar erros de forma inteligente** — distinguir erros recuperáveis (rate limit, timeout) de fatais (autenticação, billing), permitindo lógica de retry automático

## Para quem é

Desenvolvedores que querem construir produtos ou automações em cima de agentes de código — orquestradores, plataformas de desenvolvimento assistido por IA, ferramentas internas, CI/CD com agentes.

## Relação com o ecossistema

É o equivalente open-source do `@anthropic-ai/claude-code` SDK oficial da Anthropic, mas voltado para o OpenClaude. Mesma ideia, mesmo estilo de API, ecossistema diferente.