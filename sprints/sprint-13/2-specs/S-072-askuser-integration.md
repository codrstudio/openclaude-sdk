# openclaude-sdk - Integracao askUser em Options, Query e query.ts

Adicionar `askUser?: boolean` e `askUserTimeoutMs?: number` a `Options`, expor `onAskUser()` e `respondToAskUser()` no `Query`, e integrar tudo em `query.ts` seguindo o padrao de `richOutput`.

---

## Objetivo

Resolver D-082 (score 9), D-088 (score 9), D-089 (score 9) e D-090 (score 9): flag de entrada, metodos de interacao no Query, e wiring completo em query.ts.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-082 | `Options.askUser?: boolean` + `Options.askUserTimeoutMs?: number` |
| 2 | D-088 | `Query.onAskUser(handler)` — subscreve perguntas do agente |
| 3 | D-089 | `Query.respondToAskUser(callId, answer)` — desbloqueia handler pendente |
| 4 | D-090 | Hook em `lifecycleGenerator()`: criar server + merge prompt + expor metodos |

**Dependencia**: S-069 (types), S-070 (server), S-071 (prompt + barrel).

---

## Estado Atual

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

**Arquivo**: `src/query.ts`, `lifecycleGenerator()` (linhas 207-279)

Bloco richOutput existente (linhas 212-227):

```typescript
if (optionsForCli.richOutput) {
  const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
    await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()
  // ... merge em mcpServers e systemPrompt
}
```

---

## Implementacao

### 1. Adicionar flags a `Options`

**Arquivo**: `src/types/options.ts`

Apos `richOutput?: boolean` (linha 307), adicionar:

```typescript
  richOutput?: boolean
  askUser?: boolean
  askUserTimeoutMs?: number
```

**Regras**:
- `askUser` default `false` (omitido = desligado)
- `askUserTimeoutMs` default `undefined` (sem timeout — bloqueia indefinidamente)
- Zero overhead quando `askUser` e `false` ou ausente

### 2. Adicionar metodos ao `Query`

**Arquivo**: `src/query.ts`, interface `Query` (linhas 38-75)

Adicionar ao final da interface:

```typescript
  onAskUser(handler: (request: AskUserRequest) => void): void
  respondToAskUser(callId: string, answer: AskUserAnswer): void
```

**Regras**:
- `onAskUser` armazena o callback — apenas um handler por vez (ultimo ganha)
- `respondToAskUser` busca o `callId` no `pendingAskUserMap`; se encontrar, chama o resolve; se nao, `console.warn` e retorna (no-op)
- Import de `AskUserRequest` e `AskUserAnswer` de `./ask-user/types.js`

### 3. Implementar no corpo de `query()`

**Estado interno** (dentro de `query()`, antes de `lifecycleGenerator()`):

```typescript
let askUserHandler: ((request: AskUserRequest) => void) | null = null
const pendingAskUserMap = new Map<string, (answer: AskUserAnswer) => void>()
```

**Metodos no objeto Query retornado**:

```typescript
const q = lifecycleGenerator() as Query

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

### 4. Hook em `lifecycleGenerator()`

**Arquivo**: `src/query.ts`, dentro de `lifecycleGenerator()`, apos o bloco `richOutput` (linha 227)

```typescript
// Ask user hook (inside async context, after richOutput)
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

**Regras**:
- Import dinamico — zero overhead quando `askUser: false`
- `mergeSystemPromptAppend` importado de `./display/prompt.js` (ja existe la, reutilizar)
- Se `richOutput` e `askUser` estao ambos `true`, ambos os prompts sao appendados (ortogonais)
- Se `askUserHandler` nao foi registrado quando o agente invoca `ask_user`, emite warn (o handler da tool vai bloquear ate timeout ou indefinidamente)
- `optionsForCli` atualizado in-place seguindo o padrao do bloco richOutput

### 5. Ortogonalidade com richOutput

Os dois built-ins sao independentes:

| Cenario | MCP servers registrados | System prompt appends |
|---------|------------------------|----------------------|
| Ambos `false` | nenhum built-in | nenhum |
| `richOutput: true` | `display` | `DISPLAY_SYSTEM_PROMPT` |
| `askUser: true` | `ask_user` | `ASK_USER_SYSTEM_PROMPT` |
| Ambos `true` | `display` + `ask_user` | ambos concatenados |

---

## Criterios de Aceite

- [ ] `Options.askUser?: boolean` existe em `src/types/options.ts`
- [ ] `Options.askUserTimeoutMs?: number` existe em `src/types/options.ts`
- [ ] `Query.onAskUser(handler)` declarado na interface e implementado
- [ ] `Query.respondToAskUser(callId, answer)` declarado na interface e implementado
- [ ] `respondToAskUser` com `callId` desconhecido faz `console.warn` + no-op (nao throw)
- [ ] Hook em `lifecycleGenerator()` cria server via import dinamico (zero overhead)
- [ ] `mergeSystemPromptAppend` reutilizado de `./display/prompt.js`
- [ ] Warn se `onAskUser` nao registrado quando agente invoca tool
- [ ] Warn se `mcpServers` ja tem chave `"ask_user"`
- [ ] Ortogonal a `richOutput` — ambos podem estar ligados simultaneamente
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `Options.askUser` | S-072 |
| `Options.askUserTimeoutMs` | S-072 |
| `Query.onAskUser()` | S-072 |
| `Query.respondToAskUser()` | S-072 |
| `src/query.ts` (lifecycleGenerator) | S-072 |
| `pendingAskUserMap` | S-072 |
| Discovery | D-082, D-088, D-089, D-090 |
