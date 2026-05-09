// Gera o trecho de system prompt que ensina o agente a emitir Artifacts.
//
// Convenção `<antArtifact>` espelha Claude.ai. O cliente parseia tags do
// próprio TextBlock — sem MCP, sem tool. SDK só injeta este body como
// append do system prompt quando `artifacts: true` em createPersistentSession.

import type { ArtifactsFeatures, ArtifactType } from "./types.js"

const ALL_TYPES: ArtifactType[] = [
  "application/vnd.ant.code",
  "text/markdown",
  "text/html",
  "image/svg+xml",
  "application/vnd.ant.mermaid",
  "application/vnd.ant.react",
]

export function buildSkillBody(features: ArtifactsFeatures = {}): string {
  const enabled = new Set(features.enabledTypes ?? ALL_TYPES)
  const has = (t: ArtifactType) => enabled.has(t)

  const sections: string[] = []

  sections.push(`# Artifacts (rich output)

You can emit "artifacts" — substantial, self-contained pieces of content
the user is likely to keep, copy, or interact with — by wrapping them in
\`<antArtifact>\` tags inside a regular text response.

## Tag format

\`\`\`
<antArtifact identifier="<stable-id>" type="<mime-type>" title="<short label>"${has("application/vnd.ant.code") ? ' [language="<lang>"]' : ""}>
<payload — raw, no escaping needed inside tags>
</antArtifact>
\`\`\`

- **identifier**: kebab-case, stable for the artifact's lifetime in the
  conversation. Reusing the same \`identifier\` in a later turn means
  *update this artifact* (the client replaces the previous one). Pick a
  fresh \`identifier\` only when creating a genuinely new artifact.
- **title**: 1-6 words, human-readable.
- **type**: one of the supported MIME types (see below).
- **language** (only for code): \`tsx\`, \`python\`, \`bash\`, \`json\`, etc.

You may include prose before and after the tag. The tag content goes to a
dedicated card in the UI; the prose is rendered normally.

## When to emit

Emit an artifact when the answer is:
- **Substantial** (>~15 lines or non-trivial structure)
- **Self-contained** (works without external context)
- **Likely to be saved, copied, run, or interacted with**

Do NOT emit for short answers, single-paragraph explanations, list
responses, or quick clarifications. Don't wrap regular prose in artifacts
just because it's long.

## Updating an artifact

When the user asks for an iteration ("make it bigger", "change the title"),
emit the same \`identifier\` with the new full content. The client replaces
the existing card. Don't create a new artifact for incremental changes.

## Supported types

`)

  if (has("application/vnd.ant.code")) {
    sections.push(`### \`application/vnd.ant.code\` — source code

For code listings the user will read or copy. Always include \`language\`.

\`\`\`
<antArtifact identifier="fib-py" type="application/vnd.ant.code" language="python" title="Fibonacci recursivo">
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)
</antArtifact>
\`\`\`
`)
  }

  if (has("text/markdown")) {
    sections.push(`### \`text/markdown\` — formatted document

For longer-form written content (letters, READMEs, recipes, plans). The
client renders the markdown formatted in a card with copy/download actions.
Use only when the *whole* response is a document. For short markdown
inline, just write it normally without an artifact.

\`\`\`
<antArtifact identifier="readme" type="text/markdown" title="README do projeto">
# Foo

## Instalação
...
</antArtifact>
\`\`\`
`)
  }

  if (has("text/html")) {
    sections.push(`### \`text/html\` — standalone web page

Self-contained HTML, including \`<style>\`/\`<script>\` if needed.
Rendered in a sandboxed iframe (no \`fetch\`, no parent-window access).
No external resources — bake images as data: URLs if needed.

\`\`\`
<antArtifact identifier="hello" type="text/html" title="Pagina de boas-vindas">
<!DOCTYPE html>
<html><body><h1 style="color:teal">Ola</h1></body></html>
</antArtifact>
\`\`\`
`)
  }

  if (has("image/svg+xml")) {
    sections.push(`### \`image/svg+xml\` — vector graphic

Self-contained SVG. Always set \`viewBox\`. No external image refs, no
JavaScript inside the SVG.

\`\`\`
<antArtifact identifier="logo" type="image/svg+xml" title="Logo proposta">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="teal" />
</svg>
</antArtifact>
\`\`\`
`)
  }

  if (has("application/vnd.ant.mermaid")) {
    sections.push(`### \`application/vnd.ant.mermaid\` — diagram

Mermaid diagram source. The client renders to SVG.

\`\`\`
<antArtifact identifier="flow" type="application/vnd.ant.mermaid" title="Fluxo de pagamento">
flowchart TD
  A[User] --> B{Tem saldo?}
  B -->|sim| C[Cobra]
  B -->|nao| D[Erro]
</antArtifact>
\`\`\`
`)
  }

  if (has("application/vnd.ant.react")) {
    sections.push(`### \`application/vnd.ant.react\` — interactive React component

Single-file React component. Define a function \`App\` (or default-export
one) — the client renders \`<App />\`. The component executes in a
sandboxed scope. Available without imports:

- React: \`React\`, \`useState\`, \`useMemo\`, \`useCallback\`, \`useEffect\`
- shadcn primitives: \`Card\`/\`CardHeader\`/\`CardTitle\`/\`CardDescription\`/
  \`CardContent\`/\`CardFooter\`, \`Button\`, \`Badge\`, \`Tabs\`/\`TabsList\`/
  \`TabsTrigger\`/\`TabsContent\`, \`Tooltip\`/\`TooltipTrigger\`/
  \`TooltipContent\`/\`TooltipProvider\`, \`Progress\`, \`Slider\`, \`Switch\`,
  \`Separator\`, \`Skeleton\`, \`ScrollArea\`, \`Avatar\`/\`AvatarImage\`/
  \`AvatarFallback\`, \`Input\`, \`Select\`/\`SelectTrigger\`/\`SelectValue\`/
  \`SelectContent\`/\`SelectItem\`, \`Toggle\`, \`Sheet\`/\`SheetTrigger\`/
  \`SheetContent\`/\`SheetHeader\`/\`SheetTitle\`, \`Dialog\`/\`DialogTrigger\`/
  \`DialogContent\`/\`DialogHeader\`/\`DialogTitle\`/\`DialogDescription\`,
  \`Alert\`/\`AlertTitle\`/\`AlertDescription\`, \`Collapsible\`/
  \`CollapsibleTrigger\`/\`CollapsibleContent\`
- Charts (recharts): \`ResponsiveContainer\`, \`LineChart\`, \`BarChart\`,
  \`PieChart\`, \`AreaChart\`, \`RadarChart\`, \`XAxis\`, \`YAxis\`, \`Legend\`,
  \`CartesianGrid\`, \`Line\`, \`Bar\`, \`Pie\`, \`Area\`, \`Radar\`, \`Cell\`
- Motion (framer-motion): \`motion\` (motion.div etc.), \`AnimatePresence\`,
  \`MotionConfig\`, \`LayoutGroup\`, \`Reorder\`
- Icons: helper \`icon('Heart')\` returns the lucide-react component (or
  \`null\` if unknown). Use PascalCase names.
- Helpers: \`__actions.ask(text)\` — sends \`text\` as a new user message.

Tailwind classes only (no CSS files). Style via \`className\`.

**Forbidden** (rejected by the AST validator before render):
\`while\`, \`for\`, \`do/while\`, \`setInterval\`, \`setTimeout\`, \`eval\`,
\`Function\` constructor, \`Worker\`, \`fetch\`, \`XMLHttpRequest\`,
\`document\`, \`window\`, \`localStorage\`, \`sessionStorage\`, \`import\`,
\`require\`. \`useEffect\` is allowed but its second arg must be an array
literal — no inline functions or random values in the deps.

Total source size: keep under ~50KB.

\`\`\`
<antArtifact identifier="counter" type="application/vnd.ant.react" title="Contador">
function App() {
  const [n, setN] = useState(0)
  return (
    <Card className="w-64">
      <CardHeader><CardTitle>Contador</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <span className="text-4xl font-bold">{n}</span>
        <Button onClick={() => setN(n + 1)}>+1</Button>
      </CardContent>
    </Card>
  )
}
</antArtifact>
\`\`\`
`)
  }

  return sections.join("\n").trim()
}
