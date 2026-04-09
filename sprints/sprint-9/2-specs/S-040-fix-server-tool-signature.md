# openclaude-sdk - Fix Assinatura server.tool() no McpServer

Corrigir a chamada `server.tool()` em `createSdkMcpServer()` para usar a assinatura correta do `@modelcontextprotocol/sdk`.

---

## Objetivo

Resolver D-053 (score 8): a chamada `server.tool()` em `src/mcp.ts:48-54` passa o schema como `{ inputSchema: zodShape }` (objeto wrapper), mas a API do `McpServer` do `@modelcontextprotocol/sdk` v1.x espera o `ZodRawShape` diretamente como terceiro argumento.

| # | Problema | Consequencia |
|---|----------|-------------|
| 1 | Terceiro argumento e `{ inputSchema: zodShape }` em vez de `zodShape` | Schema invalido — tools expostas sem tipagem correta |
| 2 | Handler recebe `args` com estrutura errada | Invocacao de tools pelo cliente MCP falha ou produz dados incorretos |

---

## Estado Atual

**Arquivo**: `src/mcp.ts`, linhas 46-56

```typescript
if (options.tools) {
  for (const toolDef of options.tools) {
    const zodShape = z.object(toolDef.inputSchema)
    server.tool(
      toolDef.name,
      toolDef.description,
      { inputSchema: zodShape },    // ❌ wrapping incorreto
      async (args: unknown, extra: unknown) => {
        return toolDef.handler(args as any, extra)
      },
    )
  }
}
```

### API correta do McpServer.tool()

A assinatura do `McpServer.tool()` do `@modelcontextprotocol/sdk` v1.x:

```typescript
server.tool(
  name: string,
  description: string,
  inputSchema: ZodRawShape,       // ✅ ZodRawShape direto, NAO z.ZodObject
  handler: (args, extra) => Promise<CallToolResult>,
)
```

O terceiro argumento deve ser o `ZodRawShape` (o objeto com chaves Zod), nao um `z.ZodObject` nem um wrapper `{ inputSchema }`.

---

## Implementacao

### 1. Passar `toolDef.inputSchema` diretamente

**Arquivo**: `src/mcp.ts`

**Antes:**

```typescript
const zodShape = z.object(toolDef.inputSchema)
server.tool(
  toolDef.name,
  toolDef.description,
  { inputSchema: zodShape },
  async (args: unknown, extra: unknown) => {
    return toolDef.handler(args as any, extra)
  },
)
```

**Depois:**

```typescript
server.tool(
  toolDef.name,
  toolDef.description,
  toolDef.inputSchema,
  async (args: unknown, extra: unknown) => {
    return toolDef.handler(args as any, extra)
  },
)
```

### 2. Remover import de `z` desnecessario

Com esta mudanca, o `z.object()` nao e mais usado dentro do loop. Se `z` nao for usado em nenhum outro lugar da funcao, o `await import("zod")` pode ser removido inteiramente.

**Verificacao**: apos S-039 (require → await import), a unica referencia a `z` era para `z.object(toolDef.inputSchema)`. Removendo essa linha, o import de `zod` na funcao nao e mais necessario.

---

## Arquivos Afetados

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/mcp.ts` | 47-55 | Substituir `{ inputSchema: zodShape }` por `toolDef.inputSchema`; remover `z.object()` e import de `zod` |

---

## Criterios de Aceite

- [ ] `server.tool()` recebe `toolDef.inputSchema` (ZodRawShape) como terceiro argumento
- [ ] `z.object()` removido do loop de registro de tools
- [ ] Import de `zod` removido se nao houver outro uso
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `server.tool()` assinatura | S-040 |
| Remocao de `z.object()` wrapper | S-040 |
| Discovery | D-053 |
| Pre-requisito | S-039 (async + await import) |
