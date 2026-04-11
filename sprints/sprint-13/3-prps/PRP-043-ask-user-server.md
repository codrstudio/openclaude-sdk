# PRP-043 — Ask User Server: MCP Handler, Pending Map, Concurrent Guard

## Objetivo

Criar `src/ask-user/server.ts` com `createAskUserMcpServer()` que registra a tool `ask_user` como MCP server in-process, com handler bloqueante via Promise, `formatAnswer()` e guarda contra perguntas concorrentes.

Referencia: spec S-070 (D-085, D-091).

## Execution Mode

`implementar`

## Contexto

O modulo `src/ask-user/` (PRP-042) expoe:
- `AskUserRequest`, `AskUserAnswer` em `types.ts`
- `askUserSchema`, `AskUserInput` em `schema.ts`

O padrao a seguir e identico ao `src/display/server.ts` (linhas 5-10):

```typescript
export async function createDisplayMcpServer(): Promise<McpSdkServerConfig> {
  return createSdkMcpServer({
    name: "display",
    tools: createDisplayTools(),
  })
}
```

O `createSdkMcpServer()` em `src/mcp.ts` (linhas 34-71) aceita `{ name, version?, tools? }` e retorna `McpSdkServerConfig`. Cada tool e registrada via `tool()` factory.

Diferenca em relacao ao display: o handler da tool `ask_user` **bloqueia** via `Promise` ate o cliente chamar `respondToAskUser()`. O `pendingMap` e criado externamente (em `query.ts`, PRP-044) e compartilhado por referencia.

## Especificacao

### Feature F-108 — createAskUserMcpServer() + handler bloqueante

Criar `src/ask-user/server.ts` com a factory e o handler.

**Interface da factory:**

```typescript
import { randomUUID } from "node:crypto"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { McpSdkServerConfig } from "../mcp.js"
import { tool, createSdkMcpServer } from "../mcp.js"
import type { AskUserRequest, AskUserAnswer } from "./types.js"
import type { AskUserInput } from "./schema.js"
import { askUserSchema } from "./schema.js"

export type AskUserEmitter = (request: AskUserRequest) => void

export async function createAskUserMcpServer(options: {
  onAskUser: AskUserEmitter
  pendingMap: Map<string, (answer: AskUserAnswer) => void>
  timeoutMs?: number
}): Promise<McpSdkServerConfig>
```

**Parametros:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `onAskUser` | `AskUserEmitter` | Callback chamado quando o agente invoca `ask_user` — repassa ao cliente via `Query.onAskUser` |
| `pendingMap` | `Map<string, resolve>` | Mapa compartilhado entre server e `Query.respondToAskUser()` |
| `timeoutMs` | `number \| undefined` | Se definido, cancela com `{ type: "cancelled" }` apos N ms |

**Handler da tool:**

```typescript
const handler = async (args: AskUserInput): Promise<CallToolResult> => {
  if (options.pendingMap.size > 0) {
    return {
      content: [{ type: "text", text: "Error: previous question not yet answered. Wait for the user to respond before asking another question." }],
      isError: true,
    }
  }

  const callId = randomUUID()

  const answer = await new Promise<AskUserAnswer>((resolve) => {
    options.pendingMap.set(callId, resolve)

    options.onAskUser({
      callId,
      question: args.question,
      context: args.context,
      inputType: args.inputType ?? "text",
      choices: args.choices,
      placeholder: args.placeholder,
    })

    if (options.timeoutMs !== undefined) {
      setTimeout(() => {
        if (options.pendingMap.has(callId)) {
          options.pendingMap.get(callId)!({ type: "cancelled" })
          options.pendingMap.delete(callId)
        }
      }, options.timeoutMs)
    }
  })

  options.pendingMap.delete(callId)

  return {
    content: [{ type: "text", text: formatAnswer(answer, options.timeoutMs) }],
  }
}
```

**Registro da tool e criacao do server:**

```typescript
const askUserTool = tool(
  "ask_user",
  "Ask the user a question and wait for their response. Use when you need clarification, missing information, or explicit confirmation.",
  askUserSchema.shape,
  handler,
)

return createSdkMcpServer({
  name: "ask_user",
  tools: [askUserTool],
})
```

Regras:
- `askUserSchema` e `z.object(...)` — `.shape` retorna `ZodRawShape`, compativel com overload 1 de `tool()`. Nao precisa da overload `ZodTypeAny`
- `randomUUID()` de `node:crypto`
- `pendingMap.delete(callId)` apos o await garante limpeza mesmo sem timeout
- Timeout resolve com `{ type: "cancelled" }` — handler continua normalmente e formata a resposta

### Feature F-109 — formatAnswer()

Funcao exportada que converte `AskUserAnswer` em texto legivel pelo modelo.

```typescript
export function formatAnswer(answer: AskUserAnswer, timeoutMs?: number): string {
  switch (answer.type) {
    case "text":
      return `User answered: ${answer.value}`
    case "number":
      return `User answered: ${answer.value}`
    case "boolean":
      return `User answered: ${answer.value ? "yes" : "no"}`
    case "choice":
      return `User chose: ${answer.id}`
    case "cancelled":
      if (timeoutMs !== undefined) {
        return `User did not respond within ${Math.round(timeoutMs / 1000)}s.`
      }
      return "User cancelled the question."
  }
}
```

Regras:
- Retorna texto plano legivel pelo modelo
- `cancelled` distingue entre timeout (com duracao) e cancelamento explicito (sem)
- `choice` retorna `id` (nao `label`) — o modelo pode mapear de volta via o schema

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| Agente invoca `ask_user({ question: "Qual dia?" })` | Handler bloqueia, emite `AskUserRequest` com `callId` |
| Cliente chama `respondToAskUser(callId, { type: "text", value: "Terca" })` | Handler resolve, retorna `"User answered: Terca"` |
| Agente invoca `ask_user` com pergunta pendente | Retorna `CallToolResult` com `isError: true` imediatamente |
| `timeoutMs: 30000` e cliente nao responde em 30s | Handler resolve com `"User did not respond within 30s."` |
| Cliente chama `respondToAskUser(callId, { type: "cancelled" })` | Handler resolve com `"User cancelled the question."` |
| `formatAnswer({ type: "boolean", value: true })` | `"User answered: yes"` |
| `formatAnswer({ type: "choice", id: "opt-2" })` | `"User chose: opt-2"` |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-108 | askUserServer | `createAskUserMcpServer()` com handler bloqueante via Promise, concurrent guard e timeout opcional |
| F-109 | formatAnswer | `formatAnswer()` cobrindo 5 variantes de `AskUserAnswer` com distincao timeout/cancelamento |

## Limites

- NAO criar multiplos pending por vez — concurrent guard rejeita com `isError: true`
- NAO fazer polling ou retry no handler — bloqueia via Promise puro
- NAO alterar `src/mcp.ts` — usar `tool()` e `createSdkMcpServer()` como estao
- NAO alterar nenhum outro arquivo alem de `src/ask-user/server.ts`
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO importar `mergeSystemPromptAppend` — responsabilidade de PRP-044

## Dependencias

Depende de **PRP-042** (types e schema precisam existir para imports). **Bloqueante para PRP-044** (integracao em query.ts importa `createAskUserMcpServer`).
