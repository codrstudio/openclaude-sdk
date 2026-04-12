# openclaude-sdk - Modulo Display: 4 Meta-Tools + System Prompt

Criar as 4 meta-tools de display com discriminated union e a constante de system prompt para guiar o modelo.

---

## Objetivo

Resolver D-072 (score 9) e D-074 (score 7): implementar `src/display/tools.ts` com as 4 meta-tools que agrupam os 19 schemas em discriminated unions, e `src/display/prompt.ts` com o texto de instrucao para o modelo.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-072 | 4 meta-tools usando `tool()` nativo + `z.discriminatedUnion("action", [...])` |
| 2 | D-074 | Constante `DISPLAY_SYSTEM_PROMPT` com instrucoes para o modelo |

**Dependencia**: S-063 (compatibilidade `tool()` + `ZodDiscriminatedUnion`) e S-064 (schemas).

---

## Estado Atual

- **Source tools**: `D:\aw\context\workspaces\openclaude-sdk\repo\src\tools\display.ts`
- **Source prompt**: definido no TASK.md do sprint
- **Target tools**: `src/display/tools.ts` — nao existe
- **Target prompt**: `src/display/prompt.ts` — nao existe
- `tool()` em `src/mcp.ts` ja implementado (apos S-063 suporta `ZodTypeAny`)

---

## Implementacao

### 1. Criar `src/display/tools.ts`

Adaptar `createDisplayTools()` do openclaude-sdk para usar `tool()` de `src/mcp.ts`.

**Diferencas do original**:

| Antes (openclaude-sdk) | Depois (openclaude-sdk) |
|---------------------|------------------------|
| `import { tool } from "ai"` | `import { tool } from "../mcp.js"` |
| `execute: async (args) => ({ ...args, _display: true })` | `handler: async (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] })` |
| Retorna objeto `{ display_highlight, ... }` | Retorna `SdkMcpToolDefinition[]` (array para `createSdkMcpServer`) |

**Estrutura**:

```typescript
import { z } from "zod"
import { tool } from "../mcp.js"
import type { SdkMcpToolDefinition } from "../mcp.js"
import {
  DisplayMetricSchema, DisplayPriceSchema, DisplayAlertSchema, DisplayChoicesSchema,
  DisplayTableSchema, DisplaySpreadsheetSchema, DisplayComparisonSchema,
  DisplayCarouselSchema, DisplayGallerySchema, DisplaySourcesSchema,
  DisplayProductSchema, DisplayLinkSchema, DisplayFileSchema, DisplayImageSchema,
  DisplayChartSchema, DisplayMapSchema, DisplayCodeSchema,
  DisplayProgressSchema, DisplayStepsSchema,
} from "./schemas.js"

const echoHandler = async (args: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(args) }],
})

// 4 discriminated union schemas
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

export function createDisplayTools(): SdkMcpToolDefinition<any>[] {
  return [
    tool("display_highlight", "...", highlightSchema, echoHandler),
    tool("display_collection", "...", collectionSchema, echoHandler),
    tool("display_card", "...", cardSchema, echoHandler),
    tool("display_visual", "...", visualSchema, echoHandler),
  ]
}
```

**Descricoes das tools** (em ingles, conforme openclaude-sdk):

| Tool | Descricao |
|------|-----------|
| `display_highlight` | `"Highlight important information. Actions: metric (KPI with value and trend), price (highlighted price), alert (info/warning/error/success banner), choices (clickable options for user)."` |
| `display_collection` | `"Present organized collection of items. Actions: table (rich table with typed columns), spreadsheet (exportable sheet), comparison (items side by side), carousel (horizontal navigable cards), gallery (image grid), sources (list of consulted sources)."` |
| `display_card` | `"Present individual item with visual details. Actions: product (card with image, price, rating, badges), link (URL preview with OG image), file (file card for download), image (single image with caption and zoom)."` |
| `display_visual` | `"Specialized data or flow visualization. Actions: chart (bar/line/pie/area/donut graph), map (map with pins), code (block with syntax highlighting), progress (progress bar with steps), steps (timeline/checklist)."` |

### 2. Criar `src/display/prompt.ts`

```typescript
export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured
content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific
to that action. Call them exactly like any other tool. The client renders them as
interactive widgets.`
```

---

## Criterios de Aceite

- [ ] `src/display/tools.ts` existe com `createDisplayTools()` retornando array de 4 `SdkMcpToolDefinition`
- [ ] Cada meta-tool usa `z.discriminatedUnion("action", [...])` com schemas de S-064
- [ ] Handlers sao echo puro: retornam `{ content: [{ type: "text", text: JSON.stringify(args) }] }`
- [ ] Nenhum import de `"ai"` (Vercel AI SDK)
- [ ] `src/display/prompt.ts` existe com `DISPLAY_SYSTEM_PROMPT` exportado
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/display/tools.ts` | S-065 |
| `createDisplayTools()` | S-065 |
| 4 meta-tools (highlight, collection, card, visual) | S-065 |
| `src/display/prompt.ts` | S-065 |
| `DISPLAY_SYSTEM_PROMPT` | S-065 |
| Discovery | D-072, D-074 |
