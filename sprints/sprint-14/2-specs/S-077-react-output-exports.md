# openclaude-sdk - Exports de DisplayReactSchema, DisplayReact e REACT_OUTPUT_SYSTEM_PROMPT

Spec dos re-exports nos barrels `display/index.ts` e `src/index.ts` para os novos artefatos React.

---

## Objetivo

Resolve D-099 e D-100.

| Problema | Consequencia |
|----------|-------------|
| `display/index.ts` nao exporta `DisplayReactSchema`, `DisplayReact` nem `REACT_OUTPUT_SYSTEM_PROMPT` | Modulo display incompleto; `query.ts` nao consegue importar via barrel |
| `src/index.ts` nao exporta `DisplayReactSchema` nem `DisplayReact` | Consumidores do SDK nao conseguem tipar o payload React recebido no `tool_use.input` |

---

## Estado Atual

### `src/display/index.ts`

```typescript
export {
  DisplayMetricSchema,
  // ... 18 schemas ...
  DisplayChoicesSchema,
  DisplayToolRegistry,
} from "./schemas.js"

export type {
  DisplayToolName,
  DisplayMetric,
  // ... 18 tipos ...
  DisplayChoices,
} from "./schemas.js"

export { createDisplayTools } from "./tools.js"
export { DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } from "./prompt.js"
export { createDisplayMcpServer } from "./server.js"
```

Sem `DisplayReactSchema`, `DisplayReact` ou `REACT_OUTPUT_SYSTEM_PROMPT`.

### `src/index.ts` (linhas 205-249)

Exporta 19 schemas e 19 tipos de `./display/index.js`. Sem `DisplayReactSchema` ou `DisplayReact`.

---

## Implementacao

### 1. `src/display/index.ts`

Adicionar aos blocos existentes:

```typescript
export {
  DisplayMetricSchema,
  // ... existentes ...
  DisplayChoicesSchema,
  DisplayReactSchema,        // NEW
  DisplayToolRegistry,
} from "./schemas.js"

export type {
  DisplayToolName,
  DisplayMetric,
  // ... existentes ...
  DisplayChoices,
  DisplayReact,              // NEW
} from "./schemas.js"

export { DISPLAY_SYSTEM_PROMPT, REACT_OUTPUT_SYSTEM_PROMPT, mergeSystemPromptAppend } from "./prompt.js"
//                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^ NEW
```

### 2. `src/index.ts`

Adicionar na secao "Display — Rich Output":

```typescript
export {
  // ... existentes ...
  DisplayChoicesSchema,
  DisplayReactSchema,        // NEW
  DisplayToolRegistry,
} from "./display/index.js"

export type {
  // ... existentes ...
  DisplayChoices,
  DisplayReact,              // NEW
  DisplayToolName,
} from "./display/index.js"
```

### 3. O que NAO exportar publicamente

- `REACT_OUTPUT_SYSTEM_PROMPT` — constante interna do SDK, usada apenas por `query.ts`. Nao ha caso de uso para consumidores. Exportar via `display/index.ts` (para import interno de `query.ts`) mas **nao** de `src/index.ts`.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/display/index.ts` | L1-2 (schemas export), L24-25 (types export), L49 (prompt export) | + `DisplayReactSchema`, + `DisplayReact`, + `REACT_OUTPUT_SYSTEM_PROMPT` |
| `src/index.ts` | L205-226 (schemas export), L228-249 (types export) | + `DisplayReactSchema`, + `DisplayReact` |

---

## Criterios de Aceite

- [ ] `DisplayReactSchema` exportado de `src/display/index.ts`
- [ ] `DisplayReact` tipo exportado de `src/display/index.ts`
- [ ] `REACT_OUTPUT_SYSTEM_PROMPT` exportado de `src/display/index.ts`
- [ ] `DisplayReactSchema` re-exportado de `src/index.ts`
- [ ] `DisplayReact` tipo re-exportado de `src/index.ts`
- [ ] `REACT_OUTPUT_SYSTEM_PROMPT` **nao** re-exportado de `src/index.ts` (interno)
- [ ] `import { DisplayReactSchema, REACT_OUTPUT_SYSTEM_PROMPT } from "./display/index.js"` funciona em `query.ts`
- [ ] `tsc --noEmit` passa
- [ ] `tsup` builda sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `display/index.ts` barrel exports | S-077 |
| `src/index.ts` public exports | S-077 |
| D-099 | S-077 |
| D-100 | S-077 |
