# openclaude-sdk - DisplayReactSchema e action react no visualSchema

Spec do schema Zod `DisplayReactSchema` e sua integracao como 6a action no `visualSchema` de `display_visual`.

---

## Objetivo

Resolve D-095 e D-096.

| Problema | Consequencia |
|----------|-------------|
| Nenhum dos 19 schemas existentes produz componentes React renderizaveis | Dashboards animados, explainers interativos e timelines com Framer Motion sao impossiveis |
| `visualSchema` em `tools.ts` tem 5 actions (chart, map, code, progress, steps) — falta `react` | Modelo nao pode invocar `display_visual` com `action: "react"` |

---

## Estado Atual

### `src/display/schemas.ts`

- 19 schemas exportados (DisplayMetricSchema .. DisplayChoicesSchema)
- Registry com 19 entries, tipos inferidos para cada um
- Nenhum schema para componentes React

### `src/display/tools.ts` (linhas 53-59)

```typescript
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
])
```

5 entries no discriminated union. Sem entry para `react`.

---

## Implementacao

### 1. DisplayReactSchema em `src/display/schemas.ts`

Adicionar apos a secao "6. INTERATIVO" (depois de `DisplayChoicesSchema`):

```typescript
// 7. REACT COMPONENTS

export const DisplayReactSchema = z.object({
  version: z.literal("1"),

  title: z.string().optional()
    .describe("Titulo exibido acima do componente"),
  description: z.string().optional()
    .describe("Subtitulo ou contexto curto"),

  code: z.string()
    .describe(
      "ES module source. Must contain exactly one " +
      "`export default function Component(props) { ... }`. " +
      "Max 8 KB."
    ),

  language: z.enum(["jsx", "tsx"]).default("jsx")
    .describe("Source language — determines transpiler preset"),

  entry: z.literal("default").default("default")
    .describe("Reserved for future expansion; always 'default' in v1"),

  imports: z.array(
    z.object({
      module: z.enum(["react", "framer-motion"]),
      symbols: z.array(z.string()).min(1),
    })
  ).describe(
    "Every import used in `code` must be declared here. " +
    "Mismatch with actual imports rejects the payload."
  ),

  initialProps: z.record(z.unknown()).optional()
    .describe("Props passed to the component on mount. Max 32 KB serialized."),

  layout: z.object({
    height: z.union([z.number(), z.literal("auto")]).optional()
      .describe("Height in px, or 'auto' for ResizeObserver-driven"),
    aspectRatio: z.string().optional()
      .describe("CSS aspect-ratio string, e.g. '16/9'"),
    maxWidth: z.number().optional()
      .describe("Max width in px; default: 100% of container"),
  }).optional(),

  theme: z.enum(["light", "dark", "auto"]).optional(),
})
```

### 2. Tipo inferido e Registry

Na secao de tipos inferidos de `schemas.ts`:

```typescript
export type DisplayReact = z.infer<typeof DisplayReactSchema>
```

O `DisplayToolRegistry` **nao** ganha entrada para `display_react` — a action `react` vive dentro do `display_visual` meta-tool, nao como tool separada. O registry mapeia tools de nivel superior, nao actions.

### 3. Action `react` no visualSchema de `tools.ts`

Adicionar import de `DisplayReactSchema` e a 6a entry no union:

```typescript
import {
  // ... imports existentes ...
  DisplayReactSchema,
} from "./schemas.js"

const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
  z.object({ action: z.literal("react"), ...DisplayReactSchema.shape }),
])
```

### 4. Descricao atualizada do display_visual

A string de descricao do tool `display_visual` (linhas 100-106 de `tools.ts`) ganha menção a `react`:

```typescript
tool(
  "display_visual",
  [
    "Visualizacao especializada de dados ou fluxos.",
    "Actions: chart (grafico bar/line/pie/area/donut), map (mapa com pins),",
    "code (bloco com syntax highlighting), progress (barra de progresso com etapas),",
    "steps (timeline/checklist de etapas), react (componente React com Framer Motion).",
  ].join(" "),
  visualSchema,
  async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }),
),
```

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/display/schemas.ts` | fim do arquivo (apos L277) | + `DisplayReactSchema`, + `DisplayReact` tipo |
| `src/display/tools.ts` | L2 (imports), L53-59 (visualSchema), L100-106 (descricao) | + import `DisplayReactSchema`, + entry `react` no union, + `react` na descricao |

---

## Criterios de Aceite

- [ ] `DisplayReactSchema` exportado de `schemas.ts` com campos: `version` (literal "1"), `title?`, `description?`, `code`, `language` (enum jsx/tsx, default jsx), `entry` (literal "default", default "default"), `imports` (array de `{module, symbols}`), `initialProps?`, `layout?` (`{height?, aspectRatio?, maxWidth?}`), `theme?`
- [ ] `DisplayReact` tipo inferido exportado de `schemas.ts`
- [ ] `imports[].module` restrito a `z.enum(["react", "framer-motion"])`
- [ ] `imports[].symbols` requer `.min(1)`
- [ ] `layout.height` aceita `z.union([z.number(), z.literal("auto")])`
- [ ] `visualSchema` em `tools.ts` tem 6 entries (chart, map, code, progress, steps, react)
- [ ] Descricao do `display_visual` menciona `react (componente React com Framer Motion)`
- [ ] `DisplayToolRegistry` **nao** ganha entrada `display_react` — action vive dentro de `display_visual`
- [ ] `tsc --noEmit` passa
- [ ] `tsup` builda sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `DisplayReactSchema` | S-074 |
| `DisplayReact` tipo | S-074 |
| `visualSchema` entry `react` | S-074 |
| Descricao `display_visual` | S-074 |
| D-095 | S-074 |
| D-096 | S-074 |
