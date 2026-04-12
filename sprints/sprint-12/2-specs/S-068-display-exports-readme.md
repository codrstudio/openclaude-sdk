# openclaude-sdk - Exports Publicos de Display + README

Adicionar reexports de display no barrel principal `src/index.ts` e documentar a feature "Rich Output" no README.

---

## Objetivo

Resolver D-079 (score 7) e D-080 (score 6): expor os 19 schemas, 19 tipos, `DisplayToolRegistry` e `DisplayToolName` no barrel publico, e atualizar o README com secao dedicada incluindo tabela das 4 meta-tools e exemplo end-to-end.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-079 | Reexportar simbolos de `./display/index.js` em `src/index.ts` |
| 2 | D-080 | Secao "Rich Output" no `README.md` |

**Dependencia**: S-066 (barrel do modulo display).

---

## Estado Atual

**Arquivo**: `src/index.ts` — nao tem nenhum import/export de `./display/`

**Arquivo**: `README.md` — nao tem secao sobre rich output

---

## Implementacao

### 1. Adicionar exports em `src/index.ts`

**Antes** (final do arquivo, linha 213):

```typescript
} from "./session-v2.js"
```

**Depois** — adicionar bloco apos V2 Session API:

```typescript
// ---------------------------------------------------------------------------
// Display — Rich Output
// ---------------------------------------------------------------------------

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
  DisplayToolName,
} from "./display/index.js"
```

### 2. Adicionar secao "Rich Output" no README.md

Inserir apos a ultima secao de features existente. Conteudo:

```markdown
## Rich Output

Optional built-in that registers 4 display MCP tools for structured visual content.
Enable with `richOutput: true` — zero overhead when disabled.

### Display Tools

| Tool | Actions | Purpose |
|------|---------|---------|
| `display_highlight` | `metric`, `price`, `alert`, `choices` | Highlight important information |
| `display_collection` | `table`, `spreadsheet`, `comparison`, `carousel`, `gallery`, `sources` | Organized collection of items |
| `display_card` | `product`, `link`, `file`, `image` | Individual item with visual details |
| `display_visual` | `chart`, `map`, `code`, `progress`, `steps` | Specialized data visualization |

### Example

‍```typescript
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
        // Client renders as interactive widget
      } else if (block.type === "text") {
        console.log(block.text)
      }
    }
  }
}
‍```

Each display tool takes an `action` field that selects the content type.
The client (e.g., openclaude-chat) detects `block.name.startsWith("display_")`
and dispatches to the appropriate renderer using `block.input`.

Schemas are exported for client-side validation:

‍```typescript
import { DisplayToolRegistry } from "openclaude-sdk"

const schema = DisplayToolRegistry[block.name]
const parsed = schema.parse(block.input)
‍```
```

---

## Criterios de Aceite

- [ ] `src/index.ts` reexporta 19 schemas, 19 tipos, `DisplayToolRegistry`, `DisplayToolName`
- [ ] Imports usam `"./display/index.js"` (ESM com extensao)
- [ ] README tem secao "Rich Output" com descricao, tabela das 4 tools e exemplo end-to-end
- [ ] Exemplo mostra `richOutput: true`, iteracao sobre mensagens e deteccao de `display_*`
- [ ] README mostra uso de `DisplayToolRegistry` para validacao client-side
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/index.ts` (exports display) | S-068 |
| `README.md` (secao Rich Output) | S-068 |
| Discovery | D-079, D-080 |
