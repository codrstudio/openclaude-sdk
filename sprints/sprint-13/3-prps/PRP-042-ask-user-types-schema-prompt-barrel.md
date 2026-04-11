# PRP-042 — Ask User Module: Types, Schema, Prompt, Barrel

## Objetivo

Criar o modulo `src/ask-user/` com tipos publicos (`AskUserRequest`, `AskUserAnswer`), schema Zod (`askUserSchema`), system prompt (`ASK_USER_SYSTEM_PROMPT`) e barrel de exports.

Referencia: specs S-069 (D-083, D-084), S-071 (D-086, D-087).

## Execution Mode

`implementar`

## Contexto

O openclaude-sdk ja tem um modulo built-in analogo: `src/display/` (criado em PRP-040, sprint-12). O `src/ask-user/` segue o mesmo padrao de organizacao:

```
src/ask-user/
  types.ts    # Tipos publicos do contrato
  schema.ts   # Schema Zod para validacao MCP
  prompt.ts   # System prompt injetado quando askUser: true
  index.ts    # Barrel de reexportacao
```

Infraestrutura disponivel:
- `tool()` em `src/mcp.ts` — factory nativa (aceita `ZodRawShape` e `ZodTypeAny` apos PRP-039)
- `createSdkMcpServer()` em `src/mcp.ts` — cria McpServer in-process
- `zod` como peer dep
- `@modelcontextprotocol/sdk` como peer dep
- `mergeSystemPromptAppend()` em `src/display/prompt.ts` — reutilizar para append de system prompt

O diretorio `src/ask-user/` ainda nao existe. Sera criado com 4 arquivos neste PRP.

## Especificacao

### Feature F-104 — src/ask-user/types.ts

Criar `src/ask-user/types.ts` com os tipos publicos do contrato ask_user.

**Conteudo completo do arquivo:**

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

Regras:
- `callId` e gerado pelo server handler (`randomUUID()`), nao pelo modelo
- `AskUserAnswer` e discriminated union por `type` — permite pattern matching no cliente
- `choices` so e semanticamente relevante quando `inputType === "choice"` — validacao no schema, nao no tipo

### Feature F-105 — src/ask-user/schema.ts

Criar `src/ask-user/schema.ts` com o schema Zod que define o contrato da tool MCP.

**Conteudo completo do arquivo:**

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

Regras:
- `.describe()` em cada campo — o modelo usa essas descricoes para entender a tool
- `inputType` tem `.default("text")` — simplifica invocacoes onde o modelo so quer resposta livre
- `AskUserInput` e o tipo inferido do schema (args do handler MCP), distinto de `AskUserRequest` (que inclui `callId`)

### Feature F-106 — src/ask-user/prompt.ts

Criar `src/ask-user/prompt.ts` com a constante do system prompt.

**Conteudo completo do arquivo:**

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

Regras:
- Texto em ingles (e system prompt para o modelo)
- Conciso e actionable — o modelo precisa saber QUANDO usar, nao COMO (o schema ja diz como)
- Nao duplicar `mergeSystemPromptAppend()` — essa funcao ja existe em `src/display/prompt.ts` e sera reutilizada por PRP-044

### Feature F-107 — src/ask-user/index.ts

Criar `src/ask-user/index.ts` como barrel do modulo.

**Conteudo completo do arquivo:**

```typescript
export type { AskUserRequest, AskUserAnswer } from "./types.js"
export { askUserSchema, type AskUserInput } from "./schema.js"
export { createAskUserMcpServer, formatAnswer, type AskUserEmitter } from "./server.js"
export { ASK_USER_SYSTEM_PROMPT } from "./prompt.js"
```

Regras:
- Reexporta apenas o necessario para consumo externo (por `query.ts` e `src/index.ts`)
- Tipos via `export type` para tree-shaking correto
- Extensao `.js` nos imports (ESM)

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `import type { AskUserRequest } from "./ask-user/index.js"` | Interface com callId, question, context?, inputType, choices?, placeholder? |
| `import type { AskUserAnswer } from "./ask-user/index.js"` | Discriminated union com 5 variantes |
| `askUserSchema.parse({ question: "What day?" })` | `{ question: "What day?", inputType: "text" }` (default applied) |
| `askUserSchema.parse({})` | Zod error (question required) |
| `ASK_USER_SYSTEM_PROMPT` | String com instrucoes para o modelo |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-104 | askUserTypes | `src/ask-user/types.ts` com `AskUserRequest` e `AskUserAnswer` (discriminated union, 5 variantes) |
| F-105 | askUserSchema | `src/ask-user/schema.ts` com `askUserSchema` Zod e tipo inferido `AskUserInput` |
| F-106 | askUserPrompt | `src/ask-user/prompt.ts` com `ASK_USER_SYSTEM_PROMPT` constante |
| F-107 | askUserBarrel | `src/ask-user/index.ts` barrel reexportando types, schema, server, prompt |

## Limites

- NAO criar `src/ask-user/server.ts` — escopo de PRP-043
- NAO alterar `src/mcp.ts` — ja funciona com `ZodRawShape` e `ZodTypeAny` (PRP-039)
- NAO alterar `src/index.ts` — exports publicos sao escopo de PRP-045
- NAO alterar `src/query.ts` — integracao e escopo de PRP-044
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO exportar `askUserSchema` do barrel publico — interno ao SDK

## Dependencias

Nenhuma dependencia de outros PRPs deste sprint. Modulo `src/display/` ja existe (PRP-040, sprint-12) como referencia de padrao. **Bloqueante para PRP-043** (server importa types e schema).
