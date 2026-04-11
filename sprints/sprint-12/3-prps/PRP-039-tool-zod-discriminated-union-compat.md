# PRP-039 — tool() ZodDiscriminatedUnion Compatibility

## Objetivo

Ajustar `tool()`, `SdkMcpToolDefinition` e `createSdkMcpServer()` para aceitar `z.ZodTypeAny` alem de `z.ZodRawShape`, desbloqueando meta-tools com `z.discriminatedUnion()`.

Referencia: spec S-063 (D-081).

## Execution Mode

`implementar`

## Contexto

A factory `tool()` em `src/mcp.ts` (linha 111) restringe o parametro generico a `Schema extends z.ZodRawShape`:

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
```

A interface `SdkMcpToolDefinition` (linha 20) tem a mesma restricao:

```typescript
export interface SdkMcpToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

O `createSdkMcpServer()` (linha 29) aceita `Array<SdkMcpToolDefinition<any>>` e passa `toolDef.inputSchema` diretamente para `server.tool()` do MCP SDK (linha 48).

As 4 display meta-tools do PRP-040 usam `z.discriminatedUnion("action", [...])` que retorna `ZodDiscriminatedUnion` — **nao** e `ZodRawShape`. Sem esta correcao, as meta-tools nao compilam.

O `server.tool()` do `@modelcontextprotocol/sdk` aceita tanto `ZodRawShape` (converte internamente para `z.object()`) quanto schemas Zod completos. O problema e apenas na tipagem do openclaude-sdk.

## Especificacao

### Feature F-092 — SdkMcpToolDefinition e tool() aceitam ZodTypeAny

**1. Adicionar tipo union em `src/mcp.ts` (antes da interface SdkMcpToolDefinition, apos as imports, linha 4):**

```typescript
type AnyToolSchema = z.ZodRawShape | z.ZodTypeAny
```

**2. Alterar interface SdkMcpToolDefinition (linhas 20-26):**

Estado atual:
```typescript
export interface SdkMcpToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

Novo:
```typescript
export interface SdkMcpToolDefinition<Schema extends AnyToolSchema = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (
    args: Schema extends z.ZodTypeAny ? z.infer<Schema> : Schema extends z.ZodRawShape ? z.infer<z.ZodObject<Schema>> : never,
    extra: unknown,
  ) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}
```

Mudancas:
- Constraint generica muda de `z.ZodRawShape` para `AnyToolSchema`
- Default continua `z.ZodRawShape` (backward compat)
- Tipo de `args` no handler usa conditional type: se `Schema` e `ZodTypeAny`, infere direto; se e `ZodRawShape`, wrappa em `ZodObject` como antes

**3. Adicionar overload para tool() (linhas 111-128):**

Estado atual:
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

Novo:
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
): SdkMcpToolDefinition<Schema>

export function tool<Schema extends z.ZodTypeAny>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<Schema>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>

export function tool(
  name: string,
  description: string,
  inputSchema: unknown,
  handler: (args: unknown, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<any> {
  return {
    name,
    description,
    inputSchema: inputSchema as any,
    handler: handler as any,
    annotations: extras?.annotations,
  }
}
```

Mudancas:
- Overload 1: `ZodRawShape` — backward compat, exatamente como hoje
- Overload 2: `ZodTypeAny` — aceita `z.discriminatedUnion()`, `z.union()`, etc.
- Implementation signature: `unknown` com cast interno — necessario para satisfazer ambos overloads

### Feature F-093 — createSdkMcpServer() aceita ambos formatos

**1. Alterar tipagem de tools em createSdkMcpServer() (linhas 33):**

Estado atual:
```typescript
  tools?: Array<SdkMcpToolDefinition<any>>
```

Nenhuma mudanca necessaria — `SdkMcpToolDefinition<any>` ja aceita qualquer schema porque o `any` bypassa a constraint. A passagem para `server.tool()` na linha 48 ja repassa `toolDef.inputSchema` diretamente:

```typescript
server.tool(
  toolDef.name,
  toolDef.description,
  toolDef.inputSchema,
  async (args: unknown, extra: unknown) => {
    return toolDef.handler(args as any, extra) as any
  },
)
```

O `server.tool()` do MCP SDK aceita tanto `ZodRawShape` quanto `ZodTypeAny` internamente. Nenhuma alteracao e necessaria nesta funcao.

**Verificacao**: confirmar que `server.tool()` de `@modelcontextprotocol/sdk` aceita `ZodDiscriminatedUnion` no terceiro parametro. Se nao aceitar, sera necessario converter via `.shape` ou wrapper — mas a documentacao do MCP SDK indica que aceita `ZodTypeAny`.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `tool("x", "d", { name: z.string() }, handler)` | Funciona | Funciona (identico) |
| `tool("x", "d", z.object({ name: z.string() }), handler)` | Erro de tipo | Funciona via overload ZodTypeAny |
| `tool("x", "d", z.discriminatedUnion("a", [...]), handler)` | Erro de tipo | Funciona via overload ZodTypeAny |
| `createSdkMcpServer({ tools: [toolWithDiscUnion] })` | Funciona (any) | Funciona (identico) |
| `SdkMcpToolDefinition<z.ZodRawShape>` | Funciona | Funciona (identico) |
| `SdkMcpToolDefinition<z.ZodDiscriminatedUnion<...>>` | Erro de tipo | Funciona |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-092 | toolAcceptZodTypeAny | `SdkMcpToolDefinition` e `tool()` aceitam `ZodTypeAny` via overload, mantendo backward compat com `ZodRawShape` |
| F-093 | createSdkMcpServerCompat | Verificar e confirmar que `createSdkMcpServer()` repassa schemas para `server.tool()` sem restricao de tipo |

## Limites

- NAO alterar `startSdkServerTransport()` — nao e afetado pela tipagem de schemas
- NAO alterar nenhum outro arquivo alem de `src/mcp.ts`
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar a assinatura runtime — apenas tipagem TypeScript muda
- NAO remover os `eslint-disable` comments existentes

## Dependencias

Nenhuma dependencia de outros PRPs. **Bloqueante para PRP-040** (display meta-tools usam discriminated union).
