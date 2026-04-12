# PRP-041 — richOutput Integration + Public Exports + README

## Objetivo

Adicionar `richOutput?: boolean` a `Options`, integrar em `query()` com merge de MCP server + system prompt, exportar schemas/tipos do barrel publico e documentar no README.

Referencia: specs S-067 (D-076, D-077, D-078), S-068 (D-079, D-080).

## Execution Mode

`implementar`

## Contexto

O modulo `src/display/` (PRP-040) expoe `createDisplayMcpServer()`, `DISPLAY_SYSTEM_PROMPT` e todos os schemas/tipos. Falta:

1. **Flag na Options** — `richOutput?: boolean` em `src/types/options.ts` (linha 268-317, interface `Options`). Atualmente o campo nao existe.

2. **Integracao em query()** — `src/query.ts` monta `optionsForCli` no `lifecycleGenerator()` (linha 207). O hook de richOutput deve ocorrer **antes** de `startSdkServers()` (linha 212) para que o display server seja incluido no startup.

3. **System prompt merge** — `Options.systemPrompt` aceita 3 formatos (linha 310-312):
   - `undefined`
   - `string`
   - `{ type: "preset"; preset: "claude_code"; append?: string }`

4. **Exports publicos** — `src/index.ts` (213 linhas) precisa reexportar os 19 schemas, 19 tipos, `DisplayToolRegistry` e `DisplayToolName`.

5. **README** — secao "Rich Output" com tabela das 4 tools e exemplo end-to-end.

## Especificacao

### Feature F-099 — Options.richOutput

**1. Adicionar campo em `src/types/options.ts`, interface Options (apos linha 303, apos `plugins`):**

Estado atual (linhas 303-304):
```typescript
  plugins?: SdkPluginConfig[]
  promptSuggestions?: boolean
```

Novo:
```typescript
  plugins?: SdkPluginConfig[]
  promptSuggestions?: boolean
  richOutput?: boolean
```

Nenhuma outra mudanca no arquivo.

### Feature F-100 — mergeSystemPromptAppend()

**1. Adicionar funcao em `src/display/prompt.ts` (apos DISPLAY_SYSTEM_PROMPT):**

```typescript
export function mergeSystemPromptAppend(
  existing: Options["systemPrompt"],
  append: string,
): NonNullable<Options["systemPrompt"]> {
  if (existing == null) {
    return { type: "preset", preset: "claude_code", append }
  }
  if (typeof existing === "string") {
    return existing + "\n\n" + append
  }
  return {
    ...existing,
    append: existing.append ? existing.append + "\n\n" + append : append,
  }
}
```

**2. Adicionar import do tipo Options no arquivo:**

```typescript
import type { Options } from "../types/options.js"
```

**3. Atualizar barrel `src/display/index.ts` para incluir `mergeSystemPromptAppend`:**

Adicionar na linha de export de prompt.ts:
```typescript
export { DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } from "./prompt.js"
```

Os 3 formatos cobertos:

| systemPrompt existente | Resultado |
|------------------------|-----------|
| `undefined` | `{ type: "preset", preset: "claude_code", append: DISPLAY_SYSTEM_PROMPT }` |
| `"Custom prompt"` | `"Custom prompt\n\nYou have access to display tools..."` |
| `{ type: "preset", preset: "claude_code" }` | `{ type: "preset", preset: "claude_code", append: DISPLAY_SYSTEM_PROMPT }` |
| `{ type: "preset", preset: "claude_code", append: "Be concise" }` | `{ type: "preset", preset: "claude_code", append: "Be concise\n\nYou have access to display tools..." }` |

### Feature F-101 — Integracao em query.ts

**1. Alterar `lifecycleGenerator()` em `src/query.ts` (linhas 207-227):**

Estado atual:
```typescript
  async function* lifecycleGenerator(): AsyncGenerator<SDKMessage, void> {
    try {
      // Start SDK servers and build a local copy with _localPort injected (never mutate the original)
      let optionsForCli = resolvedOptions
      if (resolvedOptions.mcpServers) {
```

Novo:
```typescript
  async function* lifecycleGenerator(): AsyncGenerator<SDKMessage, void> {
    try {
      let optionsForCli = resolvedOptions

      if (optionsForCli.richOutput) {
        const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
          await import("./display/index.js")
        const displayServer = await createDisplayMcpServer()
        const existingServers = optionsForCli.mcpServers ?? {}
        if ("display" in existingServers) {
          console.warn('[openclaude-sdk] richOutput: overriding existing "display" MCP server')
        }
        optionsForCli = {
          ...optionsForCli,
          mcpServers: { ...existingServers, display: displayServer },
          systemPrompt: mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT),
        }
      }

      // Start SDK servers and build a local copy with _localPort injected (never mutate the original)
      if (optionsForCli.mcpServers) {
```

Mudancas:
- Dynamic import de `./display/index.js` — zero overhead quando `richOutput` e falsy (modulo nao e carregado)
- `createDisplayMcpServer()` e async — await necessario
- Merge em `mcpServers` preserva servers existentes do usuario
- Warn se chave `"display"` ja existe (override intencional)
- Ocorre **antes** de `startSdkServers()` para que o display server entre no startup
- `optionsForCli` (nao `resolvedOptions`) e reatribuido — `resolvedOptions` permanece imutavel

**2. Ajustar referencia a `resolvedOptions.mcpServers` (linha 211-212):**

Estado atual:
```typescript
      if (resolvedOptions.mcpServers) {
        const { running, portMap } = await startSdkServers(resolvedOptions.mcpServers)
```

Novo:
```typescript
      if (optionsForCli.mcpServers) {
        const { running, portMap } = await startSdkServers(optionsForCli.mcpServers)
```

E o loop interno (linhas 217-224):
```typescript
          for (const [name, config] of Object.entries(optionsForCli.mcpServers)) {
```

E o final do bloco (linha 225):
```typescript
          optionsForCli = { ...optionsForCli, mcpServers: patchedServers }
```

**Nota**: a variavel `optionsForCli` ja era `let` (linha 210), portanto reatribuicao e permitida. A mudanca de `resolvedOptions` para `optionsForCli` nas linhas 211-225 garante que os servers do display sao incluidos no startup.

### Feature F-102 — Exports publicos em src/index.ts

**1. Adicionar bloco de exports apos a secao de MCP tool factories (apos linha 11):**

```typescript
// Display — rich output schemas & types
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
} from "./display/index.js"
```

### Feature F-103 — README secao Rich Output

**1. Adicionar secao "Rich Output" no README.md**, apos a secao de MCP Servers e antes de Error Handling (posicao logica):

```markdown
## Rich Output

Enable rich visual output by setting `richOutput: true`. The SDK registers 4 display tools as an in-process MCP server that the model can invoke to emit structured visual content (charts, tables, products, metrics, etc.).

When `richOutput` is disabled (default), there is zero overhead — no MCP server is created and the system prompt is not modified.

### Display Tools

| Tool | Actions | Purpose |
|------|---------|---------|
| `display_highlight` | `metric`, `price`, `alert`, `choices` | Highlight important information |
| `display_collection` | `table`, `spreadsheet`, `comparison`, `carousel`, `gallery`, `sources` | Organized collection of items |
| `display_card` | `product`, `link`, `file`, `image` | Individual item with visual details |
| `display_visual` | `chart`, `map`, `code`, `progress`, `steps` | Specialized data visualization |

### Usage

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
        // Client renders as interactive widget
      } else if (block.type === "text") {
        console.log(block.text)
      }
    }
  }
}
```

### Client-Side Validation

Use `DisplayToolRegistry` to validate `tool_use` inputs on the client:

```typescript
import { DisplayToolRegistry } from "openclaude-sdk"

// Given a tool_use block from the stream:
const schema = DisplayToolRegistry[block.name as keyof typeof DisplayToolRegistry]
if (schema) {
  const parsed = schema.safeParse(block.input)
  if (parsed.success) {
    renderWidget(block.name, parsed.data)
  }
}
```
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `query({ prompt: "...", options: {} })` | Funciona | Funciona (identico, zero overhead) |
| `query({ prompt: "...", options: { richOutput: false } })` | Erro de tipo | Funciona, zero overhead |
| `query({ prompt: "...", options: { richOutput: true } })` | Erro de tipo | Display server + system prompt injetados |
| `query({ ..., options: { richOutput: true, mcpServers: { my: ... } } })` | N/A | Ambos servers registrados (my + display) |
| `query({ ..., options: { richOutput: true, mcpServers: { display: ... } } })` | N/A | Warn + override do display existente |
| `query({ ..., options: { richOutput: true, systemPrompt: undefined } })` | N/A | `{ type: "preset", preset: "claude_code", append: DISPLAY_PROMPT }` |
| `query({ ..., options: { richOutput: true, systemPrompt: "Custom" } })` | N/A | `"Custom\n\n<display prompt>"` |
| `query({ ..., options: { richOutput: true, systemPrompt: { type: "preset", preset: "claude_code", append: "X" } } })` | N/A | `{ type: "preset", preset: "claude_code", append: "X\n\n<display prompt>" }` |
| `import { DisplayMetricSchema } from "openclaude-sdk"` | Erro | Funciona |
| `import type { DisplayMetric } from "openclaude-sdk"` | Erro | Funciona |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-099 | richOutputFlag | `richOutput?: boolean` na interface `Options` |
| F-100 | mergeSystemPromptAppend | Funcao util que cobre 3 formatos de `systemPrompt` (undefined, string, preset) |
| F-101 | queryRichOutputIntegration | Hook em `lifecycleGenerator()` que injeta display server + system prompt quando `richOutput: true` |
| F-102 | displayPublicExports | 19 schemas, 19 tipos, `DisplayToolRegistry`, `DisplayToolName` exportados de `src/index.ts` |
| F-103 | readmeRichOutput | Secao "Rich Output" no README com tabela de tools, exemplo end-to-end e validacao client-side |

## Limites

- NAO alterar `src/display/schemas.ts`, `src/display/tools.ts`, `src/display/server.ts` — sao escopo de PRP-040
- NAO alterar `src/mcp.ts` — escopo de PRP-039
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO implementar renderizacao de widgets — responsabilidade do openclaude-chat
- NAO deprecar `@codrstudio/openclaude-sdk` — task separada fora do escopo
- NAO alterar `src/process.ts` (`buildCliArgs`) — system prompt ja e mapeado la

## Dependencias

Depende de **PRP-040** (modulo display precisa existir para imports e exports).
