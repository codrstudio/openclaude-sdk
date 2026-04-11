# openclaude-sdk - SDKPresenceMessage: tipo e discriminated union

Spec do novo tipo `SDKPresenceMessage` e sua inclusao no union `SDKMessage`.

---

## Objetivo

Resolve D-112.

| Problema | Consequencia |
|----------|-------------|
| Nao existe tipo para representar heartbeats de presenca no SDK | Consumidores nao tem como receber sinais de liveness durante gaps do CLI |
| O discriminated union `SDKMessage` nao inclui mensagens de presenca | Impossible fazer type narrowing `msg.type === "presence"` |

---

## Estado Atual

### `src/types/messages.ts`

- O union `SDKMessage` tem 21 tipos (assistant, user, result, system variants, stream_event, tool_progress, auth_status, rate_limit_event, tool_use_summary, prompt_suggestion)
- Nenhum tipo com `type: "presence"` existe
- O discriminante principal e o campo `type` (string literal)

---

## Implementacao

### 1. Adicionar `SDKPresenceMessage` em `src/types/messages.ts`

Antes do bloco de comentario `// Union de todas as mensagens`:

```typescript
export interface SDKPresenceMessage {
  type: "presence"
  ts: number
  seq: number
  elapsedMs: number
}
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `type` | `"presence"` | Discriminante do union — literal fixo |
| `ts` | `number` | Unix timestamp em ms no momento do emit |
| `seq` | `number` | Sequencia monotonica dentro do turno, 1-indexed, zera entre turnos |
| `elapsedMs` | `number` | Ms desde o inicio do turno (`query()` chamado) |

### Regras

- `type` e literal `"presence"` — nao string generico
- `seq` comeca em 1, nao em 0 — primeiro heartbeat emitido no primeiro tick do timer
- `elapsedMs` e relativo ao inicio do `query()`, nao ao inicio do processo
- Interface nao tem `uuid` nem `session_id` — e gerada internamente pelo SDK, nao pelo CLI

### 2. Adicionar ao union `SDKMessage`

```typescript
export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKFilesPersistedEvent
  | SDKRateLimitEvent
  | SDKToolUseSummaryMessage
  | SDKPromptSuggestionMessage
  | SDKPresenceMessage
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/messages.ts` | Novo interface `SDKPresenceMessage` + adicionado ao union `SDKMessage` |

---

## Criterios de Aceite

- [ ] `SDKPresenceMessage` exportado de `src/types/messages.ts`
- [ ] Campos: `type: "presence"`, `ts: number`, `seq: number`, `elapsedMs: number`
- [ ] Presente no union `SDKMessage` como ultimo membro (antes do fechamento)
- [ ] `tsc --noEmit` passa sem erro
- [ ] Type narrowing `if (msg.type === "presence") { msg.seq }` compila sem cast

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `SDKPresenceMessage` interface | S-083 |
| `SDKMessage` union (adicao) | S-083 |
| D-112 | S-083 |
