# PRP-048 — React Output: Exports + README + Demo + Build Validation

## Objetivo

Reexportar `DisplayReactSchema`, `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT` nos barrels, documentar React Rich Output no README, atualizar o demo endpoint e validar typecheck/build.

Referencia: specs S-077 (D-099, D-100), S-078 (D-101, D-102, D-103).

## Execution Mode

`implementar`

## Contexto

O schema (PRP-046), prompt e flag (PRP-047) ja estao implementados. Faltam:

1. **Barrel exports** — `src/display/index.ts` precisa reexportar `DisplayReactSchema`, `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT`. `src/index.ts` precisa reexportar `DisplayReactSchema` e `DisplayReact` publicamente.
2. **README** — secao "React Rich Output" com tabela de gate, exemplo end-to-end, pipeline obrigatorio do cliente e nota de seguranca.
3. **Demo** — endpoint `GET /display` em `.tmp/demo/server.mjs` precisa listar action `react` em `display_visual`.
4. **Build validation** — `tsc --noEmit` e `tsup` devem passar sem erro.

**Referencia**: `src/display/index.ts` (PRP-040, sprint-12):

```typescript
export { DisplayMetricSchema, ..., DisplayChoicesSchema, DisplayToolRegistry } from "./schemas.js"
export type { DisplayToolName, ..., DisplayChoices } from "./schemas.js"
export { createDisplayTools } from "./tools.js"
export { DISPLAY_SYSTEM_PROMPT } from "./prompt.js"
export { createDisplayMcpServer } from "./server.js"
```

**Referencia**: `src/index.ts` ja tem blocos de exports display (PRP-041) e ask-user (PRP-045).

## Especificacao

### Feature F-120 — Barrel exports em src/display/index.ts

Adicionar aos blocos existentes:

**No bloco de schemas:**

```typescript
export {
  // ... existentes ...
  DisplayChoicesSchema,
  DisplayReactSchema,
  DisplayToolRegistry,
} from "./schemas.js"
```

**No bloco de tipos:**

```typescript
export type {
  // ... existentes ...
  DisplayChoices,
  DisplayReact,
} from "./schemas.js"
```

**No export de prompt:**

```typescript
export { DISPLAY_SYSTEM_PROMPT, REACT_OUTPUT_SYSTEM_PROMPT, mergeSystemPromptAppend } from "./prompt.js"
```

Regras:
- `DisplayReactSchema` e `DisplayReact` adicionados nos blocos existentes (nao criar blocos novos)
- `REACT_OUTPUT_SYSTEM_PROMPT` adicionado ao export de `prompt.js` existente
- Extensao `.js` nos imports (ESM)

### Feature F-121 — Exports publicos em src/index.ts

Na secao "Display — Rich Output", adicionar:

**No bloco de schemas:**

```typescript
export {
  // ... existentes ...
  DisplayChoicesSchema,
  DisplayReactSchema,
  DisplayToolRegistry,
} from "./display/index.js"
```

**No bloco de tipos:**

```typescript
export type {
  // ... existentes ...
  DisplayChoices,
  DisplayReact,
  DisplayToolName,
} from "./display/index.js"
```

Regras:
- Apenas `DisplayReactSchema` e `DisplayReact` — **NAO** exportar `REACT_OUTPUT_SYSTEM_PROMPT` publicamente (interno ao SDK, usado apenas por `query.ts`)
- Usar `export type` para tree-shaking correto

### Feature F-122 — README secao React Rich Output

Inserir apos a secao "Rich Output" existente no README.md:

````markdown
### React Rich Output

For visually rich responses (dashboards, animated explainers, interactive
layouts), enable both `richOutput` and `reactOutput`:

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Build an animated dashboard with 4 sales KPIs",
  options: {
    richOutput: true,
    reactOutput: true,
  },
})

for await (const msg of q) {
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "tool_use" && block.name === "display_visual") {
        const input = block.input as { action: string }
        if (input.action === "react") {
          // input contains: version, code, language, imports, initialProps, layout, theme
          renderReactPayload(input) // your host implementation
        }
      }
    }
  }
}
```

**Flag gate:**

| `richOutput` | `reactOutput` | Result |
|---|---|---|
| `false` | any | Nothing injected (zero overhead) |
| `true` | `false` / absent | Display tools without React action |
| `true` | `true` | Display tools **with** React component support |

> `reactOutput: true` without `richOutput: true` is silently ignored.

#### Rendering React Payloads

The SDK transmits — it does **not** render. Your host app must follow this
pipeline:

1. **VALIDATE** — `version === "1"`, all `imports[].module` in whitelist
   (`react` | `framer-motion`), `code` imports match `imports` array,
   `code.length <= 8192`, `JSON.stringify(initialProps).length <= 32768`
2. **TRANSPILE** — Babel standalone with preset `["react"]` (+ `"typescript"`
   if `language === "tsx"`), or sucrase with transforms `["jsx", "typescript"]`
3. **SANDBOX** — Render inside `<iframe sandbox="allow-scripts">` on a
   distinct origin, OR a shadow DOM with strict scope. **Never eval LLM code
   on the main document origin with access to user data.**
4. **INJECT SCOPE** — Provide only `React` and `framer-motion` as module
   resolver. Any other import must throw at resolve time.
5. **RENDER** — Mount as `<Component {...initialProps} />` inside an error
   boundary. Wrap in `<MotionConfig reducedMotion="user">`.
6. **THEME** — If `theme` is set, expose CSS variables (`--fg`, `--bg`,
   `--accent`, `--muted`) on the host container before mounting.

> **Security**: Step 3 (sandbox) is mandatory. Hosts that skip it expose users
> to arbitrary code execution from LLM output.
````

Regras:
- Secao posicionada logo apos "Rich Output", antes de "Ask User"
- Exemplo end-to-end completo com deteccao de `action === "react"`
- Pipeline de 6 passos normativo (validate, transpile, sandbox, inject scope, render, theme)
- Nota de seguranca sobre sandbox obrigatorio

### Feature F-123 — Demo endpoint GET /display

Em `.tmp/demo/server.mjs`, na listagem de `display_visual`, adicionar `react` as actions disponiveis:

```javascript
// Na secao que lista display_visual actions:
actions: ["chart", "map", "code", "progress", "steps", "react"],
```

Regra: localizar onde `display_visual` e listado e adicionar `"react"` ao array de actions.

### Feature F-124 — Build validation

Apos todos os deltas implementados, executar:

```bash
npx tsc --noEmit    # typecheck
npx tsup            # build
```

Ambos devem passar sem erro. Se houver falhas:
- Exhaustiveness check em switch/case sobre `visualSchema` actions → adicionar case `"react"`
- Import circular → verificar que `display/index.ts` nao importa de `query.ts`
- Tipo incompativel → verificar que `DisplayReactSchema.shape` e compativel com `z.object()` spread

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `import { DisplayReactSchema } from "openclaude-sdk"` | Erro | Funciona |
| `import type { DisplayReact } from "openclaude-sdk"` | Erro | Funciona |
| `import { REACT_OUTPUT_SYSTEM_PROMPT } from "openclaude-sdk"` | Erro | Erro (intencional — interno) |
| `import { REACT_OUTPUT_SYSTEM_PROMPT } from "./display/index.js"` (interno) | Erro | Funciona |
| `GET /display` no demo | 5 actions em visual | 6 actions em visual (inclui react) |
| `tsc --noEmit` | Passa | Passa |
| `tsup` | Passa | Passa |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-120 | displayBarrelReact | `DisplayReactSchema`, `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT` exportados de `display/index.ts` |
| F-121 | publicExportsReact | `DisplayReactSchema` e `DisplayReact` reexportados de `src/index.ts` (publicos) |
| F-122 | readmeReactOutput | Secao "React Rich Output" no README com tabela de gate, exemplo, pipeline cliente, nota de seguranca |
| F-123 | demoReactAction | Action `react` listada em `GET /display` do demo server |
| F-124 | buildValidation | `tsc --noEmit` e `tsup` passam sem erro apos todos os deltas |

## Limites

- NAO alterar `src/display/schemas.ts` — escopo de PRP-046
- NAO alterar `src/display/tools.ts` — escopo de PRP-046
- NAO alterar `src/display/prompt.ts` — escopo de PRP-047
- NAO alterar `src/types/options.ts` — escopo de PRP-047
- NAO alterar `src/query.ts` — escopo de PRP-047
- NAO exportar `REACT_OUTPUT_SYSTEM_PROMPT` de `src/index.ts` — constante interna ao SDK
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO implementar renderizacao React no SDK — responsabilidade do host

## Dependencias

Depende de **PRP-046** (schema e action existem) e **PRP-047** (prompt, flag e integracao existem). Nenhum PRP depende deste — e o ultimo da cadeia.
