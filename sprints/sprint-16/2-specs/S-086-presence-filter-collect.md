# openclaude-sdk - Filtro de presence em collectMessages e session-v2

Spec do filtro que impede mensagens de presence de poluir a lista de mensagens coletadas.

---

## Objetivo

Resolve D-117, D-118.

| Problema | Consequencia |
|----------|-------------|
| `collectMessages()` coleta todas as mensagens sem filtro | Batch consumers recebem liveness signals misturados com conteudo semantico |
| `session-v2 collect()` chama `collectMessages()` — herda o problema | Mesmo impacto no V2 API |

---

## Estado Atual

### `src/query.ts` — `collectMessages()`

- Funcao `collectMessages()` (linha 480)
- Loop: `for await (const msg of q)` → `messages.push(msg)` para todas as mensagens
- Nenhum filtro por tipo existe — todas as mensagens sao incluidas no array retornado
- O `msg.type === "result"` e tratado para extrair metadata, mas a mensagem ainda e incluida no array

### `src/session-v2.ts` — `collect()`

- Metodo `collect()` em `createSession()` (linha 93) e `resumeSession()` (linha 166)
- Implementacao: `const result = await collectMessages(q)` — delega inteiramente
- Retorna `result.messages` sem filtro adicional
- Nao ha outro caminho que capture mensagens fora de `collectMessages()`

---

## Implementacao

### 1. Filtro em `collectMessages()`

Adicionar filtro no inicio do loop, antes de `messages.push(msg)`:

```typescript
for await (const msg of q) {
  if (msg.type === "presence") continue

  messages.push(msg)

  // ... resto da logica existente (system init, result, assistant error)
}
```

### Regras

- O filtro usa `msg.type === "presence"` — type narrowing do discriminated union
- O `continue` pula completamente a mensagem — nao e adicionada ao array, nao e processada para metadata
- Mensagens presence nao tem `session_id`, `result`, `error` — nenhuma logica posterior se aplica a elas

### 2. Verificacao de `session-v2 collect()`

✅ Confirmado por inspecao: `session-v2.ts` tem dois metodos `collect()`:

- `createSession().collect()` (linha 93): chama `collectMessages(q)` → herda filtro automaticamente
- `resumeSession().collect()` (linha 166): chama `collectMessages(q)` → herda filtro automaticamente

Nao ha outro caminho que capture mensagens de presence. A funcao `prompt()` (linha 206) tambem chama `collectMessages()`.

Nenhuma mudanca necessaria em `session-v2.ts`.

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/query.ts` | Filtro `if (msg.type === "presence") continue` em `collectMessages()` |
| `src/session-v2.ts` | Nenhuma (verificacao por inspecao — herda filtro via `collectMessages()`) |

---

## Criterios de Aceite

- [ ] `collectMessages()` nao inclui mensagens `type: "presence"` no array `messages` retornado
- [ ] Filtro posicionado antes de `messages.push(msg)` — presence nunca entra no array
- [ ] `session.collect()` em `createSession()` retorna array sem presence (heranca)
- [ ] `session.collect()` em `resumeSession()` retorna array sem presence (heranca)
- [ ] `prompt()` retorna resultado sem presence no `resultMessage` (heranca)
- [ ] Mensagens de outros tipos nao sao afetadas pelo filtro
- [ ] `tsc --noEmit` passa

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| Filtro `collectMessages()` | S-086 |
| Verificacao `session-v2 collect()` | S-086 |
| Verificacao `prompt()` | S-086 |
| D-117 | S-086 |
| D-118 | S-086 |
