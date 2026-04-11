# openclaude-sdk - REACT_OUTPUT_SYSTEM_PROMPT

Spec da constante de system prompt que instrui o modelo sobre como emitir componentes React via `display_visual` action `react`.

---

## Objetivo

Resolve D-098.

| Problema | Consequencia |
|----------|-------------|
| Sem instrucao explicita, o modelo produz JSX com imports invalidos, Tailwind classes ou fetch calls | Payload rejeitado pelo cliente; experiencia quebrada |
| `DISPLAY_SYSTEM_PROMPT` existente nao menciona `react` nem regras de sandbox | Modelo nao sabe quando usar a action nem quais restricoes seguir |

---

## Estado Atual

### `src/display/prompt.ts`

```typescript
export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools...`
```

- 36 linhas, cobre as 4 meta-tools genericamente
- Nao menciona `react`, Framer Motion, JSX, sandbox, whitelist de imports
- `mergeSystemPromptAppend()` ja existe e sera reutilizada

---

## Implementacao

### 1. Constante `REACT_OUTPUT_SYSTEM_PROMPT` em `src/display/prompt.ts`

Adicionar apos `DISPLAY_SYSTEM_PROMPT`:

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

### 2. Conteudo do prompt

O prompt cobre 6 secoes normativas:

| Secao | Regras-chave |
|-------|-------------|
| Cabecalho | Usar `react` so quando motion/interatividade ajuda de verdade |
| MODULE SHAPE | Exatamente um `export default function Component(props)`, sem side effects, sem async |
| IMPORTS | Whitelist estrita: `react` (7 symbols) + `framer-motion` (9 symbols). Declarar em `imports[]` |
| STYLING | Apenas `style={{...}}` inline. CSS vars `--fg`/`--bg`/`--accent`/`--muted` para tema |
| DATA | Dados em `initialProps`, `code` <= 8 KB, `initialProps` <= 32 KB |
| ANIMATION | Framer Motion primitives, spring transitions, stagger, enter/exit |
| LAYOUT | Self-contained, declarar `height` ou `aspectRatio` |

### 3. Relacao com `DISPLAY_SYSTEM_PROMPT`

Os dois prompts sao **independentes e compostos** via `mergeSystemPromptAppend()`:
- `DISPLAY_SYSTEM_PROMPT` sempre injetado quando `richOutput: true`
- `REACT_OUTPUT_SYSTEM_PROMPT` injetado **apos** o primeiro, **somente** quando `reactOutput: true` tambem

O modelo recebe ambos concatenados. Nao ha conflito — o segundo estende o primeiro.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/display/prompt.ts` | fim do arquivo (apos L37) | + constante `REACT_OUTPUT_SYSTEM_PROMPT` (~40 linhas) |

---

## Criterios de Aceite

- [ ] `REACT_OUTPUT_SYSTEM_PROMPT` exportado de `src/display/prompt.ts`
- [ ] Prompt contem secao MODULE SHAPE com regras: export default, sem side effects, sem async
- [ ] Prompt contem secao IMPORTS com whitelist: `react` (useState, useEffect, useMemo, useRef, useCallback, useReducer, Fragment) e `framer-motion` (motion, AnimatePresence, MotionConfig, useAnimate, useInView, useScroll, useTransform, useMotionValue, useSpring)
- [ ] Prompt contem secao STYLING: inline style apenas, CSS vars para tema, sem Tailwind/className
- [ ] Prompt contem secao DATA: initialProps para dados, limites 8 KB / 32 KB
- [ ] Prompt contem secao ANIMATION: framer-motion primitives, spring, stagger, enter/exit
- [ ] Prompt contem secao LAYOUT: self-contained, declarar height/aspectRatio
- [ ] Prompt instrui a usar `react` **somente** quando motion/interatividade ajuda — preferir actions existentes para dados simples
- [ ] `tsc --noEmit` passa

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `REACT_OUTPUT_SYSTEM_PROMPT` | S-075 |
| Regras MODULE SHAPE | S-075 |
| Whitelist de imports (react + framer-motion) | S-075 |
| Regras STYLING / DATA / ANIMATION / LAYOUT | S-075 |
| D-098 | S-075 |
