# PRP-047 — REACT_OUTPUT_SYSTEM_PROMPT + reactOutput flag + query.ts integration

## Objetivo

Criar `REACT_OUTPUT_SYSTEM_PROMPT` em `src/display/prompt.ts`, adicionar `reactOutput?: boolean` a `Options` e integrar o segundo `mergeSystemPromptAppend` em `query.ts` com gate aninhado dentro de `richOutput`.

Referencia: specs S-075 (D-098), S-076 (D-094, D-097).

## Execution Mode

`implementar`

## Contexto

O schema `DisplayReactSchema` e a action `react` no `visualSchema` ja existem (PRP-046). O modelo pode invocar `display_visual` com `action: "react"`, mas sem instrucoes no system prompt nao sabe quando nem como usa-lo. Alem disso, nao ha flag para o consumidor ativar o canal React.

**Arquivo**: `src/display/prompt.ts` (37 linhas)

```typescript
export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools...`

export function mergeSystemPromptAppend(existing, append) { ... }
```

**Arquivo**: `src/types/options.ts`, interface `Options` (linhas 307-309)

```typescript
richOutput?: boolean
askUser?: boolean
askUserTimeoutMs?: number
```

**Arquivo**: `src/query.ts`, bloco richOutput (linhas 212-227)

```typescript
if (optionsForCli.richOutput) {
  const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
    await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()
  // ... merge em mcpServers e systemPrompt
}
```

## Especificacao

### Feature F-117 — REACT_OUTPUT_SYSTEM_PROMPT em src/display/prompt.ts

Adicionar apos `DISPLAY_SYSTEM_PROMPT` (e antes de `mergeSystemPromptAppend`):

```typescript
export const REACT_OUTPUT_SYSTEM_PROMPT = `You may also emit a \`react\` action via display_visual to render a live React \
component (useful for dashboards, animated explainers, interactive layouts). \
Use it ONLY when motion, interactivity, or custom layout genuinely helps — \
for simple metrics, tables, or charts, prefer the existing actions.

MODULE SHAPE
- Must be a valid ES module with exactly one \
\`export default function Component(props) { ... }\`.
- No top-level side effects. No \`fetch\`, no \`localStorage\`, no \`window.*\` \
access, no timers outside \`useEffect\`. No async components.

IMPORTS (strict whitelist)
- react: useState, useEffect, useMemo, useRef, useCallback, useReducer, \
Fragment
- framer-motion: motion, AnimatePresence, MotionConfig, useAnimate, useInView, \
useScroll, useTransform, useMotionValue, useSpring
- Every import used in \`code\` MUST appear in the payload's \`imports\` array, \
matching the actual source. Mismatches are rejected by the client.
- Do not import anything else. No icon libraries, no UI kits, no CSS files.

STYLING
- Use inline \`style={{...}}\` objects only. No Tailwind classes, no className \
strings referring to external CSS, no <style> tags.
- When \`theme\` is set, prefer CSS variables var(--fg), var(--bg), var(--accent), \
var(--muted) — the host provides them.
- Typography: system font stack.

DATA
- Do NOT hardcode large datasets in JSX. Put them in \`initialProps\` and read \
via \`props.data\` in the component.
- Keep \`code\` under 8 KB. Keep \`initialProps\` under 32 KB serialized.

ANIMATION
- Prefer framer-motion primitives: <motion.div>, AnimatePresence, layout \
animations.
- Default to polished motion: spring transitions, staggered children, \
enter/exit animations, subtle hover states.

LAYOUT
- Component must be self-contained within \`layout\` dimensions. No fixed \
positioning that escapes the container.
- Declare \`layout.height\` or \`layout.aspectRatio\` so the host reserves space.`
```

Regras:
- Texto em ingles (e system prompt para o modelo)
- 6 secoes normativas: MODULE SHAPE, IMPORTS, STYLING, DATA, ANIMATION, LAYOUT
- Whitelist estrita: `react` (7 symbols) + `framer-motion` (9 symbols)
- Instrui a usar `react` **somente** quando motion/interatividade ajuda — preferir actions existentes para dados simples

### Feature F-118 — Options.reactOutput em src/types/options.ts

Na interface `Options`, adicionar logo apos `richOutput`:

```typescript
richOutput?: boolean
reactOutput?: boolean
askUser?: boolean
askUserTimeoutMs?: number
```

Regras:
- `reactOutput` default `false` (omitido = desligado)
- So tem efeito quando `richOutput` tambem e `true`
- Zero overhead quando ausente

### Feature F-119 — Integracao em query.ts

Alterar o bloco `if (optionsForCli.richOutput)` em `lifecycleGenerator()`:

```typescript
if (optionsForCli.richOutput) {
  const {
    createDisplayMcpServer,
    DISPLAY_SYSTEM_PROMPT,
    REACT_OUTPUT_SYSTEM_PROMPT,
    mergeSystemPromptAppend,
  } = await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("display" in existingServers) {
    console.warn("[openclaude-sdk] mcpServers already has a 'display' key — overriding with built-in display server")
  }

  let mergedPrompt = mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT)

  if (optionsForCli.reactOutput) {
    mergedPrompt = mergeSystemPromptAppend(mergedPrompt, REACT_OUTPUT_SYSTEM_PROMPT)
  }

  optionsForCli = {
    ...optionsForCli,
    mcpServers: { ...existingServers, display: displayServer },
    systemPrompt: mergedPrompt,
  }
}
```

Mudancas pontuais:
1. Import destrutured ganha `REACT_OUTPUT_SYSTEM_PROMPT`
2. `const mergedPrompt` vira `let mergedPrompt`
3. Novo `if (optionsForCli.reactOutput)` faz segundo append
4. Atribuicao final usa `mergedPrompt` em vez de chamada inline

### Comportamento de gate

| `richOutput` | `reactOutput` | Resultado |
|---|---|---|
| `false` / ausente | qualquer | Nada injetado (zero overhead) |
| `true` | `false` / ausente | Display tools ativadas **sem** prompt React |
| `true` | `true` | Display tools ativadas **com** prompt React (ambos blocos concatenados) |

**`reactOutput: true` sem `richOutput: true` e ignorado em silencio** — o `if (optionsForCli.richOutput)` externo ja cuida disso. Sem warn, sem erro, sem injecao.

### Schema no MCP server permanece estatico

A action `react` **sempre** existe no `visualSchema` do MCP server `display` — independente de `reactOutput`. O que muda e apenas o system prompt. Isso simplifica tipos e evita variantes do server.

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `query({ prompt: "...", options: {} })` | Zero overhead, nenhum server/prompt injetado |
| `query({ prompt: "...", options: { richOutput: true } })` | Display tools + `DISPLAY_SYSTEM_PROMPT`. Sem prompt React |
| `query({ prompt: "...", options: { richOutput: true, reactOutput: true } })` | Display tools + `DISPLAY_SYSTEM_PROMPT` + `REACT_OUTPUT_SYSTEM_PROMPT` |
| `query({ prompt: "...", options: { reactOutput: true } })` | Nada injetado (gate silencioso) |
| `query({ prompt: "...", options: { richOutput: true, reactOutput: true, askUser: true } })` | Display + React + Ask User (ortogonais) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-117 | reactOutputSystemPrompt | `REACT_OUTPUT_SYSTEM_PROMPT` em `prompt.ts` com 6 secoes normativas (module shape, imports, styling, data, animation, layout) |
| F-118 | reactOutputFlag | `reactOutput?: boolean` na interface `Options` em `options.ts` |
| F-119 | reactOutputQueryIntegration | Segundo `mergeSystemPromptAppend` condicional em `query.ts` dentro do bloco `richOutput` |

## Limites

- NAO alterar `src/display/schemas.ts` — escopo de PRP-046
- NAO alterar `src/display/tools.ts` — escopo de PRP-046
- NAO alterar `src/display/index.ts` — reexports sao escopo de PRP-048
- NAO alterar `src/index.ts` — exports publicos sao escopo de PRP-048
- NAO alterar `README.md` — documentacao e escopo de PRP-048
- NAO adicionar warn quando `reactOutput: true` sem `richOutput: true` — gate silencioso por design
- NAO remover/condicionar a action `react` do schema MCP em runtime — schema e estatico
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Depende de **PRP-046** (`DisplayReactSchema` deve existir para o `visualSchema` ter a action `react`, e `REACT_OUTPUT_SYSTEM_PROMPT` referencia conceitos do schema). **Bloqueante para PRP-048** (exports e README dependem do prompt e flag existirem).
