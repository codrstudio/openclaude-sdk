# Rich Output — Display Tools built-in

Built-in opcional que registra 4 MCP tools "display" in-process quando `options.richOutput: true`. Essas tools servem como canal para o modelo emitir **conteudo visual estruturado** (charts, tables, produtos, metricas, etc) que o cliente (ex: `openclaude-chat`) renderiza como widgets ricos.

---

## Contexto

O package externo `@codrstudio/openclaude-sdk` (em `D:\aw\context\workspaces\openclaude-sdk\repo`) foi criado quando o openclaude-sdk ainda nao existia, com base no Vercel AI SDK. Depois que migramos para openclaude-sdk o unico diferencial real que sobrou dele e a **saida rica**: um conjunto de schemas Zod que descrevem widgets visuais + 4 "display tools" agregadoras que o modelo invoca como tool calls.

Em vez de manter `openclaude-sdk` como package paralelo, queremos **trazer a saida rica para o openclaude-sdk como feature built-in opcional**, ativavel via flag. Assim o `openclaude-sdk` pode ser deprecado e o `openclaude-chat` passa a depender apenas do openclaude-sdk.

O feature e **zero-overhead quando desligado** — flag off significa que nada e registrado, nem o system prompt e modificado.

---

## Design

### Flag na `Options`

```typescript
interface Options {
  // ... campos existentes
  richOutput?: boolean  // default: false
}
```

Quando `true`, antes de spawnar o CLI o SDK:
1. Cria um `createSdkMcpServer({ name: "display", tools: [...4 display tools] })` in-process.
2. Faz merge com `options.mcpServers` existente (sob a chave `"display"`).
3. Injeta uma instrucao curta em `systemPrompt.append` explicando quando usar cada display tool.

### Design das 4 tools (agrupamento intencional)

As 19 schemas base sao agrupadas em **4 meta-tools com discriminated union `action`**, para reduzir a superficie exposta ao modelo (19 tools poluiriam o tool index — 4 e mais gerenciavel). Cada meta-tool tem um eixo tematico:

| Tool | Actions | Proposito |
|------|---------|-----------|
| `display_highlight` | `metric`, `price`, `alert`, `choices` | Destaque de informacao pontual |
| `display_collection` | `table`, `spreadsheet`, `comparison`, `carousel`, `gallery`, `sources` | Colecao de itens |
| `display_card` | `product`, `link`, `file`, `image` | Item individual com detalhes |
| `display_visual` | `chart`, `map`, `code`, `progress`, `steps` | Visualizacao especializada |

Cada schema filho e uma `z.discriminatedUnion("action", [...])`.

### Handler das display tools

Os handlers sao **echo puros** — nao tem logica real. O proposito e apenas **fazer o modelo emitir um `tool_use` block com nome `display_*` e input estruturado**. A renderizacao e 100% do lado cliente; o servidor apenas registra a invocacao.

```typescript
handler: async (args) => ({
  content: [{ type: "text", text: JSON.stringify(args) }],
})
```

O cliente (openclaude-chat) detecta `block.type === "tool_use" && block.name.startsWith("display_")` e despacha para o renderer correspondente lendo `block.input`.

### System prompt injetado

Texto curto (em `systemPrompt.append` — preserva o preset claude_code do CLI):

```
You have access to display tools for rich visual output. When showing structured
content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific
to that action. Call them exactly like any other tool. The client renders them as
interactive widgets.
```

---

## Schemas a portar

As 19 schemas base vem de `D:\aw\context\workspaces\openclaude-sdk\repo\src\display-schemas.ts`. Copia literal, exceto:

- Remover import de `"ai"` (Vercel AI SDK) — nao e usado na parte pura de schemas.
- Manter uso de `zod` (ja e peer dep do openclaude-sdk por causa do task 06 de milestone-01).
- Reexportar tudo em um novo modulo `src/display/schemas.ts`.

Lista completa:

```
DisplayMetricSchema        DisplayChartSchema         DisplayTableSchema
DisplayProgressSchema      DisplayProductSchema       DisplayComparisonSchema
DisplayPriceSchema         DisplayImageSchema         DisplayGallerySchema
DisplayCarouselSchema      DisplaySourcesSchema       DisplayLinkSchema
DisplayMapSchema           DisplayFileSchema          DisplayCodeSchema
DisplaySpreadsheetSchema   DisplayStepsSchema         DisplayAlertSchema
DisplayChoicesSchema
```

Primitivos reutilizaveis: `MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema` (internos, nao precisam ser exportados).

---

## Estrutura de arquivos

```
src/
  display/
    schemas.ts       # 19 schemas Zod + primitivos
    tools.ts         # 4 meta-tools (display_highlight etc) via tool()
    server.ts        # createDisplayMcpServer() → createSdkMcpServer()
    prompt.ts        # Texto do system prompt append
    index.ts         # Barrel: exporta schemas, types, registry
  index.ts           # Adiciona exports de display/*
  query.ts           # Aplica injecao quando options.richOutput === true
```

---

## Exports publicos novos

Em `src/index.ts`:

```typescript
export {
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
  DisplayToolRegistry,
} from "./display/index.js"

export type {
  DisplayMetric, DisplayChart, DisplayTable, DisplayProgress,
  DisplayProduct, DisplayComparison, DisplayPrice, DisplayImage,
  DisplayGallery, DisplayCarousel, DisplaySources, DisplayLink,
  DisplayMap, DisplayFile, DisplayCode, DisplaySpreadsheet,
  DisplaySteps, DisplayAlert, DisplayChoices,
  DisplayToolName,
} from "./display/index.js"
```

`DisplayToolRegistry` e um `Record<nome, schema>` com as 19 entradas — serve para o cliente validar um `tool_use.input` pelo `tool_use.name`.

---

## Ponto de integracao em `query.ts`

Onde: antes de construir o `McpServerConfig` final que vai para a CLI.

```typescript
// Pseudocodigo
import { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT } from "./display/index.js"

function query(params: QueryParams): Query {
  const opts = { ...params.options }

  if (opts.richOutput) {
    const displayServer = createDisplayMcpServer()
    opts.mcpServers = {
      ...opts.mcpServers,
      display: displayServer,
    }
    opts.systemPrompt = mergeSystemPromptAppend(opts.systemPrompt, DISPLAY_SYSTEM_PROMPT)
  }

  // ... resto do fluxo existente
}
```

`mergeSystemPromptAppend` precisa cobrir os tres formatos que o CLI aceita:

- `undefined` → `{ type: "preset", preset: "claude_code", append: DISPLAY_SYSTEM_PROMPT }`
- `string` → concat com `\n\n`
- `{ type: "preset", append?: string }` → concat no `append`

---

## Exemplo end-to-end

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Compare the top 3 laptops under $1500 with specs and prices",
  options: {
    richOutput: true,
  },
})

for await (const msg of q) {
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "tool_use" && block.name?.startsWith("display_")) {
        console.log(`[rich] ${block.name}:`, block.input)
        // cliente: renderizar widget
      } else if (block.type === "text") {
        console.log(block.text)
      }
    }
  }
}
```

---

## Criterios de aceite

- [ ] `options.richOutput: boolean` aceita na interface `Options`
- [ ] `src/display/schemas.ts` com as 19 schemas Zod portadas de `openclaude-sdk/src/display-schemas.ts`
- [ ] `src/display/tools.ts` com as 4 meta-tools (`display_highlight`, `display_collection`, `display_card`, `display_visual`) usando `tool()` do milestone-01/06
- [ ] `src/display/server.ts` expondo `createDisplayMcpServer()` que retorna `McpSdkServerConfigWithInstance`
- [ ] Flag `richOutput: false` (ou ausente) = zero overhead: nenhum MCP server e nada no system prompt
- [ ] Flag `richOutput: true` = MCP server "display" mergeado em `mcpServers` + append no system prompt
- [ ] Merge respeita `mcpServers` existentes do usuario (nao sobrescreve se ja houver chave "display", ou sobrescreve + warn)
- [ ] Merge do system prompt cobre os 3 formatos (`undefined` / `string` / `{ type: "preset", append? }`)
- [ ] 19 schemas + 19 tipos inferidos + `DisplayToolRegistry` exportados no barrel principal
- [ ] Typecheck passa (`tsc --noEmit`)
- [ ] Build passa (`tsup`)
- [ ] README ganha secao nova "Rich Output" com exemplo e tabela das 4 tools
- [ ] Teste manual via demo em `D:\aw\context\workspaces\openclaude-sdk\repo\.tmp\demo` com flag ativa — modelo invoca display tool, cliente ve o `tool_use` no stream

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| `tool()` e `createSdkMcpServer()` | Ja implementado — milestone-01 task 06 |
| `zod` como peer dep | Ja peer dep |
| `@modelcontextprotocol/sdk` como peer dep | Ja peer dep |

Nenhuma dep nova.

---

## Nao-objetivos

- **Renderizacao** — e responsabilidade do cliente (openclaude-chat), nao do SDK.
- **Validacao de output no servidor** — handler echo, sem validacao alem do schema Zod nativo do MCP (que ja valida na entrada do tool call).
- **Componentes React** — nao vao para este repo. Ficam no `openclaude-chat`.
- **Migracao de consumidores** — deprecation do `openclaude-sdk` e task separada, fora do escopo do openclaude-sdk.

---

## Prioridade

**Alta** — desbloqueia a deprecation do `@codrstudio/openclaude-sdk` e simplifica o ecossistema para um unico package base.

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Gap analysis openclaude-sdk vs openclaude-sdk | Conversa de design 2026-04-10 |
| Source das schemas | `D:\aw\context\workspaces\openclaude-sdk\repo\src\display-schemas.ts` |
| Source do agrupamento em 4 tools | `D:\aw\context\workspaces\openclaude-sdk\repo\src\tools\display.ts` |
| Dep de `tool()` e `createSdkMcpServer()` | `sprints/backlog/milestone-01/06-mcp-tool-factories/TASK.md` |
| Consumidor final | `D:\aw\context\workspaces\openclaude-chat\repo` (redesign pos-merge) |
| Demo de validacao | `D:\aw\context\workspaces\openclaude-sdk\repo\.tmp\demo` |

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