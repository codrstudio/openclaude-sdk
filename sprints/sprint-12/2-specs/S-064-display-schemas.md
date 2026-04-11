# openclaude-sdk - Modulo Display: Schemas Zod

Portar os 19 schemas Zod de display do `agentic-sdk` para `src/display/schemas.ts`, incluindo primitivos internos, registry, tipos e type alias.

---

## Objetivo

Resolver D-071 (score 9): criar `src/display/schemas.ts` com os 19 schemas portados de `agentic-sdk/src/display-schemas.ts`. Este arquivo e a base de todo o modulo display — pre-requisito de tools (S-065), server (S-066) e exports (S-068).

| # | Acao | Detalhe |
|---|------|---------|
| 1 | Copiar 4 primitivos | `MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema` (nao exportados) |
| 2 | Copiar 19 schemas | Todos os `Display*Schema` exportados |
| 3 | Copiar registry | `DisplayToolRegistry` — `Record<nome, schema>` com 19 entradas |
| 4 | Copiar tipos | 19 tipos inferidos via `z.infer<>` + `DisplayToolName` |

---

## Estado Atual

- **Source**: `D:\aw\context\workspaces\agentic-sdk\repo\src\display-schemas.ts` (277 linhas)
- **Target**: `src/display/schemas.ts` — arquivo nao existe ainda
- `zod` ja e peer dep do openclaude-sdk

---

## Implementacao

### 1. Criar `src/display/schemas.ts`

**Porta literal** do arquivo source, com as seguintes diferencas:

| Antes (agentic-sdk) | Depois (openclaude-sdk) |
|---------------------|------------------------|
| `import { z } from "zod"` | `import { z } from "zod"` (igual — zod ja e peer dep) |
| Nenhum import de `"ai"` neste arquivo | N/A |

**Conteudo completo a portar**:

**Primitivos internos** (nao exportados):

```typescript
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
```

**19 schemas exportados** — copia literal de:

| Schema | Categoria |
|--------|-----------|
| `DisplayMetricSchema` | Metricas e dados |
| `DisplayChartSchema` | Metricas e dados |
| `DisplayTableSchema` | Metricas e dados |
| `DisplayProgressSchema` | Metricas e dados |
| `DisplayProductSchema` | Produtos e comercio |
| `DisplayComparisonSchema` | Produtos e comercio |
| `DisplayPriceSchema` | Produtos e comercio |
| `DisplayImageSchema` | Midia |
| `DisplayGallerySchema` | Midia |
| `DisplayCarouselSchema` | Midia |
| `DisplaySourcesSchema` | Referencias e navegacao |
| `DisplayLinkSchema` | Referencias e navegacao |
| `DisplayMapSchema` | Referencias e navegacao |
| `DisplayFileSchema` | Documentos e arquivos |
| `DisplayCodeSchema` | Documentos e arquivos |
| `DisplaySpreadsheetSchema` | Documentos e arquivos |
| `DisplayStepsSchema` | Interativo |
| `DisplayAlertSchema` | Interativo |
| `DisplayChoicesSchema` | Interativo |

**Registry**:

```typescript
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
```

**19 tipos inferidos**:

```typescript
export type DisplayMetric = z.infer<typeof DisplayMetricSchema>
export type DisplayChart = z.infer<typeof DisplayChartSchema>
// ... (demais 17 tipos seguem o mesmo padrao)
```

---

## Criterios de Aceite

- [ ] `src/display/schemas.ts` existe com os 4 primitivos (nao exportados)
- [ ] 19 schemas Zod exportados com nomes identicos ao source
- [ ] `DisplayToolRegistry` exportado como `Record` com 19 entradas
- [ ] `DisplayToolName` exportado como `keyof typeof DisplayToolRegistry`
- [ ] 19 tipos inferidos exportados (`DisplayMetric`, `DisplayChart`, etc.)
- [ ] Nenhum import de `"ai"` (Vercel AI SDK)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/display/schemas.ts` | S-064 |
| 19 schemas Zod | S-064 |
| `DisplayToolRegistry` | S-064 |
| `DisplayToolName` | S-064 |
| 19 tipos inferidos | S-064 |
| Discovery | D-071 |
