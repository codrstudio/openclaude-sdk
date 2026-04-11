# PRP-051 — Presence Heartbeat core: tipo, option, timer e filtro

## Objetivo

Implementar o mecanismo de heartbeat de presenca no SDK: novo tipo `SDKPresenceMessage` no discriminated union, campo `presenceIntervalMs` em `Options`, timer com Promise.race gap-aware no `lifecycleGenerator`, e filtro em `collectMessages()`.

Referencia: specs S-083 (D-112), S-084 (D-113), S-085 (D-114, D-115, D-116), S-086 (D-117, D-118).

## Execution Mode

`implementar`

## Contexto

O `openclaude` CLI tem gaps previsiveis em que nenhum byte flui (gap inicial de 30-120s, gap de tool execution de minutos). Clientes SSE implementam watchdogs que abortam conexoes vivas durante esses gaps. A solucao e emitir um `SDKMessage` de liveness periodico que o consumer trata como quiser.

Um hot-patch existe no demo server (`server.mjs`) com logica local de `setInterval`. Este PRP move a responsabilidade para o SDK, tornando o heartbeat nativo do `query()`.

Estado atual:
- `src/types/messages.ts` — union `SDKMessage` com 21 tipos, sem presence
- `src/types/options.ts` — interface `Options` com 48 campos, sem `presenceIntervalMs`
- `src/query.ts` — `lifecycleGenerator()` com `for await` simples, sem heartbeat, `collectMessages()` sem filtro
- `src/session-v2.ts` — `collect()` delega a `collectMessages()`, herda comportamento

## Especificacao

### Feature F-131 — SDKPresenceMessage tipo e discriminated union

Em `src/types/messages.ts`, adicionar interface antes do union `SDKMessage`:

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
| `type` | `"presence"` | Discriminante literal fixo |
| `ts` | `number` | Unix timestamp em ms no momento do emit |
| `seq` | `number` | Sequencia monotonica dentro do turno, 1-indexed, zera entre turnos |
| `elapsedMs` | `number` | Ms desde o inicio do `query()` |

Adicionar `SDKPresenceMessage` como ultimo membro do union `SDKMessage`.

Regras:
- `type` e literal `"presence"` — NAO string generico
- `seq` comeca em 1, NAO em 0
- `elapsedMs` e relativo ao inicio do `query()`, NAO ao inicio do processo
- Interface NAO tem `uuid`, `session_id` nem outros campos — e gerada internamente pelo SDK

### Feature F-132 — presenceIntervalMs em Options

Em `src/types/options.ts`, apos o campo `locale?: string` e antes de `sandbox`:

```typescript
  /**
   * Intervalo entre heartbeats de presenca em ms. Default: 15000 (15s).
   * Setar para 0 ou valor negativo desabilita o heartbeat.
   *
   * Heartbeats sao emitidos como `SDKMessage` do tipo "presence" e servem
   * pra manter conexoes SSE vivas em UIs de chat. Consumidores que so
   * fazem `collectMessages()` podem ignorar.
   */
  presenceIntervalMs?: number
```

Semantica de ativacao:

| Valor | Comportamento |
|-------|---------------|
| `undefined` | Timer com 15000ms (default) |
| `0` | Sem timer — desabilitado |
| negativo | Sem timer — tratado como desabilitado |
| positivo | Timer com esse valor em ms |

Regras:
- Tipo `number | undefined` — NAO aceita string, NAO aceita boolean
- Valores positivos menores que 1000ms sao aceitos sem floor (debug)
- O campo NAO gera flag CLI — puramente SDK-side
- JSDoc obrigatorio com semantica completa

### Feature F-133 — Timer + Promise.race gap-aware no lifecycleGenerator

Em `src/query.ts`, dentro de `lifecycleGenerator()`:

**1. Constantes e estado** (apos spawn do CLI, antes do loop principal):

```typescript
const intervalMs = resolvedOptions.presenceIntervalMs
const heartbeatEnabled = intervalMs === undefined ? true : intervalMs > 0
const HEARTBEAT_INTERVAL_MS = intervalMs ?? 15_000

const heartbeatQueue: SDKPresenceMessage[] = []
const turnStart = Date.now()
let heartbeatSeq = 0
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

if (heartbeatEnabled) {
  heartbeatTimer = setInterval(() => {
    heartbeatSeq++
    heartbeatQueue.push({
      type: "presence",
      ts: Date.now(),
      seq: heartbeatSeq,
      elapsedMs: Date.now() - turnStart,
    })
  }, HEARTBEAT_INTERVAL_MS)
}
```

**2. Drain helper:**

```typescript
function* drainHeartbeats(): Generator<SDKPresenceMessage> {
  while (heartbeatQueue.length > 0) {
    yield heartbeatQueue.shift()!
  }
}
```

**3. Loop com Promise.race** — substituir o `for await (const msg of stream)` existente:

Quando `heartbeatEnabled === false`: usar o loop original sem modificacao (await direto de `iter.next()`).

Quando `heartbeatEnabled === true`: usar `Promise.race` entre `iter.next()` e um check da fila de heartbeats com polling de 100ms.

Regras do Promise.race:
- O polling da fila usa `setInterval(100)` — 100ms de latencia maxima
- `clearInterval` do check interno feito tanto quando fila tem itens quanto quando `nextPromise` resolve — evita leak
- Quando `winner === "heartbeat"`: drena fila e volta ao `Promise.race` (NAO consome `nextPromise`)
- Quando `winner === "next"`: drena fila residual, processa mensagem real
- Apos o loop terminar (`result.done`): drena fila final
- Logica existente de `control_response` preservada intacta dentro do branch "next"

**4. Cleanup no finally:**

```typescript
finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  await stopOnce()
}
```

- `clearInterval` ANTES de `stopOnce()` — nenhum heartbeat empurrado apos fechar
- Check de null antes de clear (heartbeat pode estar desabilitado)

**5. Import necessario** no topo de `query.ts`:

```typescript
import type { SDKPresenceMessage } from "./types/messages.js"
```

### Feature F-134 — Filtro em collectMessages()

Em `src/query.ts`, na funcao `collectMessages()`, adicionar filtro no inicio do loop antes de `messages.push(msg)`:

```typescript
for await (const msg of q) {
  if (msg.type === "presence") continue

  messages.push(msg)
  // ... resto da logica existente (system init, result, assistant error)
}
```

Regras:
- Filtro usa `msg.type === "presence"` — type narrowing do discriminated union
- `continue` pula completamente — NAO adicionada ao array, NAO processada para metadata
- `session-v2.ts` NAO precisa de mudanca — `collect()` chama `collectMessages()`, herda filtro automaticamente
- Verificar por inspecao que `createSession().collect()`, `resumeSession().collect()` e `prompt()` passam por `collectMessages()` — confirmacao explicita, zero mudanca

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `query()` com gap de 30s, default options | ~2 mensagens `type: "presence"` emitidas durante o gap |
| `query()` com `presenceIntervalMs: 5000` | Heartbeat a cada 5s |
| `query()` com `presenceIntervalMs: 0` | Zero mensagens presence |
| `collectMessages()` com heartbeat ativo | Array retornado NAO contem presence |
| `session.collect()` com heartbeat ativo | Array retornado NAO contem presence (heranca) |
| Timer apos turno terminar | `clearInterval` chamado, sem leak |
| `msg.type === "presence"` narrowing | Compila — `msg.seq`, `msg.ts`, `msg.elapsedMs` acessiveis |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-131 | presenceType | `SDKPresenceMessage` interface + adicionado ao union `SDKMessage` em `src/types/messages.ts` |
| F-132 | presenceOption | `presenceIntervalMs?: number` em `Options` com JSDoc e semantica 0=desabilita |
| F-133 | presenceTimer | Timer + heartbeat queue + Promise.race gap-aware no `lifecycleGenerator` de `src/query.ts` + cleanup no finally |
| F-134 | presenceFilter | Filtro `if (msg.type === "presence") continue` em `collectMessages()` + verificacao session-v2 |

## Limites

- NAO alterar `src/index.ts` — escopo de PRP-052
- NAO criar scripts de teste — escopo de PRP-052
- NAO alterar `.tmp/demo/server.mjs` — escopo de PRP-052
- NAO adicionar testes unitarios (nao ha framework de teste configurado)
- NAO implementar adaptive backoff — intervalo fixo
- NAO implementar heartbeat bidirecional — stream e unidirecional
- NAO emitir heartbeat fora de `query()` ativo — sessions idle nao emitem nada
- NAO emitir heartbeat "zero" imediato no spawn — primeiro sai no primeiro tick do timer

## Dependencias

Nenhuma dependencia de outros PRPs. **Bloqueante para PRP-052** (exports, teste e server relay dependem do tipo e timer existirem).
