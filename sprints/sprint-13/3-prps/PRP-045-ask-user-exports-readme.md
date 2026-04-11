# PRP-045 — Ask User: Public Exports + README

## Objetivo

Exportar tipos publicos `AskUserRequest` e `AskUserAnswer` de `src/index.ts` e documentar a feature no README com exemplo end-to-end e tabela de inputTypes.

Referencia: spec S-073 (D-092, D-093).

## Execution Mode

`implementar`

## Contexto

O modulo `src/ask-user/` esta completo (PRP-042 + PRP-043) e integrado em `query.ts` (PRP-044). Faltam:

1. **Exports publicos** — `src/index.ts` precisa reexportar `AskUserRequest` e `AskUserAnswer` para que consumidores do SDK possam tipar seus handlers de `onAskUser`.

2. **README** — secao "Ask User" com exemplo pratico e tabela de inputTypes, seguindo o formato da secao "Rich Output" existente.

**Referencia**: `src/index.ts` ja tem bloco de exports display (sprint-12, PRP-041):

```typescript
// Display — rich output schemas & types
export { DisplayMetricSchema, ... } from "./display/index.js"
export type { DisplayToolName, ... } from "./display/index.js"
```

**Referencia**: `README.md` ja tem secao "Rich Output" com exemplo e tabela (sprint-12, PRP-041).

## Especificacao

### Feature F-113 — Exports publicos em src/index.ts

Apos o bloco de exports display, adicionar:

```typescript
// Ask User types
export type { AskUserRequest, AskUserAnswer } from "./ask-user/index.js"
```

Regras:
- Apenas tipos — NAO exportar `askUserSchema`, `createAskUserMcpServer`, `formatAnswer` nem `ASK_USER_SYSTEM_PROMPT` (internos ao SDK)
- Usar `export type` para tree-shaking correto
- Extensao `.js` no import (ESM)

### Feature F-114 — README secao Ask User

Inserir apos a secao "Rich Output", seguindo o mesmo formato.

**Conteudo:**

```markdown
### Ask User

Enable `askUser` to let the agent pause and ask the user structured questions mid-task:

\`\`\`typescript
import { query } from "openclaude-sdk"
import type { AskUserRequest } from "openclaude-sdk"

const q = query({
  prompt: "Book a meeting for next week with the marketing team",
  options: { askUser: true },
})

q.onAskUser((req: AskUserRequest) => {
  console.log(`[agent asks] ${req.question}`)

  if (req.inputType === "choice" && req.choices) {
    q.respondToAskUser(req.callId, { type: "choice", id: req.choices[0].id })
  } else {
    q.respondToAskUser(req.callId, { type: "text", value: "Tuesday 2pm" })
  }
})

for await (const msg of q) {
  // process messages...
}
\`\`\`

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `askUser` | `boolean` | `false` | Enable the ask_user built-in tool |
| `askUserTimeoutMs` | `number` | `undefined` | Auto-cancel unanswered questions after N ms |

**Input types:**

| inputType | Answer type | When to use |
|-----------|-------------|-------------|
| `text` | `{ type: "text", value: string }` | Free-form text input |
| `number` | `{ type: "number", value: number }` | Numeric values |
| `boolean` | `{ type: "boolean", value: boolean }` | Yes/no confirmations |
| `choice` | `{ type: "choice", id: string }` | Discrete options (requires `choices` array) |

To cancel a pending question:

\`\`\`typescript
q.respondToAskUser(req.callId, { type: "cancelled" })
\`\`\`

`askUser` and `richOutput` are orthogonal — both can be enabled simultaneously.
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `import type { AskUserRequest } from "openclaude-sdk"` | Erro | Funciona |
| `import type { AskUserAnswer } from "openclaude-sdk"` | Erro | Funciona |
| `import { askUserSchema } from "openclaude-sdk"` | Erro | Erro (intencional — interno) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-113 | askUserPublicExports | `AskUserRequest` e `AskUserAnswer` exportados como type de `src/index.ts` |
| F-114 | readmeAskUser | Secao "Ask User" no README com exemplo end-to-end, tabela de options, tabela de inputTypes, cancelamento |

## Limites

- NAO exportar schemas Zod ou funcoes internas do ask-user (apenas tipos publicos)
- NAO alterar `src/ask-user/*` — ja completo por PRP-042 e PRP-043
- NAO alterar `src/query.ts` — ja completo por PRP-044
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO implementar renderizacao de UI para perguntas — responsabilidade do cliente (ex: agentic-chat)

## Dependencias

Depende de **PRP-042** (types existem), **PRP-043** (server existe), **PRP-044** (integracao completa para o exemplo do README funcionar). Nenhum PRP depende deste.
