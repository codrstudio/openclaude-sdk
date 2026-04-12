# React Rich Output — componente React + Framer Motion como saida rica

Extensao do Rich Output (milestone-02/01) que adiciona uma nova action `react` ao meta-tool `display_visual`, permitindo que o modelo emita **componentes React funcionais com Framer Motion** que o cliente renderiza como widgets animados (dashboards, explainers interativos, timelines com movimento, etc).

O feature e gated por uma **nova flag independente** `reactOutput`, que so tem efeito se `richOutput` tambem estiver ligada. Ou seja: `reactOutput` sozinho e ignorado silenciosamente — nao faz sentido emitir componente React sem o canal display ativo.

---

## Contexto

O milestone-02/01 entregou a saida rica em 19 actions distribuidas em 4 meta-tools. Uma dessas actions e `display_visual.code` — mas ela produz **codigo estatico com syntax highlight**, nao componente renderizavel.

Para casos em que o usuario pede algo visualmente sofisticado ("monta um dashboard das vendas", "desenha uma timeline animada do processo", "cria um chart interativo"), nenhuma das actions existentes e suficiente: metricas sao pontuais, tables sao estaticas, charts sao declarativos e limitados. A resposta natural seria um **componente React animado** — e o LLM e perfeitamente capaz de escreve-lo, desde que exista um canal estruturado pra transmitir o codigo e regras claras do que ele pode produzir.

Esta task abre esse canal.

---

## Decisoes de design

### 1. Action nova dentro de `display_visual`, nao meta-tool nova

React e conceitualmente uma "visualizacao" — mesma familia de `chart`, `code`, `map`. Adicionar uma 5a meta-tool `display_react` duplicaria estrutura sem ganho. A action `react` entra no `visualSchema` discriminated union de `tools.ts` ao lado das 5 existentes.

### 2. Duas flags independentes, com gate

```typescript
interface Options {
  richOutput?: boolean   // ja existe
  reactOutput?: boolean  // novo
}
```

Regra de ativacao:

| `richOutput` | `reactOutput` | Resultado |
|---|---|---|
| `false` / ausente | qualquer | Nada injetado (zero overhead) |
| `true` | `false` / ausente | Display tools ativadas **sem** action `react`. System prompt do display puro. |
| `true` | `true` | Display tools ativadas **com** action `react`. System prompt do display + apendice de regras React. |

**`reactOutput: true` sem `richOutput: true` e ignorado em silencio** (nada de warn). O `if (optionsForCli.richOutput)` externo ja cuida disso naturalmente — a injecao React vive **dentro** desse bloco.

### 3. Padrao de transferencia: JSX string + transpile no cliente

Tres padroes existem para LLM -> React:

| Padrao | Exemplo de quem usa | Viavel aqui? |
|---|---|---|
| **A. JSX string + transpile no cliente** | Anthropic Artifacts, v0.dev, react-live, Sandpack | **Sim — escolhido** |
| B. Arvore JSON (generative UI) | Vercel AI SDK `ai/rsc` | Nao — sem hooks/estado/Framer Motion real |
| C. RSC streaming | Next.js RSC | Nao — exige runtime Next, quebra neutralidade do SDK |

Padrao A e o unico que entrega "dashboards lindos com Framer Motion". E o mesmo padrao que a propria Anthropic usa em Artifacts. A responsabilidade de transpile + sandbox fica no cliente (host app); o SDK documenta o contrato e o modelo cospe codigo-fonte ESM.

### 4. Whitelist de imports restrita na v1

Apenas `react` e `framer-motion`. Motivos:
- Cobre 95% dos casos de dashboards/explainers animados.
- Nao exige que o host disponibilize um bundle enorme no sandbox.
- Amplia sob demanda real (futuro: `recharts`, `lucide-react`).

O LLM e **obrigado a listar** os imports usados no payload — o cliente valida contra a whitelist antes de transpilar.

---

## Schema do payload (action `react`)

```typescript
const DisplayReactSchema = z.object({
  action: z.literal("react"),

  // Schema version — permite evoluir sem quebrar clientes antigos
  version: z.literal("1"),

  // UI chrome
  title: z.string().optional()
    .describe("Titulo exibido acima do componente"),
  description: z.string().optional()
    .describe("Subtitulo ou contexto curto"),

  // Codigo-fonte ESM com exactly one default export
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

  // Dependencias explicitas — cliente valida contra whitelist
  imports: z.array(
    z.object({
      module: z.enum(["react", "framer-motion"]),
      symbols: z.array(z.string()).min(1),
    })
  ).describe(
    "Every import used in `code` must be declared here. " +
    "Mismatch with actual imports rejects the payload."
  ),

  // Dados iniciais passados como props (separado do code pra nao inflar JSX)
  initialProps: z.record(z.unknown()).optional()
    .describe("Props passed to the component on mount. Max 32 KB serialized."),

  // Dimensionamento — iframe/container precisa saber o alvo
  layout: z.object({
    height: z.union([z.number(), z.literal("auto")]).optional()
      .describe("Height in px, or 'auto' for ResizeObserver-driven"),
    aspectRatio: z.string().optional()
      .describe("CSS aspect-ratio string, e.g. '16/9'"),
    maxWidth: z.number().optional()
      .describe("Max width in px; default: 100% of container"),
  }).optional(),

  // Preferencia visual — cliente decide se respeita
  theme: z.enum(["light", "dark", "auto"]).optional(),
})
```

Integracao no `visualSchema` de `tools.ts`:

```typescript
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
  z.object({ action: z.literal("react"), ...DisplayReactSchema.shape }),  // NEW
])
```

---

## System prompt adicional (so quando `reactOutput: true`)

Novo constante `REACT_OUTPUT_SYSTEM_PROMPT` em `src/display/prompt.ts`, apendado ao `DISPLAY_SYSTEM_PROMPT` via `mergeSystemPromptAppend` somente quando `reactOutput` esta ligado.

```
You may also emit a `react` action via display_visual to render a live React
component (useful for dashboards, animated explainers, interactive layouts).
Use it ONLY when motion, interactivity, or custom layout genuinely helps —
for simple metrics, tables, or charts, prefer the existing actions.

MODULE SHAPE
- Must be a valid ES module with exactly one
  `export default function Component(props) { ... }`.
- No top-level side effects. No `fetch`, no `localStorage`, no `window.*`
  access, no timers outside `useEffect`. No async components.

IMPORTS (strict whitelist)
- react: useState, useEffect, useMemo, useRef, useCallback, useReducer,
  Fragment
- framer-motion: motion, AnimatePresence, MotionConfig, useAnimate, useInView,
  useScroll, useTransform, useMotionValue, useSpring
- Every import used in `code` MUST appear in the payload's `imports` array,
  matching the actual source. Mismatches are rejected by the client.
- Do not import anything else. No icon libraries, no UI kits, no CSS files.

STYLING
- Use inline `style={{...}}` objects only. No Tailwind classes, no className
  strings referring to external CSS, no <style> tags.
- When `theme` is set, prefer CSS variables var(--fg), var(--bg), var(--accent),
  var(--muted) — the host provides them.
- Typography: system font stack.

DATA
- Do NOT hardcode large datasets in JSX. Put them in `initialProps` and read
  via `props.data` in the component.
- Keep `code` under 8 KB. Keep `initialProps` under 32 KB serialized.

ANIMATION
- Prefer framer-motion primitives: <motion.div>, AnimatePresence, layout
  animations.
- Default to polished motion: spring transitions, staggered children,
  enter/exit animations, subtle hover states.

LAYOUT
- Component must be self-contained within `layout` dimensions. No fixed
  positioning that escapes the container.
- Declare `layout.height` or `layout.aspectRatio` so the host reserves space.
```

---

## Estrutura de arquivos (delta sobre milestone-02/01)

```
src/
  display/
    schemas.ts       # + DisplayReactSchema, + tipo DisplayReact
    tools.ts         # visualSchema ganha action "react"
    prompt.ts        # + REACT_OUTPUT_SYSTEM_PROMPT
    index.ts         # + exports de DisplayReactSchema / DisplayReact /
                     #   REACT_OUTPUT_SYSTEM_PROMPT
  types/
    options.ts       # + reactOutput?: boolean
  query.ts           # dentro do if (richOutput), apos o merge do prompt,
                     # se reactOutput tambem for true, faz segundo
                     # mergeSystemPromptAppend com REACT_OUTPUT_SYSTEM_PROMPT
  index.ts           # + exports publicos de DisplayReactSchema / DisplayReact
```

---

## Ponto de integracao em `query.ts`

Trecho atual (linha ~222):

```typescript
if (optionsForCli.richOutput) {
  const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
    await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("display" in existingServers) {
    console.warn("[openclaude-sdk] mcpServers already has a 'display' key — overriding with built-in display server")
  }

  optionsForCli = {
    ...optionsForCli,
    mcpServers: { ...existingServers, display: displayServer },
    systemPrompt: mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT),
  }
}
```

Delta:

```typescript
if (optionsForCli.richOutput) {
  const {
    createDisplayMcpServer,
    DISPLAY_SYSTEM_PROMPT,
    REACT_OUTPUT_SYSTEM_PROMPT,        // NEW
    mergeSystemPromptAppend,
  } = await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("display" in existingServers) {
    console.warn("[openclaude-sdk] mcpServers already has a 'display' key — overriding with built-in display server")
  }

  let mergedPrompt = mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT)

  // React output — nested gate: so tem efeito se richOutput tambem ligado.
  // Ignora silencioso quando reactOutput vem sem richOutput.
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

**Importante:** a action `react` vive **sempre** no schema do `display_visual` — nao e adicionada/removida em runtime. O que muda em runtime e apenas o **system prompt**, que so instrui o LLM a usar a action quando `reactOutput` esta ligado. Manter o schema estatico simplifica tipos e evita proliferacao de variantes do MCP server.

---

## Exports publicos novos

Em `src/display/index.ts`:

```typescript
export { DisplayReactSchema } from "./schemas.js"
export type { DisplayReact } from "./schemas.js"
export { REACT_OUTPUT_SYSTEM_PROMPT } from "./prompt.js"
```

Em `src/index.ts` (secao "Display — Rich Output"):

```typescript
export { DisplayReactSchema } from "./display/index.js"
export type { DisplayReact } from "./display/index.js"
```

`DisplayToolRegistry` ganha a nova entrada `display_visual.react` automaticamente via o discriminated union.

---

## Contrato do cliente (documentacao no README)

O SDK nao renderiza — apenas transmite. O README ganha uma secao nova "Rendering react payloads" com o pipeline obrigatorio que qualquer host deve seguir:

```
1. VALIDATE
   - version === "1"
   - All imports[].module in whitelist (react | framer-motion)
   - Parse `code` — reject if it contains any import statement whose module
     is not declared in `imports`.
   - code.length <= 8 KB; JSON.stringify(initialProps).length <= 32 KB.

2. TRANSPILE
   - Use Babel standalone with preset ["react"] (+ "typescript" if
     language === "tsx"), or sucrase transforms ["jsx", "typescript"].
   - Wrap `code` as an ES module and extract the default export.

3. SANDBOX
   - Render inside a sandboxed <iframe sandbox="allow-scripts"> on a distinct
     origin, OR a shadow DOM with a strict scope.
   - Never eval LLM code on the main document origin with access to user data.

4. INJECT SCOPE
   - Provide only React and framer-motion as the module's resolver.
   - Any other import in `code` must throw at resolve time.

5. RENDER
   - Mount as <Component {...payload.initialProps} /> inside an error boundary.
   - Wrap in <MotionConfig reducedMotion="user"> to respect OS settings.
   - Honor layout.height / layout.aspectRatio on the container/iframe.

6. THEME
   - If payload.theme is set, expose CSS variables (--fg, --bg, --accent,
     --muted) on the host container before mounting.
```

Esta documentacao e **normativa** — hosts que nao seguem o passo 3 (sandbox) expoem usuarios a eval de codigo nao confiavel.

---

## Exemplo end-to-end

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Monta um dashboard animado com 4 KPIs de vendas e um chart de linha",
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
          console.log("[react payload]", input)
          // host: validate -> transpile -> sandbox -> render
        }
      }
    }
  }
}
```

---

## Criterios de aceite

- [ ] `options.reactOutput: boolean` aceita na interface `Options`
- [ ] `DisplayReactSchema` adicionado em `src/display/schemas.ts` com todos os campos especificados (version, code, language, entry, imports, initialProps, layout, theme, title, description)
- [ ] Action `react` adicionada ao `visualSchema` em `src/display/tools.ts`
- [ ] `REACT_OUTPUT_SYSTEM_PROMPT` exportado de `src/display/prompt.ts` com as regras completas (module shape, imports whitelist, styling, data, animation, layout)
- [ ] `src/display/index.ts` reexporta `DisplayReactSchema`, tipo `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT`
- [ ] `src/index.ts` adiciona exports publicos de `DisplayReactSchema` e tipo `DisplayReact`
- [ ] `query.ts`: dentro do bloco `if (optionsForCli.richOutput)`, apos o merge do `DISPLAY_SYSTEM_PROMPT`, se `reactOutput` tambem true, faz segundo `mergeSystemPromptAppend` com `REACT_OUTPUT_SYSTEM_PROMPT`
- [ ] `reactOutput: true` sem `richOutput: true` e ignorado em silencio (sem warn, sem erro, sem injecao)
- [ ] `richOutput: true` sem `reactOutput` funciona como antes — nada do React e injetado
- [ ] `richOutput: true` + `reactOutput: true` = system prompt contem ambos os blocos (display base + regras React)
- [ ] Typecheck passa (`tsc --noEmit`)
- [ ] Build passa (`tsup`)
- [ ] README ganha secao nova "React Rich Output" com: tabela de gate das duas flags, exemplo de payload, o pipeline obrigatorio do cliente (validate -> transpile -> sandbox -> inject scope -> render -> theme), e nota de seguranca sobre sandbox
- [ ] `.tmp/demo/server.mjs` atualiza o endpoint `GET /display` para listar a nova action `react` em `display_visual`
- [ ] Teste manual via demo: request com `{ richOutput: true, reactOutput: true }` + prompt pedindo "dashboard animado" → modelo invoca `display_visual` com `action: "react"`, payload segue o schema, `imports` bate com os imports reais do `code`

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| Rich Output base (milestone-02/01) | Ja implementado — `src/display/*`, `richOutput` flag, `mergeSystemPromptAppend`, `DISPLAY_SYSTEM_PROMPT` |
| `tool()` / `createSdkMcpServer()` | Ja implementado (milestone-01/06) |
| `zod` peer dep | Ja peer dep |

Nenhuma dep nova no SDK. O **host** (openclaude-chat ou equivalente) precisa de Babel standalone ou sucrase + iframe sandbox, mas isso fica fora deste repo.

---

## Nao-objetivos

- **Renderizacao, transpile e sandbox** — 100% responsabilidade do host. O SDK so transmite e documenta o contrato.
- **Ampliar a whitelist de imports** — v1 e estritamente `react` + `framer-motion`. `recharts`, `lucide-react`, etc. sao futuros possiveis, cada um exige task propria (schema update + system prompt update + decisao do host sobre bundle).
- **Renderizacao server-side / RSC** — fora do escopo; quebra a neutralidade do SDK.
- **Validacao estatica do JSX no servidor** — o SDK nao parseia o `code`. O cliente e responsavel por validar imports declarados vs reais antes de transpilar.
- **Componentes React prontos** — o SDK nao embarca biblioteca de widgets; quem monta e o LLM.
- **Ativacao isolada de React sem display** — decidido explicitamente: `reactOutput` sozinho e no-op.

---

## Prioridade

**Media-alta** — desbloqueia respostas visualmente sofisticadas (dashboards, explainers animados) que nenhuma das 19 actions atuais consegue produzir. Nao e critico pro MVP do Rich Output, mas e o diferencial que separa "resposta com widgets" de "resposta tipo Artifacts".

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Base do Rich Output | `sprints/backlog/milestone-02/01-rich-output-display-tools/TASK.md` |
| Flag `richOutput` e injecao atual | `src/query.ts:222` |
| Padrao de referencia (Artifacts / v0 / react-live) | Pesquisa de design 2026-04-11 |
| Decisao "ignora silencioso quando reactOutput sem richOutput" | Conversa de design 2026-04-11 |
| Decisao "action `react` em `display_visual`, nao meta-tool nova" | Conversa de design 2026-04-11 |
| Decisao "whitelist v1 = react + framer-motion" | Conversa de design 2026-04-11 |
