# openclaude-sdk - Compatibilidade de tool() com ZodDiscriminatedUnion

Ajustar a assinatura de `tool()` e `SdkMcpToolDefinition` para aceitar `z.ZodTypeAny` alem de `z.ZodRawShape`, permitindo meta-tools com `z.discriminatedUnion()`.

---

## Objetivo

Resolver D-081 (score 9): a factory `tool()` em `src/mcp.ts` usa `Schema extends z.ZodRawShape`, mas as 4 meta-tools de display usam `z.discriminatedUnion("action", [...])` — que e um `ZodDiscriminatedUnion`, nao um `ZodRawShape`. Sem essa correcao, as meta-tools nao compilam.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `tool()` exige `ZodRawShape` como generic | `z.discriminatedUnion()` nao e `ZodRawShape` — erro de tipo |
| 2 | `SdkMcpToolDefinition.handler` infere `z.infer<z.ZodObject<Schema>>` | Inferencia falha para schemas que nao sao `ZodObject` |
| 3 | `createSdkMcpServer()` passa `toolDef.inputSchema` para `server.tool()` | MCP SDK `server.tool()` aceita `ZodRawShape` — discriminated union requer tratamento |

---

## Estado Atual

**Arquivo**: `src/mcp.ts`, linhas 20-26

```typescript
export interface SdkMcpToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

**Arquivo**: `src/mcp.ts`, linhas 111-128

```typescript
export function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>
```

**Arquivo**: `src/mcp.ts`, linhas 43-54

```typescript
if (options.tools) {
  for (const toolDef of options.tools) {
    server.tool(
      toolDef.name,
      toolDef.description,
      toolDef.inputSchema,     // <-- server.tool() espera ZodRawShape
      async (args: unknown, extra: unknown) => {
        return toolDef.handler(args as any, extra) as any
      },
    )
  }
}
```

---

## Implementacao

### 1. Adicionar overload de `tool()` para `ZodTypeAny`

**Arquivo**: `src/mcp.ts`

Adicionar uma segunda overload que aceita `z.ZodTypeAny` como inputSchema. A overload original (com `ZodRawShape`) permanece para manter compatibilidade com tools simples baseadas em `z.object()`.

```typescript
// Overload 1: ZodRawShape (tools com z.object shape — caso original)
export function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>

// Overload 2: ZodTypeAny (tools com discriminatedUnion ou outro Zod type)
export function tool<Schema extends z.ZodTypeAny>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<any>

// Implementacao
export function tool(
  name: string,
  description: string,
  inputSchema: unknown,
  handler: (args: unknown, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<any> {
  return { name, description, inputSchema: inputSchema as any, handler: handler as any, annotations: extras?.annotations }
}
```

### 2. Ajustar `createSdkMcpServer()` para lidar com schemas nao-ZodRawShape

**Arquivo**: `src/mcp.ts`, dentro do loop de registro de tools (linhas 43-54)

O `server.tool()` do MCP SDK aceita `ZodRawShape`. Para schemas que nao sao `ZodRawShape` (como `ZodDiscriminatedUnion`), usar a overload de `server.tool()` que aceita `{ inputSchema: ZodTypeAny }` — verificar API real do MCP SDK. Se necessario, passar o JSON Schema gerado por `zodToJsonSchema()` ou registrar via `server.setRequestHandler()` diretamente.

**Abordagem recomendada**: verificar se `inputSchema` e `ZodRawShape` (objeto plano com chaves string) ou `ZodTypeAny` (tem `._def`). Se for `ZodTypeAny`, converter para JSON Schema e usar a API low-level do MCP server.

```typescript
for (const toolDef of options.tools) {
  const schema = toolDef.inputSchema
  const isRawShape = typeof schema === "object" && !("_def" in schema)

  if (isRawShape) {
    server.tool(toolDef.name, toolDef.description, schema, async (args, extra) => {
      return toolDef.handler(args as any, extra) as any
    })
  } else {
    // ZodTypeAny: usar jsonSchema do zod para registrar como JSON Schema puro
    const jsonSchema = (schema as z.ZodTypeAny).toJsonSchema()
    server.tool(toolDef.name, toolDef.description, { inputSchema: jsonSchema }, async (args, extra) => {
      return toolDef.handler(args as any, extra) as any
    })
  }
}
```

**Nota**: a abordagem exata depende da API do `@modelcontextprotocol/sdk` v1. O coder deve verificar qual overload de `McpServer.tool()` aceita JSON Schema puro vs ZodRawShape e adaptar conforme a API real.

### 3. Atualizar tipo `SdkMcpToolDefinition`

Manter a interface original para retrocompatibilidade, mas aceitar `any` no array de tools de `createSdkMcpServer()` (ja faz isso via `SdkMcpToolDefinition<any>`).

---

## Criterios de Aceite

- [ ] `tool()` com `z.object({ ... }).shape` continua funcionando (retrocompatibilidade)
- [ ] `tool()` com `z.discriminatedUnion("action", [...])` compila sem erros de tipo
- [ ] `createSdkMcpServer()` registra tools com ambos os tipos de schema
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `tool()` overloads | S-063 |
| `SdkMcpToolDefinition` | S-063 |
| `createSdkMcpServer()` | S-063 |
| `src/mcp.ts` | S-063 |
| Discovery | D-081 |
