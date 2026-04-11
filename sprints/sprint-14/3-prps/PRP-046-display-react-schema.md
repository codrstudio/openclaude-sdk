# PRP-046 — DisplayReactSchema + action react no visualSchema

## Objetivo

Criar `DisplayReactSchema` em `src/display/schemas.ts` e adicionar a action `react` ao `visualSchema` de `src/display/tools.ts`, habilitando o modelo a emitir componentes React via `display_visual`.

Referencia: specs S-074 (D-095, D-096).

## Execution Mode

`implementar`

## Contexto

O modulo `src/display/` ja existe (PRP-040, sprint-12) com:
- `schemas.ts` — 19 schemas Zod + registry + tipos inferidos (277 linhas)
- `tools.ts` — 4 meta-tools com `z.discriminatedUnion("action", [...])`, `visualSchema` tem 5 entries (chart, map, code, progress, steps)
- `prompt.ts` — `DISPLAY_SYSTEM_PROMPT` + `mergeSystemPromptAppend()`
- `server.ts` — `createDisplayMcpServer()`
- `index.ts` — barrel de reexportacao

Infraestrutura disponivel:
- `tool()` em `src/mcp.ts` — factory nativa (aceita `ZodTypeAny` apos PRP-039)
- `zod` como peer dep

A action `react` sera a 6a entry no `visualSchema` de `display_visual`. O schema vive estaticamente no union — independente da flag `reactOutput`. O que controla se o modelo usa a action e o system prompt (PRP-047).

## Especificacao

### Feature F-115 — DisplayReactSchema em src/display/schemas.ts

Adicionar apos a secao "6. INTERATIVO" (depois de `DisplayChoicesSchema`), antes do registry:

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

Na secao de tipos inferidos, adicionar:

```typescript
export type DisplayReact = z.infer<typeof DisplayReactSchema>
```

Regras:
- `version` e `z.literal("1")` — permite evolucao futura sem quebrar clientes
- `imports[].module` restrito a `z.enum(["react", "framer-motion"])` — whitelist estrita v1
- `imports[].symbols` requer `.min(1)` — cada import deve declarar ao menos um simbolo
- `layout.height` aceita `z.union([z.number(), z.literal("auto")])` — px ou auto
- `entry` e `z.literal("default")` — reservado para expansao futura, sempre "default" em v1
- `DisplayToolRegistry` **NAO** ganha entrada para `display_react` — a action `react` vive dentro de `display_visual`, nao como tool separada

### Feature F-116 — Action react no visualSchema de src/display/tools.ts

**1. Import adicional** (na lista de imports de `./schemas.js`):

```typescript
import {
  // ... imports existentes ...
  DisplayReactSchema,
} from "./schemas.js"
```

**2. Nova entry no visualSchema** (apos a entry `steps`):

```typescript
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
  z.object({ action: z.literal("react"), ...DisplayReactSchema.shape }),
])
```

**3. Descricao atualizada do display_visual** (na chamada `tool()`):

```typescript
tool(
  "display_visual",
  "Specialized data or flow visualization. Actions: chart (bar/line/pie/area/donut graph), map (map with pins), code (block with syntax highlighting), progress (progress bar with steps), steps (timeline/checklist), react (live React component with Framer Motion).",
  visualSchema,
  echoHandler,
),
```

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `DisplayReactSchema.parse({ version: "1", code: "...", imports: [{ module: "react", symbols: ["useState"] }] })` | Sucesso, `language` default "jsx", `entry` default "default" |
| `DisplayReactSchema.parse({ version: "2", code: "...", imports: [] })` | Zod error (version must be "1") |
| `DisplayReactSchema.parse({ version: "1", code: "...", imports: [{ module: "lodash", symbols: ["debounce"] }] })` | Zod error (module not in enum) |
| `DisplayReactSchema.parse({ version: "1", code: "...", imports: [{ module: "react", symbols: [] }] })` | Zod error (symbols min 1) |
| `visualSchema.parse({ action: "react", version: "1", code: "...", imports: [...] })` | Sucesso |
| `visualSchema.parse({ action: "react" })` | Zod error (code required, imports required) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-115 | displayReactSchema | `DisplayReactSchema` em `schemas.ts` com version, title, description, code, language, entry, imports, initialProps, layout, theme + tipo `DisplayReact` |
| F-116 | visualSchemaReact | Action `react` no `visualSchema` de `tools.ts` + import + descricao atualizada |

## Limites

- NAO alterar `src/display/prompt.ts` — system prompt React e escopo de PRP-047
- NAO alterar `src/types/options.ts` — flag `reactOutput` e escopo de PRP-047
- NAO alterar `src/query.ts` — integracao e escopo de PRP-047
- NAO alterar `src/display/index.ts` — reexports sao escopo de PRP-048
- NAO alterar `src/index.ts` — exports publicos sao escopo de PRP-048
- NAO adicionar `DisplayReactSchema` ao `DisplayToolRegistry` — action vive dentro de `display_visual`, nao como tool separada
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs deste sprint. `src/display/` ja existe (PRP-040, sprint-12). **Bloqueante para PRP-047** (prompt e flag dependem do schema existir) e **PRP-048** (exports dependem do schema).
