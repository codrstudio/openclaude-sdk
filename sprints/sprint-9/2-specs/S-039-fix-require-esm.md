# openclaude-sdk - Fix require() em Modulo ESM

Substituir `require()` por `await import()` em `createSdkMcpServer()` para compatibilidade com ESM.

---

## Objetivo

Resolver D-052 (score 9): o pacote tem `"type": "module"` em `package.json`, tornando-o ESM. As chamadas `require()` nas linhas 36-38 de `src/mcp.ts` lancam `ReferenceError: require is not defined in ES module scope` em runtime.

| # | Problema | Impacto |
|---|----------|---------|
| 1 | `require("@modelcontextprotocol/sdk/server/mcp.js")` em ESM | `createSdkMcpServer()` falha imediatamente em runtime |
| 2 | `require("zod")` em ESM | Idem — qualquer chamada a `createSdkMcpServer()` crasheia |

---

## Estado Atual

**Arquivo**: `src/mcp.ts`, linhas 34-38

```typescript
export function createSdkMcpServer(options: {
  // ...
}): McpSdkServerConfig {
  const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
  const { z } = require("zod")
```

A funcao e sincrona. O `require()` e usado para import dinamico (evitar dep obrigatoria). Em ESM, o equivalente e `await import()`, que requer que a funcao seja `async`.

---

## Implementacao

### 1. Tornar `createSdkMcpServer()` async

**Arquivo**: `src/mcp.ts`

**Antes:**

```typescript
export function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): McpSdkServerConfig {
  const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
  const { z } = require("zod")
```

**Depois:**

```typescript
export async function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): Promise<McpSdkServerConfig> {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")
  const { z } = await import("zod")
```

### 2. Atualizar tipo de retorno

O retorno muda de `McpSdkServerConfig` para `Promise<McpSdkServerConfig>`. Consumidores precisarao usar `await`:

```typescript
// Antes
const server = createSdkMcpServer({ name: "my-tools", tools: [weatherTool] })

// Depois
const server = await createSdkMcpServer({ name: "my-tools", tools: [weatherTool] })
```

### 3. Remover eslint-disable de require

As linhas `// eslint-disable-next-line @typescript-eslint/no-require-imports` nao sao mais necessarias e devem ser removidas.

### 4. Impacto em consumidores

O `query()` em `src/query.ts` recebe `mcpServers` ja resolvidos (o `await` acontece no caller antes de passar para `query()`). Nao ha impacto em `query()` nem em `buildCliArgs()` — eles recebem o objeto `McpSdkServerConfig` ja resolvido.

---

## Arquivos Afetados

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/mcp.ts` | 28-63 | Tornar `createSdkMcpServer` async, `require()` → `await import()`, remover eslint-disable |

---

## Criterios de Aceite

- [ ] `createSdkMcpServer()` e `async` e retorna `Promise<McpSdkServerConfig>`
- [ ] `require()` substituido por `await import()` para ambos os pacotes
- [ ] Linhas `eslint-disable @typescript-eslint/no-require-imports` removidas
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `createSdkMcpServer()` async | S-039 |
| `await import()` | S-039 |
| Discovery | D-052 |
| Pre-requisito | S-038 (name field) |
