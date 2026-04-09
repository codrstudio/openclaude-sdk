# Brainstorming — openclaude-sdk (Sprint 9)

## Contexto

O TASK.md do sprint-9 define o objetivo como **MCP Tool Factories**: implementar `tool()` e
`createSdkMcpServer()` para criar MCP tools e servers in-process com type-safety via Zod.

As funções `tool()` e `createSdkMcpServer()` foram implementadas em sprints anteriores (D-039 e
D-040, sprint-7), e os tipos `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition` estão
exportados em `src/mcp.ts` e `src/index.ts`. As `peerDependencies` (`zod`, `@modelcontextprotocol/sdk`)
estão configuradas em `package.json`.

Porém, uma **análise de gap** entre o TASK.md e o estado atual do código revela quatro problemas
críticos que tornam a feature não funcional em produção.

---

## Funcionalidades mapeadas (estado atual)

### `src/mcp.ts`

- `tool<Schema>(name, description, inputSchema, handler, extras?)` — factory que retorna
  `SdkMcpToolDefinition<Schema>`. Implementação trivial, correcta.
- `createSdkMcpServer(options)` — cria `McpServer` (via `require()`) e registra tools via
  `server.tool()`. Retorna `McpSdkServerConfig` com `type: "sdk"` e `instance: server`.
- Tipos exportados: `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`.

### `src/process.ts` — `buildCliArgs()`

- Linha 147-150: **`type === "sdk"` lança `throw new Error()`** com a mensagem
  _"in-process transport (not yet supported)"_. O user passa `createSdkMcpServer()` para
  `mcpServers`, `buildCliArgs()` joga um erro, e a query não executa.

### `src/types/options.ts` — `McpSdkServerConfig`

- Interface atual: `{ type: "sdk"; instance: unknown }`.
- TASK.md especifica `McpSdkServerConfigWithInstance` com campo `name: string` adicional.

### `package.json`

- `peerDependencies` correto: `zod >=3.0.0` e `@modelcontextprotocol/sdk >=1.0.0`, ambos opcionais.
- Pacote é ESM (`"type": "module"`).

---

## Lacunas e oportunidades

### Gap 51 — `buildCliArgs()` throw impede uso de SDK servers (BUG CRÍTICO)

**Arquivo**: `src/process.ts:147`

O bloco `if (config.type === "sdk") { throw new Error(...) }` torna `createSdkMcpServer()`
completamente inutilizável — qualquer query com um SDK server falha antes mesmo de spawnar o
processo. A integração precisa de um mecanismo de transporte para conectar o McpServer in-process
ao Claude Code CLI (subprocess). A estratégia viável: iniciar o McpServer com
`StreamableHTTPServerTransport` ou `SSEServerTransport` em uma porta aleatória local, e passar
`--mcp-server-sse <name>:http://localhost:<port>` para o CLI.

### Gap 52 — `require()` em módulo ESM (BUG CRÍTICO)

**Arquivo**: `src/mcp.ts:35-36`

```typescript
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
const { z } = require("zod")
```

O package é ESM (`"type": "module"` em `package.json`). `require()` não está disponível em ESM
e lançará `ReferenceError: require is not defined in ES module scope` em runtime. Deve ser
substituído por `await import()` (tornando a função async) ou reorganizar para import estático
condicional no topo do módulo.

### Gap 53 — API `server.tool()` com assinatura incorreta (BUG)

**Arquivo**: `src/mcp.ts:47`

```typescript
server.tool(
  toolDef.name,
  toolDef.description,
  { inputSchema: zodShape },  // <- wrapping incorreto
  async (args, extra) => { ... }
)
```

A API do `McpServer` do `@modelcontextprotocol/sdk` v1.x espera o schema como terceiro
argumento diretamente como `ZodRawShape` (o que TASK.md descreve como `inputSchema`), não como
objeto wrapper `{ inputSchema: ... }`. O wrapping incorreto faz o servidor rejeitar o schema
ou expor tools mal-tipadas.

### Gap 54 — `McpSdkServerConfig` faltando campo `name`

**Arquivo**: `src/types/options.ts`

O TASK.md especifica o tipo de retorno de `createSdkMcpServer()` como
`McpSdkServerConfigWithInstance` com campo `name: string`. A interface atual
`McpSdkServerConfig` não inclui `name`. O campo é necessário para o transporte local conseguir
associar erros ao nome correto do servidor e para o lifecycle manager saber qual server está rodando.

### Gap 55 — Lifecycle management dos SDK servers em `query.ts` (FEATURE)

**Arquivo**: `src/query.ts`

Se o Gap 51 for resolvido via transporte HTTP/SSE local, é necessário iniciar o servidor antes
de spawnar o CLI e encerrá-lo após o processo terminar. Atualmente `query.ts` não tem nenhuma
lógica de lifecycle para servidores SDK. Falta: (1) start server antes do spawn, (2) passar porta
ao `buildCliArgs()`, (3) stop server no cleanup.

### Gap 46 (sprint-8, não implementado) — README: V2 Session API

As funções `createSession()`, `resumeSession()` e `prompt()` não aparecem no README.

### Gap 47 (sprint-8, não implementado) — README: Query control methods

`setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` não documentados no README.

### Gap 48 (sprint-8, não implementado) — README: MCP tool factories

`tool()` e `createSdkMcpServer()` não documentados no README.

### Gap 49 (sprint-8, não implementado) — README: Query introspection/operation methods

`initializationResult()`, `supportedModels()`, `mcpServerStatus()`, `rewindFiles()`, etc.

### Gap 50 (sprint-8, não implementado) — Edge case `buildConversationChain()` fallback

Quando todos os leaves são sidechain/team/meta, `pickBest(leaves)` pode retornar um leaf de
sidechain, quebrando a invariante de excluir sidechains.

---

## Priorização

| Rank | ID | Tipo | Descrição | Score |
|------|----|------|-----------|-------|
| 1 | D-051 | bug | Fix `buildCliArgs()` throw + implementar transporte local para SDK servers | 9 |
| 2 | D-052 | bug | Fix `require()` em ESM — usar `await import()` em `createSdkMcpServer()` | 9 |
| 3 | D-053 | bug | Fix `server.tool()` assinatura incorreta no McpServer | 8 |
| 4 | D-054 | improvement | Adicionar campo `name` em `McpSdkServerConfig` per TASK.md | 7 |
| 5 | D-055 | feature | Lifecycle management de SDK servers em `query.ts` | 8 |
| 6 | D-048 | docs | Documentar MCP tool factories no README | 6 |
| 7 | D-046 | docs | Documentar V2 Session API no README | 9 |
| 8 | D-047 | docs | Documentar Query control methods no README | 7 |
| 9 | D-049 | docs | Documentar Query introspection/operation methods no README | 5 |
| 10 | D-050 | bug | Edge case em `buildConversationChain()` fallback de sidechain | 3 |

**Ordem lógica de implementação**: D-054 → D-052 → D-053 → D-051 → D-055 → D-048 → D-046 → D-047 → D-049 → D-050

O tipo precisa ser corrigido primeiro (D-054) antes de mudar o runtime (D-052/D-053). O
transporte local (D-051) depende da API correta (D-053). O lifecycle (D-055) depende do
transporte (D-051).
