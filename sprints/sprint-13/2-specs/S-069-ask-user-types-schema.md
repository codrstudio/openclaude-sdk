# openclaude-sdk - Tipos e Schema Zod do ask_user

Definir os tipos TypeScript e o schema Zod que formam o contrato da tool `ask_user` entre agente, SDK e cliente.

---

## Objetivo

Resolver D-083 (score 8) e D-084 (score 8): criar `src/ask-user/types.ts` com os tipos publicos `AskUserRequest` e `AskUserAnswer`, e `src/ask-user/schema.ts` com o schema Zod que o MCP server usa para validar a invocacao da tool.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-083 | `AskUserRequest` e `AskUserAnswer` como tipos TS exportaveis |
| 2 | D-084 | `askUserSchema` Zod com campos `question`, `context?`, `inputType`, `choices?`, `placeholder?` |

---

## Estado Atual

Nao existe diretorio `src/ask-user/`. O padrao a seguir e identico ao `src/display/`:
- `src/display/schemas.ts` — schemas Zod (referencia de formato)
- `src/display/server.ts` — usa schemas no handler

---

## Implementacao

### 1. Criar `src/ask-user/types.ts`

```typescript
export interface AskUserRequest {
  callId: string
  question: string
  context?: string
  inputType: "text" | "number" | "boolean" | "choice"
  choices?: { id: string; label: string }[]
  placeholder?: string
}

export type AskUserAnswer =
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "choice"; id: string }
  | { type: "cancelled" }
```

**Regras**:
- `callId` e gerado pelo server handler (`randomUUID()`), nao pelo modelo
- `choices` so e relevante quando `inputType === "choice"` — validacao no schema, nao no tipo
- `AskUserAnswer` e discriminated union por `type` — permite pattern matching no cliente

### 2. Criar `src/ask-user/schema.ts`

```typescript
import { z } from "zod"

export const askUserSchema = z.object({
  question: z.string().describe("The question to ask the user"),
  context: z.string().optional().describe("Optional context explaining why this question is needed"),
  inputType: z.enum(["text", "number", "boolean", "choice"]).default("text")
    .describe("The expected type of the user's answer"),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })).optional().describe("Required when inputType is 'choice'"),
  placeholder: z.string().optional().describe("Optional placeholder text for the input"),
})

export type AskUserInput = z.infer<typeof askUserSchema>
```

**Regras**:
- `.describe()` em cada campo — o modelo usa essas descricoes para entender a tool
- `inputType` tem `.default("text")` — simplifica invocacoes onde o modelo so quer uma resposta livre
- `AskUserInput` e o tipo inferido do schema (args do handler MCP), distinto de `AskUserRequest` (que inclui `callId`)

---

## Criterios de Aceite

- [ ] `src/ask-user/types.ts` existe com `AskUserRequest` e `AskUserAnswer`
- [ ] `AskUserAnswer` e discriminated union com 5 variantes (`text`, `number`, `boolean`, `choice`, `cancelled`)
- [ ] `src/ask-user/schema.ts` existe com `askUserSchema` e `AskUserInput`
- [ ] Schema Zod tem `.describe()` em todos os campos
- [ ] `inputType` tem default `"text"`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/ask-user/types.ts` | S-069 |
| `AskUserRequest` | S-069 |
| `AskUserAnswer` | S-069 |
| `src/ask-user/schema.ts` | S-069 |
| `askUserSchema` | S-069 |
| `AskUserInput` | S-069 |
| Discovery | D-083, D-084 |
