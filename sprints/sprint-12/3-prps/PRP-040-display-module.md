# PRP-040 — Display Module: Schemas, Tools, Server, Barrel

## Objetivo

Criar o modulo `src/display/` com 19 schemas Zod portados do `agentic-sdk`, 4 meta-tools com discriminated union, system prompt, MCP server factory e barrel de exports.

Referencia: specs S-064 (D-071), S-065 (D-072, D-074), S-066 (D-073, D-075).

## Execution Mode

`implementar`

## Contexto

O `@codrstudio/agentic-sdk` em `D:\aw\context\workspaces\agentic-sdk\repo` contem:
- `src/display-schemas.ts` (277 linhas) — 19 schemas Zod + 4 primitivos internos + registry + tipos inferidos
- `src/tools/display.ts` (105 linhas) — 4 meta-tools usando `tool()` do Vercel AI SDK com `z.discriminatedUnion("action", [...])`

O openclaude-sdk ja tem:
- `tool()` em `src/mcp.ts` — factory nativa (apos PRP-039, aceita `ZodTypeAny`)
- `createSdkMcpServer()` em `src/mcp.ts` — cria McpServer in-process
- `zod` como peer dep
- `@modelcontextprotocol/sdk` como peer dep

O modulo `src/display/` ainda nao existe. Sera criado com 5 arquivos.

## Especificacao

### Feature F-094 — src/display/schemas.ts

Criar `src/display/schemas.ts` com porta literal de `agentic-sdk/src/display-schemas.ts`.

**Conteudo completo do arquivo:**

```typescript
import { z } from "zod"

// --- Primitivos reutilizaveis (nao exportados) ---

const MoneySchema = z.object({
  value: z.number(),
  currency: z.string().default("BRL"),
})

const SourceRefSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  favicon: z.string().url().optional(),
})

const ImageItemSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
})

const BadgeSchema = z.object({
  label: z.string(),
  variant: z.enum(["default", "success", "warning", "error", "info"]).default("default"),
})

// --- Display Schemas ---

export const DisplayMetricSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: z.object({
    direction: z.enum(["up", "down", "neutral"]),
    value: z.string(),
  }).optional(),
  icon: z.string().optional(),
})

export const DisplayChartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area", "donut"]),
  title: z.string(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
  format: z.object({
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    locale: z.string().default("pt-BR"),
  }).optional(),
})

export const DisplayTableSchema = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "number", "money", "image", "link", "badge"]).default("text"),
    align: z.enum(["left", "center", "right"]).default("left"),
  })),
  rows: z.array(z.record(z.unknown())),
  sortable: z.boolean().default(false),
})

export const DisplayProgressSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    label: z.string(),
    status: z.enum(["completed", "current", "pending"]),
    description: z.string().optional(),
  })),
})

export const DisplayProductSchema = z.object({
  title: z.string(),
  image: z.string().url().optional(),
  price: MoneySchema.optional(),
  originalPrice: MoneySchema.optional(),
  rating: z.object({
    score: z.number().min(0).max(5),
    count: z.number(),
  }).optional(),
  source: SourceRefSchema.optional(),
  badges: z.array(BadgeSchema).optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
})

export const DisplayComparisonSchema = z.object({
  title: z.string().optional(),
  items: z.array(DisplayProductSchema),
  attributes: z.array(z.object({
    key: z.string(),
    label: z.string(),
  })).optional(),
})

export const DisplayPriceSchema = z.object({
  value: MoneySchema,
  label: z.string(),
  context: z.string().optional(),
  source: SourceRefSchema.optional(),
  badge: BadgeSchema.optional(),
})

export const DisplayImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export const DisplayGallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(ImageItemSchema),
  layout: z.enum(["grid", "masonry"]).default("grid"),
  columns: z.number().min(2).max(5).default(3),
})

export const DisplayCarouselSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    image: z.string().url().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    price: MoneySchema.optional(),
    url: z.string().url().optional(),
    badges: z.array(BadgeSchema).optional(),
  })),
})

export const DisplaySourcesSchema = z.object({
  label: z.string().default("Fontes consultadas"),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    favicon: z.string().url().optional(),
    snippet: z.string().optional(),
  })),
})

export const DisplayLinkSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  favicon: z.string().url().optional(),
  domain: z.string().optional(),
})

export const DisplayMapSchema = z.object({
  title: z.string().optional(),
  pins: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
    address: z.string().optional(),
  })),
  zoom: z.number().min(1).max(20).default(14),
})

export const DisplayFileSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().optional(),
  url: z.string().url().optional(),
  preview: z.string().optional(),
})

export const DisplayCodeSchema = z.object({
  language: z.string(),
  code: z.string(),
  title: z.string().optional(),
  lineNumbers: z.boolean().default(true),
})

export const DisplaySpreadsheetSchema = z.object({
  title: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  format: z.object({
    moneyColumns: z.array(z.number()).optional(),
    percentColumns: z.array(z.number()).optional(),
  }).optional(),
})

export const DisplayStepsSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["completed", "current", "pending"]).default("pending"),
  })),
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
})

export const DisplayAlertSchema = z.object({
  variant: z.enum(["info", "warning", "error", "success"]),
  title: z.string().optional(),
  message: z.string(),
  icon: z.string().optional(),
})

export const DisplayChoicesSchema = z.object({
  question: z.string().optional(),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  })),
  layout: z.enum(["buttons", "cards", "list"]).default("buttons"),
})

// --- Registry ---

export const DisplayToolRegistry = {
  display_metric: DisplayMetricSchema,
  display_chart: DisplayChartSchema,
  display_table: DisplayTableSchema,
  display_progress: DisplayProgressSchema,
  display_product: DisplayProductSchema,
  display_comparison: DisplayComparisonSchema,
  display_price: DisplayPriceSchema,
  display_image: DisplayImageSchema,
  display_gallery: DisplayGallerySchema,
  display_carousel: DisplayCarouselSchema,
  display_sources: DisplaySourcesSchema,
  display_link: DisplayLinkSchema,
  display_map: DisplayMapSchema,
  display_file: DisplayFileSchema,
  display_code: DisplayCodeSchema,
  display_spreadsheet: DisplaySpreadsheetSchema,
  display_steps: DisplayStepsSchema,
  display_alert: DisplayAlertSchema,
  display_choices: DisplayChoicesSchema,
} as const

export type DisplayToolName = keyof typeof DisplayToolRegistry

// --- Tipos inferidos ---

export type DisplayMetric = z.infer<typeof DisplayMetricSchema>
export type DisplayChart = z.infer<typeof DisplayChartSchema>
export type DisplayTable = z.infer<typeof DisplayTableSchema>
export type DisplayProgress = z.infer<typeof DisplayProgressSchema>
export type DisplayProduct = z.infer<typeof DisplayProductSchema>
export type DisplayComparison = z.infer<typeof DisplayComparisonSchema>
export type DisplayPrice = z.infer<typeof DisplayPriceSchema>
export type DisplayImage = z.infer<typeof DisplayImageSchema>
export type DisplayGallery = z.infer<typeof DisplayGallerySchema>
export type DisplayCarousel = z.infer<typeof DisplayCarouselSchema>
export type DisplaySources = z.infer<typeof DisplaySourcesSchema>
export type DisplayLink = z.infer<typeof DisplayLinkSchema>
export type DisplayMap = z.infer<typeof DisplayMapSchema>
export type DisplayFile = z.infer<typeof DisplayFileSchema>
export type DisplayCode = z.infer<typeof DisplayCodeSchema>
export type DisplaySpreadsheet = z.infer<typeof DisplaySpreadsheetSchema>
export type DisplaySteps = z.infer<typeof DisplayStepsSchema>
export type DisplayAlert = z.infer<typeof DisplayAlertSchema>
export type DisplayChoices = z.infer<typeof DisplayChoicesSchema>
```

Mudancas em relacao ao original `agentic-sdk/src/display-schemas.ts`:
- Removido `import { z } from "zod";` com ponto-e-virgula — usar sem trailing semicolons (consistencia com codebase)
- Nenhuma outra mudanca — porta literal

### Feature F-095 — src/display/tools.ts

Criar `src/display/tools.ts` com as 4 meta-tools adaptadas para `tool()` do openclaude-sdk.

**Conteudo completo do arquivo:**

```typescript
import { z } from "zod"
import type { SdkMcpToolDefinition } from "../mcp.js"
import { tool } from "../mcp.js"
import {
  DisplayMetricSchema,
  DisplayPriceSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
  DisplayTableSchema,
  DisplaySpreadsheetSchema,
  DisplayComparisonSchema,
  DisplayCarouselSchema,
  DisplayGallerySchema,
  DisplaySourcesSchema,
  DisplayProductSchema,
  DisplayLinkSchema,
  DisplayFileSchema,
  DisplayImageSchema,
  DisplayChartSchema,
  DisplayMapSchema,
  DisplayCodeSchema,
  DisplayProgressSchema,
  DisplayStepsSchema,
} from "./schemas.js"

const highlightSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("metric"), ...DisplayMetricSchema.shape }),
  z.object({ action: z.literal("price"), ...DisplayPriceSchema.shape }),
  z.object({ action: z.literal("alert"), ...DisplayAlertSchema.shape }),
  z.object({ action: z.literal("choices"), ...DisplayChoicesSchema.shape }),
])

const collectionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("table"), ...DisplayTableSchema.shape }),
  z.object({ action: z.literal("spreadsheet"), ...DisplaySpreadsheetSchema.shape }),
  z.object({ action: z.literal("comparison"), ...DisplayComparisonSchema.shape }),
  z.object({ action: z.literal("carousel"), ...DisplayCarouselSchema.shape }),
  z.object({ action: z.literal("gallery"), ...DisplayGallerySchema.shape }),
  z.object({ action: z.literal("sources"), ...DisplaySourcesSchema.shape }),
])

const cardSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("product"), ...DisplayProductSchema.shape }),
  z.object({ action: z.literal("link"), ...DisplayLinkSchema.shape }),
  z.object({ action: z.literal("file"), ...DisplayFileSchema.shape }),
  z.object({ action: z.literal("image"), ...DisplayImageSchema.shape }),
])

const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
])

const echoHandler = async (args: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(args) }],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDisplayTools(): SdkMcpToolDefinition<any>[] {
  return [
    tool(
      "display_highlight",
      "Highlight important information. Actions: metric (KPI with value and trend), price (highlighted price), alert (info/warning/error/success banner), choices (clickable options for user).",
      highlightSchema,
      echoHandler,
    ),
    tool(
      "display_collection",
      "Present organized collection of items. Actions: table (rich table with typed columns), spreadsheet (exportable sheet), comparison (items side by side), carousel (horizontal navigable cards), gallery (image grid), sources (list of consulted sources).",
      collectionSchema,
      echoHandler,
    ),
    tool(
      "display_card",
      "Present individual item with visual details. Actions: product (card with image, price, rating, badges), link (URL preview with OG image), file (file card for download), image (single image with caption and zoom).",
      cardSchema,
      echoHandler,
    ),
    tool(
      "display_visual",
      "Specialized data or flow visualization. Actions: chart (bar/line/pie/area/donut graph), map (map with pins), code (block with syntax highlighting), progress (progress bar with steps), steps (timeline/checklist).",
      visualSchema,
      echoHandler,
    ),
  ]
}
```

Mudancas em relacao ao original `agentic-sdk/src/tools/display.ts`:
- `import { tool } from "ai"` substituido por `import { tool } from "../mcp.js"`
- Handlers mudam de `async (args) => ({ ...args, _display: true })` para echo puro `async (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] })` — compativel com `CallToolResult` do MCP SDK
- Descricoes em ingles (TASK.md especifica ingles para o system prompt e descricoes)
- Retorna array em vez de objeto (compativel com `createSdkMcpServer({ tools: [...] })`)
- Tipo de retorno `SdkMcpToolDefinition<any>[]` (any necessario porque cada tool tem schema diferente)

### Feature F-096 — src/display/prompt.ts

Criar `src/display/prompt.ts` com a constante do system prompt.

**Conteudo completo do arquivo:**

```typescript
export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific to that action. Call them exactly like any other tool. The client renders them as interactive widgets.`
```

### Feature F-097 — src/display/server.ts

Criar `src/display/server.ts` com `createDisplayMcpServer()`.

**Conteudo completo do arquivo:**

```typescript
import type { McpSdkServerConfig } from "../types/options.js"
import { createSdkMcpServer } from "../mcp.js"
import { createDisplayTools } from "./tools.js"

export async function createDisplayMcpServer(): Promise<McpSdkServerConfig> {
  return createSdkMcpServer({
    name: "display",
    tools: createDisplayTools(),
  })
}
```

### Feature F-098 — src/display/index.ts

Criar `src/display/index.ts` como barrel do modulo.

**Conteudo completo do arquivo:**

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
} from "./schemas.js"

export type {
  DisplayToolName,
  DisplayMetric,
  DisplayChart,
  DisplayTable,
  DisplayProgress,
  DisplayProduct,
  DisplayComparison,
  DisplayPrice,
  DisplayImage,
  DisplayGallery,
  DisplayCarousel,
  DisplaySources,
  DisplayLink,
  DisplayMap,
  DisplayFile,
  DisplayCode,
  DisplaySpreadsheet,
  DisplaySteps,
  DisplayAlert,
  DisplayChoices,
} from "./schemas.js"

export { createDisplayTools } from "./tools.js"
export { DISPLAY_SYSTEM_PROMPT } from "./prompt.js"
export { createDisplayMcpServer } from "./server.js"
```

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `import { DisplayMetricSchema } from "./display/index.js"` | Schema Zod com campos label, value, unit, trend, icon |
| `DisplayToolRegistry.display_metric` | Mesmo que `DisplayMetricSchema` |
| `createDisplayTools()` | Array com 4 `SdkMcpToolDefinition` |
| `createDisplayTools()[0].name` | `"display_highlight"` |
| `createDisplayTools()[0].handler({ action: "metric", label: "x", value: 1 })` | `{ content: [{ type: "text", text: '{"action":"metric","label":"x","value":1}' }] }` |
| `await createDisplayMcpServer()` | `{ type: "sdk", name: "display", instance: McpServer }` |
| `DISPLAY_SYSTEM_PROMPT` | String com instrucoes para o modelo |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-094 | displaySchemas | `src/display/schemas.ts` com 19 schemas Zod, 4 primitivos internos, registry, tipos inferidos |
| F-095 | displayMetaTools | `src/display/tools.ts` com 4 meta-tools usando `tool()` + `z.discriminatedUnion()` e echo handler |
| F-096 | displayPrompt | `src/display/prompt.ts` com `DISPLAY_SYSTEM_PROMPT` constante |
| F-097 | displayServer | `src/display/server.ts` com `createDisplayMcpServer()` via `createSdkMcpServer()` |
| F-098 | displayBarrel | `src/display/index.ts` barrel reexportando schemas, tipos, tools, prompt, server |

## Limites

- NAO exportar os 4 primitivos internos (`MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema`)
- NAO adicionar import de `"ai"` (Vercel AI SDK) — usar apenas `zod` e `../mcp.js`
- NAO adicionar validacao nos handlers — echo puro, o schema Zod do MCP SDK ja valida na entrada
- NAO alterar `src/mcp.ts` — alteracoes de tipagem sao escopo de PRP-039
- NAO alterar `src/index.ts` — exports publicos sao escopo de PRP-041
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO criar componentes React de renderizacao — responsabilidade do agentic-chat

## Dependencias

Depende de **PRP-039** (tool() precisa aceitar `ZodTypeAny` para as meta-tools compilarem).
