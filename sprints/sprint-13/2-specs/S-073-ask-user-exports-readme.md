# openclaude-sdk - Exports Publicos e README do ask_user

Exportar tipos publicos de `src/index.ts` e documentar a feature no README com exemplo end-to-end.

---

## Objetivo

Resolver D-092 (score 7) e D-093 (score 6): exportar `AskUserRequest` e `AskUserAnswer` do barrel publico, e adicionar secao "Ask User" ao README com exemplo pratico e tabela de inputTypes.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-092 | Reexportar tipos publicos em `src/index.ts` |
| 2 | D-093 | Secao README "Ask User" |

**Dependencia**: S-069 (types), S-072 (integration — para o exemplo fazer sentido).

---

## Estado Atual

**Arquivo**: `src/index.ts` (linhas 202-249) — bloco de exports display:

```typescript
// Display schemas
export { DisplayHighlightCodeSchema, ... } from "./display/index.js"

// Display types
export type { DisplayHighlightCode, ... } from "./display/index.js"
```

**Arquivo**: `README.md` — ja tem secao "Rich Output" com exemplo e tabela (referencia de formato).

---

## Implementacao

### 1. Adicionar exports em `src/index.ts`

Apos o bloco de exports display, adicionar:

```typescript
// Ask User types
export type { AskUserRequest, AskUserAnswer } from "./ask-user/index.js"
```

**Regras**:
- Apenas tipos — nao exportar `askUserSchema`, `createAskUserMcpServer`, `formatAnswer` nem `ASK_USER_SYSTEM_PROMPT` (internos ao SDK)
- Usar `export type` para tree-shaking

### 2. Adicionar secao "Ask User" ao README

Inserir apos a secao "Rich Output", seguindo o mesmo formato.

**Conteudo**:

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

---

## Criterios de Aceite

- [ ] `AskUserRequest` exportado como type de `src/index.ts`
- [ ] `AskUserAnswer` exportado como type de `src/index.ts`
- [ ] Nenhum schema Zod ou funcao interna do ask-user exportado publicamente
- [ ] README tem secao "Ask User" apos "Rich Output"
- [ ] Exemplo end-to-end mostra `onAskUser` + `respondToAskUser`
- [ ] Tabela de Options documenta `askUser` e `askUserTimeoutMs`
- [ ] Tabela de inputTypes documenta os 4 tipos e formatos de resposta
- [ ] Cancelamento documentado com exemplo
- [ ] Nota de ortogonalidade com `richOutput`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/index.ts` (ask-user exports) | S-073 |
| `README.md` (secao Ask User) | S-073 |
| Discovery | D-092, D-093 |
