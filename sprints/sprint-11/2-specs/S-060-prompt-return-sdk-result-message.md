# openclaude-sdk - Retornar SDKResultMessage Completo em prompt()

Ajustar `prompt()` one-shot para retornar `SDKResultMessage` completo em vez de subconjunto parcial.

---

## Objetivo

Resolver D-068 (score 4): o TASK.md especifica `Promise<SDKResultMessage>` como retorno de `prompt()`, mas a implementacao retorna `{ result, sessionId, costUsd, durationMs }` — um subconjunto que omite campos uteis como `is_error`, `subtype`, `usage`, `num_turns`, `permission_denials` e `structured_output`.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Retorno parcial em `prompt()` | Campos como `is_error`, `usage`, `structured_output` inacessiveis |
| 2 | Tipo de retorno customizado | Consumidores nao podem tipar como `SDKResultMessage` |

---

## Estado Atual

**Arquivo**: `src/session-v2.ts`, linhas 189-205

```typescript
export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}> {
  const q = query({ ... })
  return collectMessages(q)
}
```

O `collectMessages()` em `src/query.ts` ja retorna `{ messages, result, sessionId, costUsd, durationMs }`. Nenhum dos dois expoe o `SDKResultMessage` original.

---

## Implementacao

### 1. Alterar retorno de prompt()

**Arquivo**: `src/session-v2.ts`

**Antes:**

```typescript
export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<{
  result: string | null
  sessionId: string | null
  costUsd: number
  durationMs: number
}>
```

**Depois:**

```typescript
export interface PromptResult {
  /** Texto do resultado (convenience) */
  result: string | null
  /** ID da sessao usada */
  sessionId: string | null
  /** Custo total em USD */
  costUsd: number
  /** Duracao total em ms */
  durationMs: number
  /** Mensagem de resultado completa do CLI */
  resultMessage: SDKResultMessage | null
}

export async function prompt(
  text: string,
  opts: PromptOptions = {},
): Promise<PromptResult>
```

### 2. Capturar SDKResultMessage durante iteracao

Em vez de usar `collectMessages()` diretamente, iterar o `Query` para capturar a mensagem de tipo `result`:

```typescript
export async function prompt(text: string, opts: PromptOptions = {}): Promise<PromptResult> {
  const q = query({ prompt: text, model: opts.model, registry: opts.registry, options: opts.options })
  const collected = await collectMessages(q)

  // Encontrar a SDKResultMessage nas mensagens coletadas
  const resultMessage = collected.messages.find(
    (m): m is SDKResultMessage => m.type === "result"
  ) ?? null

  return {
    result: collected.result,
    sessionId: collected.sessionId,
    costUsd: collected.costUsd,
    durationMs: collected.durationMs,
    resultMessage,
  }
}
```

### 3. Importar tipo

**Arquivo**: `src/session-v2.ts`

Adicionar `SDKResultMessage` ao import de `./types/messages.js`.

### 4. Exportar PromptResult

**Arquivo**: `src/index.ts`

Adicionar `PromptResult` aos exports.

---

## Criterios de Aceite

- [ ] `prompt()` retorna `PromptResult` com campo `resultMessage: SDKResultMessage | null`
- [ ] Campos existentes (`result`, `sessionId`, `costUsd`, `durationMs`) mantidos para compatibilidade
- [ ] `PromptResult` exportado no `index.ts`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `prompt()` | S-060 |
| `PromptResult` | S-060 |
| `src/session-v2.ts` | S-060 |
| `src/index.ts` | S-060 |
| Discovery | D-068 |
