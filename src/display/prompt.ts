type SystemPromptInput =
  | string
  | { type: "preset"; preset: "claude_code"; append?: string }
  | undefined

type SystemPromptResult =
  | string
  | { type: "preset"; preset: "claude_code"; append?: string }

export function mergeSystemPromptAppend(
  existing: SystemPromptInput,
  append: string,
): SystemPromptResult {
  if (existing === undefined) {
    return { type: "preset", preset: "claude_code", append }
  }
  if (typeof existing === "string") {
    return `${existing}\n\n${append}`
  }
  return {
    type: "preset",
    preset: "claude_code",
    append: existing.append !== undefined ? `${existing.append}\n\n${append}` : append,
  }
}

export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured \
content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific \
to that action. Call them exactly like any other tool. The client renders them as \
interactive widgets.`

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
- react: useState, useEffect, useMemo, useRef, useCallback, useReducer, Fragment
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
- Prefer framer-motion primitives: <motion.div>, AnimatePresence, layout animations.
- Default to polished motion: spring transitions, staggered children, \
enter/exit animations, subtle hover states.

LAYOUT
- Component must be self-contained within \`layout\` dimensions. No fixed \
positioning that escapes the container.
- Declare \`layout.height\` or \`layout.aspectRatio\` so the host reserves space.`
