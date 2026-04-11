# V2 Session API — Interface simplificada multi-turn

Implementar a V2 session API como sugar layer sobre o `query()` existente.

---

## Contexto

O Claude Code SDK expoe uma V2 API preview com interface simplificada para conversas multi-turn: `createSession`, `resumeSession`, `prompt`. Internamente usa `query()` — e a mesma coisa que nosso `continueSession()` mas com ergonomia diferente.

Nosso `continueSession()` ja resolve o caso de uso principal. A V2 adiciona:
- Objeto `SDKSession` com estado persistente
- `send()` + `stream()` separados (vs prompt unico no query)
- `using` syntax para cleanup automatico
- `prompt()` one-shot convenience

---

## Funcoes a implementar

### 1. `createSession()`

```typescript
function createSession(options: {
  model: string
  // Herda Options relevantes
}): SDKSession
```

### 2. `resumeSession()`

```typescript
function resumeSession(
  sessionId: string,
  options: {
    model: string
  },
): SDKSession
```

### 3. `prompt()` (one-shot)

```typescript
function prompt(
  prompt: string,
  options: {
    model: string
  },
): Promise<SDKResultMessage>
```

---

## SDKSession interface

```typescript
interface SDKSession {
  readonly sessionId: string
  send(message: string | SDKUserMessage): Promise<void>
  stream(): AsyncGenerator<SDKMessage, void>
  close(): void
  [Symbol.asyncDispose](): Promise<void>  // "await using" support
}
```

---

## Implementacao

A V2 e um wrapper fino sobre a V1:

```typescript
function createSession(options): SDKSession {
  let currentQuery: Query | null = null
  const sessionId = options.sessionId ?? crypto.randomUUID()

  return {
    sessionId,

    async send(message) {
      if (currentQuery) {
        // Continuar sessao existente
        currentQuery = query({
          prompt: typeof message === "string" ? message : message.content,
          options: { ...options, resume: sessionId },
        })
      } else {
        currentQuery = query({
          prompt: typeof message === "string" ? message : message.content,
          options: { ...options, sessionId },
        })
      }
    },

    stream() {
      if (!currentQuery) throw new Error("No active query. Call send() first.")
      return currentQuery
    },

    close() {
      currentQuery?.close()
    },

    async [Symbol.asyncDispose]() {
      this.close()
    },
  }
}
```

### prompt() one-shot

```typescript
async function prompt(text, options): Promise<SDKResultMessage> {
  const session = createSession(options)
  await session.send(text)
  let result: SDKResultMessage | null = null
  for await (const msg of session.stream()) {
    if (msg.type === "result") result = msg
  }
  session.close()
  if (!result) throw new ExecutionError("No result message received", ...)
  return result
}
```

---

## Naming

O SDK oficial usa prefixo `unstable_v2_`. Opcoes para nos:

| Opcao | Pro | Contra |
|-------|-----|--------|
| `createSession` / `resumeSession` / `prompt` | Limpo, sem prefixo feio | Conflito se o oficial estabilizar com nome diferente |
| `v2.createSession` | Namespace explicito | Requer objeto intermediario |
| `unstable_v2_createSession` | Compativel com oficial | Nome horrivel |

**Recomendacao**: usar nomes limpos (`createSession`, `resumeSession`, `prompt`) ja que somos um SDK independente e nao temos contrato de compatibilidade com o oficial.

---

## Prioridade

**Baixa** — Nosso `continueSession()` + `query()` ja cobrem o caso de uso. A V2 e ergonomia, nao funcionalidade nova. Implementar depois dos query methods e MCP tools.

---

## Criterios de aceite

- [ ] `createSession()` retorna `SDKSession` funcional
- [ ] `resumeSession()` retoma sessao existente
- [ ] `prompt()` one-shot funciona end-to-end
- [ ] `await using session = createSession(...)` funciona (AsyncDisposable)
- [ ] Multi-turn: `send()` + `stream()` repetidos na mesma sessao
- [ ] Typecheck passa
- [ ] Build passa

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Gap analysis | `.tmp/REPORT-1.md` |
| Claude Code SDK docs | `platform.claude.com/docs/en/agent-sdk/typescript-v2-preview` |
| Funcao existente | `src/query.ts` → `continueSession()` |
