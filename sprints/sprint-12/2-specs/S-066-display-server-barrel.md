# openclaude-sdk - Modulo Display: MCP Server + Barrel

Criar `createDisplayMcpServer()` que monta o MCP server com as 4 meta-tools, e o barrel `index.ts` do modulo display.

---

## Objetivo

Resolver D-073 (score 8) e D-075 (score 7): implementar `src/display/server.ts` com a funcao que retorna `McpSdkServerConfig` pronto para merge, e `src/display/index.ts` como barrel que reexporta tudo do modulo.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-073 | `createDisplayMcpServer()` via `createSdkMcpServer()` com 4 meta-tools |
| 2 | D-075 | Barrel `src/display/index.ts` reexportando schemas, tools, server, prompt |

**Dependencia**: S-064 (schemas), S-065 (tools + prompt).

---

## Estado Atual

- `createSdkMcpServer()` em `src/mcp.ts` ja implementado — aceita `{ name, version?, tools? }` e retorna `Promise<McpSdkServerConfig>`
- `src/display/server.ts` e `src/display/index.ts` nao existem

---

## Implementacao

### 1. Criar `src/display/server.ts`

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

**Comportamento**: funcao async que cria um `McpServer` in-process com as 4 meta-tools registradas. O retorno e `McpSdkServerConfig` — pronto para inserir em `options.mcpServers["display"]`.

### 2. Criar `src/display/index.ts`

Barrel que reexporta tudo do modulo display:

```typescript
// Schemas Zod
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
} from "./schemas.js"

// Tools
export { createDisplayTools } from "./tools.js"

// Server
export { createDisplayMcpServer } from "./server.js"

// Prompt
export { DISPLAY_SYSTEM_PROMPT } from "./prompt.js"
```

---

## Criterios de Aceite

- [ ] `src/display/server.ts` existe com `createDisplayMcpServer()` exportado
- [ ] `createDisplayMcpServer()` retorna `Promise<McpSdkServerConfig>` via `createSdkMcpServer()`
- [ ] Server e criado com `name: "display"` e as 4 meta-tools
- [ ] `src/display/index.ts` existe reexportando todos os simbolos publicos do modulo
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/display/server.ts` | S-066 |
| `createDisplayMcpServer()` | S-066 |
| `src/display/index.ts` | S-066 |
| Discovery | D-073, D-075 |
