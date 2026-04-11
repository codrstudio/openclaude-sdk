# openclaude-sdk - MCP Server ask_user com Pending Map e Concurrent Guard

Implementar `createAskUserMcpServer()` que registra a tool `ask_user` como MCP server in-process, com handler bloqueante via Promise, formatacao de resposta e guarda contra perguntas concorrentes.

---

## Objetivo

Resolver D-085 (score 9) e D-091 (score 6): criar `src/ask-user/server.ts` com o nucleo da feature — o handler que bloqueia ate o cliente responder, o formatador de respostas, e a protecao contra invocacoes concorrentes.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-085 | `createAskUserMcpServer()` com pending map e `formatAnswer()` |
| 2 | D-091 | Guard: se `ask_user` invocado com pergunta pendente, retorna erro |

**Dependencia**: S-069 (types + schema).

---

## Estado Atual

**Referencia**: `src/display/server.ts` (linhas 5-10)

```typescript
export async function createDisplayMcpServer(): Promise<McpSdkServerConfig> {
  return createSdkMcpServer({
    name: "display",
    tools: createDisplayTools(),
  })
}
```

O `createSdkMcpServer()` em `src/mcp.ts` (linhas 34-71) aceita `{ name, version?, tools? }` e retorna `McpSdkServerConfig`. Cada tool e registrada via `tool()` factory (linhas 120-160) que aceita `ZodRawShape` ou `ZodTypeAny`.

---

## Implementacao

### 1. Criar `src/ask-user/server.ts`

**Interface da factory**:

```typescript
import type { McpSdkServerConfig } from "../mcp.js"
import type { AskUserRequest, AskUserAnswer } from "./types.js"

export type AskUserEmitter = (request: AskUserRequest) => void

export async function createAskUserMcpServer(options: {
  onAskUser: AskUserEmitter
  pendingMap: Map<string, (answer: AskUserAnswer) => void>
  timeoutMs?: number
}): Promise<McpSdkServerConfig>
```

**Parametros**:

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `onAskUser` | `AskUserEmitter` | Callback chamado quando o agente invoca `ask_user` — repassa ao cliente via `Query.onAskUser` |
| `pendingMap` | `Map<string, resolve>` | Mapa compartilhado entre server e `Query.respondToAskUser()` |
| `timeoutMs` | `number \| undefined` | Se definido, cancela com `{ type: "cancelled" }` apos N ms |

**Nota**: `pendingMap` e criado externamente (em `query.ts`) e compartilhado por referencia — o server seta o resolve, o `respondToAskUser` chama o resolve.

### 2. Handler da tool `ask_user`

```typescript
const handler = async (args: AskUserInput): Promise<CallToolResult> => {
  // Concurrent guard
  if (pendingMap.size > 0) {
    return {
      content: [{ type: "text", text: "Error: previous question not yet answered. Wait for the user to respond before asking another question." }],
      isError: true,
    }
  }

  const callId = randomUUID()

  const answer = await new Promise<AskUserAnswer>((resolve) => {
    pendingMap.set(callId, resolve)

    // Emit to client
    onAskUser({
      callId,
      question: args.question,
      context: args.context,
      inputType: args.inputType ?? "text",
      choices: args.choices,
      placeholder: args.placeholder,
    })

    // Optional timeout
    if (timeoutMs !== undefined) {
      setTimeout(() => {
        if (pendingMap.has(callId)) {
          pendingMap.get(callId)!({ type: "cancelled" })
          pendingMap.delete(callId)
        }
      }, timeoutMs)
    }
  })

  pendingMap.delete(callId)

  return {
    content: [{ type: "text", text: formatAnswer(answer, timeoutMs) }],
  }
}
```

**Regras**:
- `randomUUID()` de `node:crypto`
- O `pendingMap.delete(callId)` apos o await garante limpeza mesmo sem timeout
- O timeout resolve com `{ type: "cancelled" }` — o handler continua normalmente e formata a resposta

### 3. `formatAnswer()`

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

**Regras**:
- Retorna texto plano legivel pelo modelo
- `cancelled` distingue entre timeout (com duracao) e cancelamento explicito (sem)
- `choice` retorna `id` (nao `label`) — o modelo pode mapear de volta via o schema

### 4. Registro via `tool()` e `createSdkMcpServer()`

```typescript
import { tool, createSdkMcpServer } from "../mcp.js"
import { askUserSchema } from "./schema.js"

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

**Nota**: `askUserSchema` e `z.object(...)` — logo `.shape` retorna `ZodRawShape`, compativel com a overload 1 de `tool()`. Nao precisa da overload `ZodTypeAny`.

---

## Criterios de Aceite

- [ ] `src/ask-user/server.ts` existe com `createAskUserMcpServer()`
- [ ] Handler bloqueia via `Promise` ate `respondToAskUser` resolver
- [ ] `pendingMap` e externo (criado em `query.ts`), compartilhado por referencia
- [ ] Concurrent guard: se `pendingMap.size > 0`, retorna `CallToolResult` com `isError: true`
- [ ] `formatAnswer()` cobre 5 variantes de `AskUserAnswer`
- [ ] Timeout opcional resolve com `{ type: "cancelled" }` apos `timeoutMs`
- [ ] Timeout distingue de cancelamento explicito na mensagem formatada
- [ ] `randomUUID()` de `node:crypto` gera `callId`
- [ ] Tool registrada como `"ask_user"` via `tool()` + `createSdkMcpServer()`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `src/ask-user/server.ts` | S-070 |
| `createAskUserMcpServer()` | S-070 |
| `formatAnswer()` | S-070 |
| `AskUserEmitter` | S-070 |
| Concurrent guard | S-070 |
| Discovery | D-085, D-091 |
