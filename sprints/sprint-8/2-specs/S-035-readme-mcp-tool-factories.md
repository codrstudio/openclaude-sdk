# openclaude-sdk - Documentacao de MCP Tool Factories no README

Adicionar secao ao README.md documentando `tool()` e `createSdkMcpServer()` com exemplo end-to-end.

---

## Objetivo

Resolver D-048 (score 6): `tool()` e `createSdkMcpServer()` foram implementados no sprint-7 (F-050/F-051/F-052) e exportados, mas nao ha secao de documentacao sobre eles no README. Usuarios que quiserem definir MCP tools inline nao tem orientacao.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `tool()` factory nao documentada | Criacao de MCP tools inline invisivel |
| 2 | `createSdkMcpServer()` nao documentada | Registro de tools em servidor in-process sem docs |
| 3 | Fluxo end-to-end ausente | Integracao `tool()` → `createSdkMcpServer()` → `query({ mcpServers })` sem exemplo |

---

## Estado Atual

**Arquivo**: `README.md`

Nao ha nenhuma secao sobre MCP tool factories. A unica referencia a MCP no README e o campo `mcpServers` na tabela de Options (secao "Advanced"), que documenta `McpServerConfig` para stdio/SSE/HTTP — mas nao menciona o tipo `"sdk"` para servidores in-process.

A implementacao em `src/mcp.ts` exporta:
- `tool<Schema>(name, description, inputSchema, handler, extras?): SdkMcpToolDefinition<Schema>`
- `createSdkMcpServer(options): McpSdkServerConfig`
- Tipos: `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`

---

## Implementacao

### 1. Nova secao "MCP Tool Factories" no README

Inserir **apos** a secao "Permission Mid-Stream" e **antes** de "Options" (ou apos a futura secao "V2 Session API"). A secao deve conter:

#### 1.1. Introducao

Uma frase explicando que MCP tool factories permitem definir tools inline em TypeScript e registra-las num servidor in-process, sem precisar de um servidor MCP externo.

Mencionar que `zod` e `@modelcontextprotocol/sdk` sao peer dependencies necessarias.

#### 1.2. `tool(name, description, inputSchema, handler, extras?)`

Assinatura:

```typescript
function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>
```

Descricao dos parametros como tabela:

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | `string` | Nome da tool (visivel ao agente) |
| `description` | `string` | Descricao da tool (usada pelo agente para decidir quando invocar) |
| `inputSchema` | `z.ZodRawShape` | Schema Zod dos parametros de entrada |
| `handler` | `(args, extra) => Promise<CallToolResult>` | Funcao async que executa a tool |
| `extras.annotations` | `ToolAnnotations` | Anotacoes opcionais: `readOnly`, `destructive`, `idempotent`, `openWorld` |

#### 1.3. `createSdkMcpServer(options)`

Assinatura:

```typescript
function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): McpSdkServerConfig
```

Explicar que retorna um `McpSdkServerConfig` com `type: "sdk"` que pode ser passado diretamente em `options.mcpServers`.

#### 1.4. Exemplo end-to-end

```typescript
import { z } from "zod"
import { tool, createSdkMcpServer, query, collectMessages } from "openclaude-sdk"

// 1. Definir tools
const weatherTool = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text", text: `Weather in ${city}: 22°C, sunny` }],
  }),
)

const timeTool = tool(
  "get_time",
  "Get current time in a timezone",
  { timezone: z.string().describe("IANA timezone") },
  async ({ timezone }) => ({
    content: [{ type: "text", text: `Current time in ${timezone}: ${new Date().toISOString()}` }],
  }),
  { annotations: { readOnly: true } },
)

// 2. Criar servidor in-process
const mcpServer = createSdkMcpServer({
  name: "my-tools",
  tools: [weatherTool, timeTool],
})

// 3. Usar com query
const q = query({
  prompt: "What's the weather in Tokyo?",
  options: {
    mcpServers: { "my-tools": mcpServer },
  },
})

const { result } = await collectMessages(q)
console.log(result)
```

#### 1.5. Tipos exportados

```typescript
import type {
  SdkMcpToolDefinition,
  ToolAnnotations,
  CallToolResult,
} from "openclaude-sdk"
```

#### 1.6. Tabela de `ToolAnnotations`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `readOnly` | `boolean` | Tool apenas le dados, nao modifica |
| `destructive` | `boolean` | Tool pode causar efeitos destrutivos |
| `idempotent` | `boolean` | Multiplas execucoes produzem mesmo resultado |
| `openWorld` | `boolean` | Tool acessa recursos externos (rede, filesystem) |

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `README.md` | Nova secao "MCP Tool Factories" com assinaturas, tabelas e exemplo end-to-end |

---

## Criterios de Aceite

- [ ] Secao "MCP Tool Factories" inserida no README
- [ ] `tool()` documentada com assinatura generica e tabela de parametros
- [ ] `createSdkMcpServer()` documentada com assinatura e explicacao de `McpSdkServerConfig`
- [ ] Exemplo end-to-end: `tool()` → `createSdkMcpServer()` → `query({ mcpServers })`
- [ ] Tabela de `ToolAnnotations`
- [ ] Tipos exportados listados (`SdkMcpToolDefinition`, `ToolAnnotations`, `CallToolResult`)
- [ ] Mencionadas peer dependencies (`zod`, `@modelcontextprotocol/sdk`)
- [ ] Exemplos de codigo compilaveis
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Secao MCP Tool Factories no README | S-035 |
| `tool()` docs | S-035 |
| `createSdkMcpServer()` docs | S-035 |
| Discovery | D-048 |
| Implementacao | `src/mcp.ts` |
