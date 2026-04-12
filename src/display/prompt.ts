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
component (useful for dashboards, animated explainers, interactive data viz, \
custom layouts). Use it when motion, interactivity, custom layout, or charts \
with real data shape would genuinely beat plain text or a static widget. \
Reflect honestly: would a thoughtful human designer reach for a chart, a \
dashboard, an interactive timeline, or a comparison view here? If yes, emit \
this action. If a single metric or a flat table is enough, prefer the simpler \
display actions.

MODULE SHAPE
- Must be a valid ES module with exactly one \
\`export default function Component(props) { ... }\`.
- No top-level side effects. No \`fetch\`, no \`localStorage\`, no \`window.*\` \
access, no timers outside \`useEffect\`. No async components.
- Read data from \`props\` — the host passes \`initialProps\` as the props object.

IMPORTS (strict whitelist — 5 modules)
- react: useState, useEffect, useMemo, useRef, useCallback, useReducer, Fragment
- react-dom: (rarely needed; createPortal if absolutely required)
- framer-motion: motion, AnimatePresence, MotionConfig, LayoutGroup, Reorder, \
useAnimate, useInView, useScroll, useTransform, useMotionValue, useSpring
- recharts: ResponsiveContainer, LineChart, BarChart, AreaChart, PieChart, \
RadarChart, ScatterChart, ComposedChart, Line, Bar, Area, Pie, Radar, Scatter, \
XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PolarGrid, PolarAngleAxis, \
PolarRadiusAxis
- lucide-react: any named icon import (TrendingUp, ArrowRight, Star, etc) — \
tree-shaken per import; use sparingly for visual accent
- Every import used in \`code\` MUST appear in the payload's \`imports\` array, \
matching the actual source exactly. Mismatches are rejected by the client.
- Do not import anything else. No other icon libs, no UI kits, no CSS files, no \
chart libs other than recharts.

STYLING
- Use inline \`style={{...}}\` objects only. No Tailwind classes, no className \
strings referring to external CSS, no <style> tags.
- When \`theme\` is set, prefer CSS variables var(--fg), var(--bg), var(--accent), \
var(--muted) — the host provides them.
- Typography: system font stack.

DATA
- Do NOT hardcode large datasets in JSX. Put them in \`initialProps\` and read \
via \`props\` in the component.
- Keep \`code\` under 8 KB. Keep \`initialProps\` under 32 KB serialized.

ANIMATION (framer-motion vocabulary — match the host app's tone)
- Default fade-in: \`initial={{ opacity: 0 }} animate={{ opacity: 1 }} \
transition={{ duration: 0.3 }}\`
- Slide-up entry: \`initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} \
transition={{ duration: 0.4, ease: "easeOut" }}\`
- Stagger children for lists: parent with \`variants={{ visible: { transition: \
{ staggerChildren: 0.1 } } }}\` and \`initial="hidden" animate="visible"\`, \
children with hidden/visible variants.
- Enter/exit transitions: wrap in \`<AnimatePresence>\` with \`mode="wait"\`.
- Hover/tap micro-interactions: \`whileHover={{ scale: 1.02 }} whileTap={{ \
scale: 0.98 }}\` with spring \`{ type: "spring", stiffness: 400, damping: 17 }\`.
- Spring presets: responsive \`{ stiffness: 300, damping: 30 }\`, bouncy \
\`{ stiffness: 400, damping: 17 }\`, smooth \`{ stiffness: 200, damping: 25 }\`.
- Timing: micro-interactions 100-200ms easeOut; component transitions 200-300ms \
easeInOut; attention animations 400-600ms spring.

CHARTS (recharts)
- Wrap every chart in \`<ResponsiveContainer width="100%" height="100%">\` so it \
fits the iframe layout.
- Pair recharts with framer-motion at the *container* level (fade-in / slide-up \
the chart card) — recharts handles its own internal transitions on data change.
- Pick the chart that fits the data: line for time series, bar for categories, \
pie for parts-of-whole (max 6 slices), radar for multi-dimensional comparisons \
(e.g. comparing 5 entities across 5 attributes), scatter for correlations, \
area for cumulative trends.

LAYOUT
- Component must be self-contained within \`layout\` dimensions. No fixed \
positioning that escapes the container.
- Declare \`layout.height\` (px or "auto") or \`layout.aspectRatio\` (e.g. \
"16/9") so the host reserves space.

PAYLOAD EXAMPLE (skeleton)
{
  "version": "1",
  "title": "...",
  "language": "jsx",
  "code": "import { motion } from 'framer-motion';\\nimport { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';\\nexport default function Component(props) { /* ... */ }",
  "imports": [
    { "module": "framer-motion", "symbols": ["motion"] },
    { "module": "recharts", "symbols": ["ResponsiveContainer","LineChart","Line","XAxis","YAxis","Tooltip"] }
  ],
  "initialProps": { "data": [/* ... */] },
  "layout": { "height": 360 },
  "theme": "auto"
}`
