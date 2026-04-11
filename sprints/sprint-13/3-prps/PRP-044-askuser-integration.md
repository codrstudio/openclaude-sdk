# PRP-044 — askUser Integration: Options, Query, query.ts

## Objetivo

Adicionar `askUser?: boolean` e `askUserTimeoutMs?: number` a `Options`, expor `onAskUser()` e `respondToAskUser()` no `Query`, e integrar tudo em `query.ts` seguindo o padrao de `richOutput`.

Referencia: spec S-072 (D-082, D-088, D-089, D-090).

## Execution Mode

`implementar`

## Contexto

O modulo `src/ask-user/` (PRP-042 + PRP-043) expoe:
- `AskUserRequest`, `AskUserAnswer` — tipos do contrato
- `createAskUserMcpServer()` — factory do MCP server com handler bloqueante
- `ASK_USER_SYSTEM_PROMPT` — prompt de sistema

A integracao segue o padrao identico ao `richOutput` (PRP-041, sprint-12):

**Arquivo**: `src/types/options.ts`, interface `Options` (linhas 268-318)

```typescript
export interface Options {
  // ...
  richOutput?: boolean                    // linha 307
  // ...
}
```

**Arquivo**: `src/query.ts`, `Query` interface (linhas 38-75)

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  close(): Promise<void>
  interrupt(): void
  streamInput(text: string): void
  respondToPermission(toolUseId: string, allowed: boolean): void
  // ... outros metodos
}
```

**Arquivo**: `src/query.ts`, `lifecycleGenerator()` (linhas 207-279) — bloco richOutput existente (linhas 212-227):

```typescript
if (optionsForCli.richOutput) {
  const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
    await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()
  // ... merge em mcpServers e systemPrompt
}
```

## Especificacao

### Feature F-110 — Options.askUser e Options.askUserTimeoutMs

**Arquivo**: `src/types/options.ts`

Apos `richOutput?: boolean`, adicionar:

```typescript
  richOutput?: boolean
  askUser?: boolean
  askUserTimeoutMs?: number
```

Regras:
- `askUser` default `false` (omitido = desligado)
- `askUserTimeoutMs` default `undefined` (sem timeout — bloqueia indefinidamente)
- Zero overhead quando `askUser` e `false` ou ausente

### Feature F-111 — Query.onAskUser() e Query.respondToAskUser()

**Arquivo**: `src/query.ts`

**1. Import de tipos** (no topo do arquivo, zona de imports de tipo):

```typescript
import type { AskUserRequest, AskUserAnswer } from "./ask-user/types.js"
```

**2. Adicionar metodos a interface `Query`** (linhas 38-75, ao final):

```typescript
  onAskUser(handler: (request: AskUserRequest) => void): void
  respondToAskUser(callId: string, answer: AskUserAnswer): void
```

**3. Estado interno** (dentro de `query()`, antes de `lifecycleGenerator()`):

```typescript
let askUserHandler: ((request: AskUserRequest) => void) | null = null
const pendingAskUserMap = new Map<string, (answer: AskUserAnswer) => void>()
```

**4. Metodos no objeto Query retornado** (apos `const q = lifecycleGenerator() as Query`):

```typescript
q.onAskUser = (handler) => {
  askUserHandler = handler
}

q.respondToAskUser = (callId, answer) => {
  const resolve = pendingAskUserMap.get(callId)
  if (!resolve) {
    console.warn(`[openclaude-sdk] respondToAskUser: unknown callId "${callId}"`)
    return
  }
  pendingAskUserMap.delete(callId)
  resolve(answer)
}
```

Regras:
- `onAskUser` armazena callback — ultimo handler ganha (nao e multi-subscriber)
- `respondToAskUser` com `callId` desconhecido faz `console.warn` e retorna (no-op, nao throw)
- `pendingAskUserMap` e o mesmo `Map` passado por referencia para `createAskUserMcpServer()`

### Feature F-112 — Hook em lifecycleGenerator()

**Arquivo**: `src/query.ts`, dentro de `lifecycleGenerator()`, apos o bloco `richOutput` (linha 227)

```typescript
if (optionsForCli.askUser) {
  const { createAskUserMcpServer, ASK_USER_SYSTEM_PROMPT } =
    await import("./ask-user/index.js")
  const { mergeSystemPromptAppend } = await import("./display/prompt.js")

  const askUserServer = await createAskUserMcpServer({
    onAskUser: (request) => {
      if (askUserHandler) {
        askUserHandler(request)
      } else {
        console.warn("[openclaude-sdk] ask_user invoked but no onAskUser handler registered")
      }
    },
    pendingMap: pendingAskUserMap,
    timeoutMs: optionsForCli.askUserTimeoutMs,
  })

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("ask_user" in existingServers) {
    console.warn('[openclaude-sdk] askUser: overriding existing "ask_user" MCP server')
  }

  optionsForCli = {
    ...optionsForCli,
    mcpServers: { ...existingServers, ask_user: askUserServer },
    systemPrompt: mergeSystemPromptAppend(optionsForCli.systemPrompt, ASK_USER_SYSTEM_PROMPT),
  }
}
```

Regras:
- Import dinamico — zero overhead quando `askUser: false`
- `mergeSystemPromptAppend` importado de `./display/prompt.js` (ja existe la, reutilizar)
- Se `richOutput` e `askUser` estao ambos `true`, ambos os prompts sao appendados (ortogonais)
- Se `askUserHandler` nao foi registrado quando o agente invoca `ask_user`, emite warn
- `optionsForCli` reatribuido (nao `resolvedOptions`) — seguindo padrao do bloco richOutput

### Ortogonalidade com richOutput

| Cenario | MCP servers registrados | System prompt appends |
|---------|------------------------|----------------------|
| Ambos `false` | nenhum built-in | nenhum |
| `richOutput: true` | `display` | `DISPLAY_SYSTEM_PROMPT` |
| `askUser: true` | `ask_user` | `ASK_USER_SYSTEM_PROMPT` |
| Ambos `true` | `display` + `ask_user` | ambos concatenados |

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `query({ prompt: "...", options: {} })` | Funciona, zero overhead |
| `query({ prompt: "...", options: { askUser: true } })` | ask_user server + system prompt injetados |
| `query({ ..., options: { askUser: true, askUserTimeoutMs: 30000 } })` | Timeout de 30s em perguntas sem resposta |
| `query({ ..., options: { askUser: true, richOutput: true } })` | Ambos servers + ambos prompts |
| `query({ ..., options: { askUser: true, mcpServers: { ask_user: ... } } })` | Warn + override |
| `q.onAskUser(handler)` antes do agente invocar | Handler chamado com `AskUserRequest` |
| `q.respondToAskUser("unknown-id", ...)` | `console.warn` + no-op |
| Agente invoca `ask_user` sem `onAskUser` registrado | `console.warn`, handler bloqueia ate timeout |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-110 | askUserOptionsFlags | `askUser?: boolean` e `askUserTimeoutMs?: number` na interface `Options` |
| F-111 | queryAskUserMethods | `onAskUser()` e `respondToAskUser()` declarados e implementados no `Query` |
| F-112 | lifecycleAskUserHook | Hook em `lifecycleGenerator()` que injeta ask_user server + system prompt quando `askUser: true` |

## Limites

- NAO alterar `src/ask-user/types.ts`, `src/ask-user/schema.ts`, `src/ask-user/server.ts`, `src/ask-user/prompt.ts` — escopo de PRP-042 e PRP-043
- NAO alterar `src/mcp.ts` — escopo de PRP-039 (sprint-12)
- NAO alterar `src/index.ts` — escopo de PRP-045
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO implementar multi-subscriber para `onAskUser` — ultimo handler ganha
- NAO implementar perguntas concorrentes — primeiro release aceita uma por vez

## Dependencias

Depende de **PRP-042** (types, schema, prompt, barrel) e **PRP-043** (server). **Bloqueante para PRP-045** (exports e README dependem da integracao completa para o exemplo funcionar).
