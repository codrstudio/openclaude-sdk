# PRP-030 — MCP SDK Server Bugfixes

## Objetivo

Corrigir 3 bugs que tornam `createSdkMcpServer()` inutilizavel: campo `name` ausente na interface (D-054), `require()` em modulo ESM (D-052), e assinatura incorreta de `server.tool()` (D-053).

Referencia: specs S-038, S-039, S-040.

## Execution Mode

`implementar`

## Contexto

`createSdkMcpServer()` e `tool()` foram implementadas no sprint-7 (F-039/F-040) mas contem 3 bugs que impedem uso em runtime:

1. A interface `McpSdkServerConfig` em `src/types/options.ts` nao tem campo `name`, necessario para lifecycle management (D-055) e transporte local (D-051)
2. `createSdkMcpServer()` usa `require()` para importar `@modelcontextprotocol/sdk` e `zod`, mas o pacote e ESM (`"type": "module"`) — `require()` lanca `ReferenceError` em runtime
3. `server.tool()` recebe `{ inputSchema: zodShape }` como terceiro argumento, mas a API do `McpServer` espera o `ZodRawShape` diretamente

Estes 3 bugs sao pre-requisitos para o transporte local (S-041) e lifecycle management (S-042).

## Especificacao

### Feature F-067 — Adicionar campo `name` a `McpSdkServerConfig`

**1. Atualizar interface em `src/types/options.ts`:**

Estado atual (linhas 29-32):
```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  instance: unknown
}
```

Novo:
```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  name: string
  instance: unknown
}
```

**2. Atualizar retorno de `createSdkMcpServer()` em `src/mcp.ts`:**

Estado atual (linhas 60-63):
```typescript
return {
  type: "sdk" as const,
  instance: server,
}
```

Novo:
```typescript
return {
  type: "sdk" as const,
  name: options.name,
  instance: server,
}
```

Nenhuma mudanca em `buildCliArgs()` — o campo `name` sera consumido por S-041.

### Feature F-068 — Fix `require()` em ESM

**1. Tornar `createSdkMcpServer()` async:**

Assinatura atual:
```typescript
export function createSdkMcpServer(options: { ... }): McpSdkServerConfig
```

Nova assinatura:
```typescript
export async function createSdkMcpServer(options: { ... }): Promise<McpSdkServerConfig>
```

**2. Substituir `require()` por `await import()`:**

Estado atual (linhas 36-38):
```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
const { z } = require("zod")
```

Novo:
```typescript
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")
```

**3. Remover linhas `eslint-disable` de require.**

**4. Impacto em consumidores:** `createSdkMcpServer()` passa a retornar `Promise`. Consumidores devem usar `await`:

```typescript
const server = await createSdkMcpServer({ name: "my-tools", tools: [...] })
```

### Feature F-069 — Fix assinatura `server.tool()`

**1. Corrigir chamada em `src/mcp.ts`:**

Estado atual (linhas 46-56):
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

Novo:
```typescript
if (options.tools) {
  for (const toolDef of options.tools) {
    server.tool(
      toolDef.name,
      toolDef.description,
      toolDef.inputSchema,
      async (args: Record<string, unknown>, extra: unknown) => {
        return toolDef.handler(args as any, extra)
      },
    )
  }
}
```

Mudancas:
- Remover `z.object()` wrapping — `McpServer.tool()` faz o wrapping internamente
- Passar `toolDef.inputSchema` (ZodRawShape) diretamente como terceiro argumento
- Remover import de `zod` se nao houver outro uso apos F-068

**2. Verificar se `zod` ainda e necessario em `createSdkMcpServer()`:**
- F-068 remove o `require("zod")` 
- F-069 remove o `z.object()` 
- Se nao houver outro uso de `zod` dentro de `createSdkMcpServer()`, nao importar

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `createSdkMcpServer({ name: "x", tools: [...] })` | `ReferenceError: require is not defined` | Retorna `McpSdkServerConfig` com `name: "x"` |
| Acesso a `config.name` | `undefined` (campo inexistente) | `"x"` (string) |
| Tool registrada no McpServer | Schema invalido (`{ inputSchema: ZodObject }`) | Schema correto (ZodRawShape parsed pelo McpServer) |
| CLI invoca tool via MCP | Falha — schema nao corresponde | Sucesso — args parseados corretamente |
| `typeof createSdkMcpServer(...)` | `McpSdkServerConfig` (sync) | `Promise<McpSdkServerConfig>` (async) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-067 | mcpSdkServerName | Adicionar `name: string` a `McpSdkServerConfig` e ao retorno de `createSdkMcpServer()` |
| F-068 | fixRequireEsm | Tornar `createSdkMcpServer()` async, substituir `require()` por `await import()` |
| F-069 | fixServerToolSignature | Passar `ZodRawShape` diretamente para `server.tool()`, remover `z.object()` wrapping |

## Limites

- NAO alterar `tool()` factory — apenas `createSdkMcpServer()` e `McpSdkServerConfig`
- NAO alterar `buildCliArgs()` — o tratamento de `type: "sdk"` sera feito em PRP-031
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar exports em `src/index.ts` — tipos ja estao exportados

## Dependencias

Nenhuma dependencia de outros PRPs. PRP-031 depende deste PRP.
