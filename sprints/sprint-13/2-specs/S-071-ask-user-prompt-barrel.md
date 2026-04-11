# openclaude-sdk - System Prompt e Barrel do Modulo ask-user

Criar a constante de system prompt injetada quando `askUser: true` e o barrel `index.ts` do modulo.

---

## Objetivo

Resolver D-086 (score 7) e D-087 (score 6): criar `src/ask-user/prompt.ts` com o prompt de sistema que instrui o modelo a usar a tool `ask_user`, e `src/ask-user/index.ts` como barrel de reexportacao.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-086 | `ASK_USER_SYSTEM_PROMPT` — instrucoes para o modelo |
| 2 | D-087 | `src/ask-user/index.ts` — barrel do modulo |

**Dependencia**: S-069 (types + schema), S-070 (server).

---

## Estado Atual

**Referencia**: `src/display/prompt.ts` (linhas 27-36) define `DISPLAY_SYSTEM_PROMPT` como constante string.

**Referencia**: `src/display/index.ts` (linhas 1-51) reexporta schemas, tipos, tools, prompt e server.

---

## Implementacao

### 1. Criar `src/ask-user/prompt.ts`

```typescript
export const ASK_USER_SYSTEM_PROMPT = `You can ask the user for information mid-task using the ask_user tool. Use it when:
- You need clarification on an ambiguous request
- A required piece of information is missing
- You want explicit confirmation before an expensive or irreversible action

Prefer ask_user over guessing. Keep questions concise and provide context when needed.
Use inputType='choice' when there are clear discrete options.
Use inputType='boolean' for yes/no confirmations.
Use inputType='number' when expecting a numeric value.`
```

**Regras**:
- Texto em ingles (e system prompt para o modelo)
- Conciso e actionable — o modelo precisa saber QUANDO usar, nao COMO (o schema ja diz como)
- Nao duplica `mergeSystemPromptAppend()` — essa funcao ja existe em `src/display/prompt.ts` e sera importada de la

### 2. Criar `src/ask-user/index.ts`

```typescript
export type { AskUserRequest, AskUserAnswer } from "./types.js"
export { askUserSchema, type AskUserInput } from "./schema.js"
export { createAskUserMcpServer, formatAnswer, type AskUserEmitter } from "./server.js"
export { ASK_USER_SYSTEM_PROMPT } from "./prompt.js"
```

**Regras**:
- Reexporta apenas o que e necessario para consumo externo (por `query.ts` e `src/index.ts`)
- Tipos via `export type` para tree-shaking correto
- Extensao `.js` nos imports (ESM)

---

## Criterios de Aceite

- [ ] `src/ask-user/prompt.ts` existe com `ASK_USER_SYSTEM_PROMPT`
- [ ] Prompt em ingles, conciso, menciona os 4 inputTypes
- [ ] `src/ask-user/index.ts` existe como barrel
- [ ] Barrel reexporta: `AskUserRequest`, `AskUserAnswer`, `askUserSchema`, `AskUserInput`, `createAskUserMcpServer`, `formatAnswer`, `AskUserEmitter`, `ASK_USER_SYSTEM_PROMPT`
- [ ] Imports usam extensao `.js`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/ask-user/prompt.ts` | S-071 |
| `ASK_USER_SYSTEM_PROMPT` | S-071 |
| `src/ask-user/index.ts` | S-071 |
| Discovery | D-086, D-087 |
