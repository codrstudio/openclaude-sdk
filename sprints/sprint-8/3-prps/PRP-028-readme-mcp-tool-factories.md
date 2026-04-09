# PRP-028 — README: MCP Tool Factories

## Objetivo

Adicionar secao ao README.md documentando `tool()` e `createSdkMcpServer()` com assinaturas, tabelas de parametros e exemplo end-to-end de MCP inline com Zod.

Referencia: spec S-035 (D-048).

## Execution Mode

`implementar`

## Contexto

Nao ha nenhuma secao sobre MCP tool factories no README. A unica referencia a MCP e o campo `mcpServers` na tabela de Options, que documenta `McpServerConfig` para stdio/SSE/HTTP — mas nao menciona o tipo `"sdk"` para servidores in-process.

As funcoes `tool()` e `createSdkMcpServer()` foram implementadas no sprint-7 (F-050/F-051/F-052) em `src/mcp.ts` e exportadas em `src/index.ts`. Permitem definir MCP tools inline em TypeScript e registra-las num servidor in-process, sem precisar de um servidor MCP externo.

## Especificacao

### Feature F-065 — Secao MCP Tool Factories no README

**1. Inserir nova secao "MCP Tool Factories"** no `README.md`, apos a secao "Permission Mid-Stream" e antes de "Options" (ou apos a futura secao "V2 Session API").

**2. Conteudo obrigatorio da secao:**

#### Introducao

Uma frase explicando que MCP tool factories permitem definir tools inline em TypeScript e registra-las num servidor in-process, sem precisar de um servidor MCP externo.

Mencionar que `zod` e `@modelcontextprotocol/sdk` sao peer dependencies necessarias.

#### `tool(name, description, inputSchema, handler, extras?)`

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

Tabela de parametros:

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | `string` | Nome da tool (visivel ao agente) |
| `description` | `string` | Descricao da tool (usada pelo agente para decidir quando invocar) |
| `inputSchema` | `z.ZodRawShape` | Schema Zod dos parametros de entrada |
| `handler` | `(args, extra) => Promise<CallToolResult>` | Funcao async que executa a tool |
| `extras.annotations` | `ToolAnnotations` | Anotacoes opcionais: `readOnly`, `destructive`, `idempotent`, `openWorld` |

#### `createSdkMcpServer(options)`

Assinatura:

```typescript
function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): McpSdkServerConfig
```

Explicar que retorna um `McpSdkServerConfig` com `type: "sdk"` que pode ser passado diretamente em `options.mcpServers`.

#### Exemplo end-to-end

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

#### Tabela de `ToolAnnotations`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `readOnly` | `boolean` | Tool apenas le dados, nao modifica |
| `destructive` | `boolean` | Tool pode causar efeitos destrutivos |
| `idempotent` | `boolean` | Multiplas execucoes produzem mesmo resultado |
| `openWorld` | `boolean` | Tool acessa recursos externos (rede, filesystem) |

#### Tipos exportados

```typescript
import type {
  SdkMcpToolDefinition,
  ToolAnnotations,
  CallToolResult,
} from "openclaude-sdk"
```

**3. Todos os exemplos de codigo devem ser compilaveis** (tipos corretos, imports presentes).

**4. Texto em portugues, codigo em ingles.**

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-065 | readmeMcpToolFactories | Secao "MCP Tool Factories" no README com `tool()`, `createSdkMcpServer()`, exemplo end-to-end, tabela `ToolAnnotations`, tipos exportados |

## Limites

- NAO alterar codigo em `src/` — este PRP e exclusivamente de documentacao
- NAO documentar o transport stdio in-process (nao implementado — Fase 2 futura)
- NAO adicionar exemplos que dependam de features nao implementadas
- NAO remover ou reorganizar secoes existentes do README (apenas inserir nova secao)

## Dependencias

Nenhuma dependencia de outros PRPs.
