# Brainstorming — openclaude-sdk (Sprint 12)

## Contexto

O TASK.md do sprint-12 define como meta a **Rich Output (Display Tools built-in)**: um módulo opcional ativável via `options.richOutput: true` que registra 4 MCP tools "display" in-process. Essas tools permitem que o modelo emita conteúdo visual estruturado (charts, tables, produtos, métricas etc.) como `tool_use` blocks, que clientes como `openclaude-chat` renderizam como widgets ricos.

O objetivo principal é **trazer a saída rica do `@codrstudio/openclaude-sdk`** para dentro do `openclaude-sdk` como feature built-in, eliminando a necessidade de manter o `openclaude-sdk` como package paralelo.

Sprints 1–11 cobriram:
- Core API (`query`, `collectMessages`, `continueSession`)
- V2 Session API (`createSession`, `resumeSession`, `prompt`)
- Error hierarchy tipada, Provider/Model registry, OpenRouter
- MCP tool factories inline (`tool()`, `createSdkMcpServer()`)
- Query control/introspection/operation methods (20+ métodos)
- Lifecycle management de SDK MCP servers
- Documentação completa no README.md

---

## Funcionalidades mapeadas (estado atual)

### `src/mcp.ts` — MCP tool factories

Já implementados:
- **`tool(name, description, inputSchema, handler, extras?): SdkMcpToolDefinition`** — factory de tools com Zod schema
- **`createSdkMcpServer({ name, version?, tools? }): Promise<McpSdkServerConfig>`** — cria McpServer in-process via `@modelcontextprotocol/sdk`
- **`startSdkServerTransport(config): Promise<{ port, close }>`** — inicia HTTP server para o MCP server

### `src/types/options.ts` — Options interface

Campos relevantes existentes:
- `mcpServers?: Record<string, McpServerConfig>` — registro de MCP servers
- `systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string }` — system prompt (2 formatos atualmente)
- **`richOutput` ainda NÃO existe** — é o campo a adicionar

### `src/query.ts` — query() function

Ponto de integração identificado no TASK.md: antes de construir o `McpServerConfig` final, verificar `opts.richOutput` e:
1. Fazer merge do display MCP server em `mcpServers`
2. Fazer append do `DISPLAY_SYSTEM_PROMPT` ao system prompt existente

A função `lifecycleGenerator()` já monta `optionsForCli` com servers patchados — o hook de richOutput deve ocorrer antes desse ponto.

### Source das schemas — `openclaude-sdk/src/display-schemas.ts`

Arquivo lido e analisado. Contém:
- **4 primitivos internos**: `MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema`
- **19 schemas exportados**: Metric, Chart, Table, Progress, Product, Comparison, Price, Image, Gallery, Carousel, Sources, Link, Map, File, Code, Spreadsheet, Steps, Alert, Choices
- **`DisplayToolRegistry`**: `Record<nome, schema>` com 19 entradas
- **Tipos inferidos**: 19 tipos TypeScript
- **`DisplayToolName`**: keyof do registry

### Source das 4 meta-tools — `openclaude-sdk/src/tools/display.ts`

Arquivo lido e analisado. As 4 meta-tools usam `discriminatedUnion("action", [...])`:
- **`display_highlight`**: metric, price, alert, choices
- **`display_collection`**: table, spreadsheet, comparison, carousel, gallery, sources
- **`display_card`**: product, link, file, image
- **`display_visual`**: chart, map, code, progress, steps

O arquivo original usa `import { tool } from "ai"` (Vercel AI SDK). No openclaude-sdk, o `tool()` já é a factory nativa (`src/mcp.ts`). Os handlers devem ser echo puro: `async (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] })`.

---

## Lacunas e oportunidades

### D-071 — Criar `src/display/schemas.ts` com 19 schemas Zod portados do openclaude-sdk

Porta literal de `openclaude-sdk/src/display-schemas.ts`, sem o import `from "ai"`. Mantém zod como já é peer dep. Inclui os 4 primitivos internos e exporta as 19 schemas + `DisplayToolRegistry` + `DisplayToolName` + tipos inferidos.

**Impacto**: Crítico — base de tudo no módulo display.

### D-072 — Criar `src/display/tools.ts` com as 4 meta-tools usando `tool()` nativo

Adapta o `createDisplayTools()` do openclaude-sdk para usar o `tool()` de `src/mcp.ts` (em vez de `tool` do Vercel AI SDK). O schema de cada meta-tool é um `z.discriminatedUnion("action", [...])` com `z.object({ action: z.literal("..."), ...schema.shape })`.

Ponto de atenção: o `inputSchema` da factory `tool()` em `src/mcp.ts` espera `ZodRawShape` (object de shapes), mas as meta-tools usam `discriminatedUnion`. É necessário verificar se `createSdkMcpServer()` aceita `ZodTypeAny` ou apenas `ZodRawShape`. Pode ser necessário ajustar a assinatura de `SdkMcpToolDefinition` para aceitar `z.ZodTypeAny` como `inputSchema`.

**Impacto**: Alto — define a interface que o modelo vê.

### D-073 — Criar `src/display/server.ts` com `createDisplayMcpServer()`

Função síncrona/assíncrona que retorna `Promise<McpSdkServerConfig>` usando `createSdkMcpServer()` com as 4 meta-tools do D-072.

**Impacto**: Alto — ponto de montagem do MCP server display.

### D-074 — Criar `src/display/prompt.ts` com `DISPLAY_SYSTEM_PROMPT`

Constante string com o texto curto de instrução para o modelo (em inglês, conforme TASK.md):
```
You have access to display tools for rich visual output...
```

**Impacto**: Médio — necessário para guiar o modelo a usar as tools.

### D-075 — Criar `src/display/index.ts` como barrel do módulo display

Exporta: schemas, tools, server, prompt, registry, tipos.

**Impacto**: Médio — organização do módulo.

### D-076 — Adicionar `richOutput?: boolean` à interface `Options`

Campo opcional, default `false`. Nenhum overhead quando ausente ou `false`.

**Impacto**: Alto — ponto de entrada da feature para o usuário.

### D-077 — Integrar `richOutput` em `query.ts`: merge de MCP server + system prompt

Quando `opts.richOutput === true`, antes de construir os args CLI:
1. `createDisplayMcpServer()` — await async
2. Merge em `opts.mcpServers` sob a chave `"display"` (warn se já existir)
3. `mergeSystemPromptAppend(opts.systemPrompt, DISPLAY_SYSTEM_PROMPT)` — util nova

**Impacto**: Crítico — sem isso, a flag não tem efeito.

### D-078 — Implementar `mergeSystemPromptAppend()` cobrindo 3 formatos de systemPrompt

Os 3 casos:
1. `undefined` → `{ type: "preset", preset: "claude_code", append: DISPLAY_SYSTEM_PROMPT }`
2. `string` → `string + "\n\n" + DISPLAY_SYSTEM_PROMPT`
3. `{ type: "preset", append?: string }` → `{ ...obj, append: (obj.append ?? "") + "\n\n" + DISPLAY_SYSTEM_PROMPT }`

**Impacto**: Alto — sem essa util, o system prompt não é injetado corretamente.

### D-079 — Exportar 19 schemas, 19 tipos, `DisplayToolRegistry`, `DisplayToolName` de `src/index.ts`

Conforme TASK.md:
```typescript
export { DisplayMetricSchema, ..., DisplayToolRegistry } from "./display/index.js"
export type { DisplayMetric, ..., DisplayToolName } from "./display/index.js"
```

**Impacto**: Médio — completude do barrel público.

### D-080 — Atualizar README.md com seção "Rich Output"

Seção com:
- Descrição do feature e flag `richOutput`
- Tabela das 4 meta-tools (display_highlight, display_collection, display_card, display_visual) com actions de cada
- Exemplo end-to-end completo (query com `richOutput: true`, loop sobre `msg.message.content`, detecção de `block.name.startsWith("display_")`)

**Impacto**: Médio — documentação para adoção.

### D-081 — Verificar compatibilidade da assinatura `tool()` + `SdkMcpToolDefinition` com `ZodTypeAny`

O `tool()` em `src/mcp.ts` usa `Schema extends z.ZodRawShape`. As meta-tools usam `z.ZodDiscriminatedUnion` (não é `ZodRawShape`). É necessário avaliar se `createSdkMcpServer()` passa o inputSchema diretamente ao `server.tool()` do MCP SDK ou converte para object. Pode ser necessário criar uma overload ou generalizar a tipagem de `SdkMcpToolDefinition`.

**Impacto**: Alto — bloqueante se não for resolvido antes de D-072.

---

## Priorização

| ID | Tipo | Score | Justificativa |
|----|------|-------|---------------|
| D-076 | feature | 9 | Adicionar `richOutput` à Options — pré-requisito de tudo |
| D-071 | feature | 9 | 19 schemas Zod — base de todo o módulo display |
| D-081 | bug | 9 | Compatibilidade `tool()` + discriminated union — bloqueante para D-072 |
| D-072 | feature | 9 | 4 meta-tools com discriminated union — interface que o modelo vê |
| D-077 | feature | 9 | Integrar richOutput em query.ts — sem isso a flag não tem efeito |
| D-078 | feature | 8 | mergeSystemPromptAppend() — cobre 3 formatos de systemPrompt |
| D-073 | feature | 8 | createDisplayMcpServer() — montagem do MCP server display |
| D-075 | feature | 7 | Barrel src/display/index.ts — organização do módulo |
| D-074 | feature | 7 | DISPLAY_SYSTEM_PROMPT — guia o modelo a usar as tools |
| D-079 | feature | 7 | Exports públicos em src/index.ts — completude do barrel |
| D-080 | docs | 6 | README "Rich Output" — documentação para adoção |

### Gaps carregados de sprints anteriores (não implementados)

| ID | Sprint | Tipo | Score | Desc resumida |
|----|--------|------|-------|---------------|
| D-059 | 10 | bug | 7 | startSdkServers() muta McpSdkServerConfig._localPort compartilhado |
| D-056 | 10 | bug | 7 | Zod v4 no devDep mas peerDep aceita v3 |
| D-057 | 10 | feature | 7 | 12+ opções de Options ignoradas por buildCliArgs() |
| D-062 | 10 | bug | 6 | systemPrompt preset não mapeado em buildCliArgs() |
| D-067 | 11 | feature | 5 | send() aceitar SDKUserMessage para multi-modal |
| D-061 | 10 | bug | 5 | thinking adaptive ignorado em buildCliArgs() |
| D-065 | 10 | bug | 5 | Parser JSON falha em múltiplos JSONs concatenados |
| D-063 | 10 | improvement | 5 | Headers de MCP externos não transmitidos ao CLI |
| D-060 | 10 | bug | 5 | createSession()/resumeSession() com options conflitantes — já implementado |
| D-058 | 10 | improvement | 4 | executable/executableArgs ignorados em resolveExecutable() |
| D-068 | 11 | improvement | 4 | prompt() não retorna SDKResultMessage completo |
| D-064 | 10 | docs | 4 | README sem seção de MCP servers externos |
| D-066 | 10 | improvement | 3 | MAX_BUFFER_SIZE hardcoded em 1MB |
| D-069 | 11 | improvement | 2 | Ergonomia de CreateSessionOptions — nesting desnecessário |
| D-070 | 11 | improvement | 2 | Getter currentQuery em SDKSession — caso avançado raro |
