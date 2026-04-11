# openclaude-sdk - README, demo endpoint e validacao de build para React Rich Output

Spec da documentacao no README, atualizacao do demo server e verificacao de typecheck/build.

---

## Objetivo

Resolve D-101, D-102 e D-103.

| Problema | Consequencia |
|----------|-------------|
| README nao documenta React Rich Output | Feature invisivel para consumidores; pipeline de sandbox nao documentado expoe usuarios a eval nao-sandboxed |
| Demo endpoint `GET /display` nao lista action `react` | Desenvolvedores exploratórios nao descobrem a capacidade |
| Sem verificacao de typecheck/build apos todos os deltas | Discriminated union com novo member pode quebrar exhaustiveness checks |

---

## Estado Atual

### README.md

Secao "Rich Output" existente documenta:
- Flag `richOutput`
- Tabela das 4 meta-tools com actions
- Exemplo end-to-end com `block.name.startsWith('display_')`

Sem mencao a `reactOutput`, action `react`, ou pipeline de sandbox.

### `.tmp/demo/server.mjs`

Endpoint `GET /display` lista tools e actions disponiveis. Nao inclui `react` em `display_visual`.

---

## Implementacao

### 1. Secao "React Rich Output" no README

Adicionar apos a secao "Rich Output" existente:

#### 1.1 Tabela de gate das flags

```markdown
### React Rich Output

For visually rich responses (dashboards, animated explainers, interactive
layouts), enable both `richOutput` and `reactOutput`:

| `richOutput` | `reactOutput` | Result |
|---|---|---|
| `false` | any | Nothing injected (zero overhead) |
| `true` | `false` / absent | Display tools without React action |
| `true` | `true` | Display tools **with** React component support |

> `reactOutput: true` without `richOutput: true` is silently ignored.
```

#### 1.2 Exemplo de payload

```markdown
#### Example

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
```

#### 1.3 Pipeline obrigatorio do cliente

```markdown
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
```

### 2. Demo endpoint `GET /display`

Em `.tmp/demo/server.mjs`, na listagem de `display_visual`, adicionar `react` as actions:

```javascript
// display_visual
{
  name: "display_visual",
  actions: ["chart", "map", "code", "progress", "steps", "react"],
  // ...
}
```

### 3. Verificacao de build

Apos todos os deltas implementados:

```bash
npx tsc --noEmit    # typecheck
npx tsup            # build
```

Ambos devem passar sem erro.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `README.md` | apos secao "Rich Output" | + secao "React Rich Output" (~60 linhas) |
| `.tmp/demo/server.mjs` | endpoint `GET /display` | + action `react` em `display_visual` |

---

## Criterios de Aceite

- [ ] README contem secao "React Rich Output" com tabela de gate das duas flags
- [ ] README contem exemplo end-to-end com `{ richOutput: true, reactOutput: true }` e deteccao de `action === "react"`
- [ ] README contem pipeline obrigatorio de 6 passos (validate, transpile, sandbox, inject scope, render, theme)
- [ ] README contem nota de seguranca sobre sandbox obrigatorio
- [ ] Demo endpoint `GET /display` lista action `react` em `display_visual`
- [ ] `tsc --noEmit` passa apos todos os deltas da wave
- [ ] `tsup` builda sem erro apos todos os deltas da wave

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| README secao "React Rich Output" | S-078 |
| Demo endpoint `GET /display` | S-078 |
| Validacao typecheck + build | S-078 |
| D-101 | S-078 |
| D-102 | S-078 |
| D-103 | S-078 |
