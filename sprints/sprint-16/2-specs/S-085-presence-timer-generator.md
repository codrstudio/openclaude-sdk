# openclaude-sdk - Timer de presenca integrado ao lifecycleGenerator

Spec do timer de heartbeat, fila, Promise.race para emissao gap-aware, e cleanup no finally.

---

## Objetivo

Resolve D-114, D-115, D-116.

| Problema | Consequencia |
|----------|-------------|
| Nenhum heartbeat e emitido durante gaps do CLI | Watchdogs de clientes SSE abortam conexoes vivas |
| `for await` bloqueia durante gaps — heartbeats acumulam sem chegar ao consumer | Feature inutil se heartbeats so saem apos proxima mensagem real |
| Timer pode vazar se o turno terminar sem cleanup | Leak de recursos em processos long-running |

---

## Estado Atual

### `src/query.ts` — `lifecycleGenerator()`

- Funcao `async function* lifecycleGenerator()` (linha 216)
- Loop principal: `for await (const msg of stream)` (linha 310)
- Dentro do loop: filtra `control_response` internamente, faz `yield msg` para o resto
- Bloco `finally` (linha 322): chama `await stopOnce()` para parar SDK servers

### Fluxo atual

```
spawn CLI → for await (msg of stream) → yield msg → finally { stopOnce() }
```

Nenhuma logica de heartbeat existe.

---

## Implementacao

### 1. Constantes e estado do heartbeat

Dentro de `lifecycleGenerator()`, apos o spawn do CLI (apos linha 305) e antes do `for await`:

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

### Regras do timer

- Timer e um `setInterval`, nao `setTimeout` encadeado
- Primeiro heartbeat sai no primeiro tick (apos `HEARTBEAT_INTERVAL_MS` ms), nao imediatamente
- `seq` e 1-indexed: primeiro heartbeat tem `seq === 1`
- `ts` e capturado no momento do push, nao do drain
- `elapsedMs` usa `Date.now() - turnStart` no momento do push
- Timer so e criado se `heartbeatEnabled === true`

### 2. Drain helper

```typescript
function* drainHeartbeats(): Generator<SDKPresenceMessage> {
  while (heartbeatQueue.length > 0) {
    yield heartbeatQueue.shift()!
  }
}
```

### 3. Loop com Promise.race (gap-aware)

Substituir o `for await (const msg of stream)` por um loop com `Promise.race`:

```typescript
const iter = stream[Symbol.asyncIterator]()
let done = false

while (!done) {
  const nextPromise = iter.next()

  if (!heartbeatEnabled) {
    const result = await nextPromise
    if (result.done) break
    const obj = result.value as Record<string, unknown>
    if (obj["type"] === "control_response" && typeof obj["responseId"] === "string") {
      const entry = pendingRequests.get(obj["responseId"])
      if (entry) {
        pendingRequests.delete(obj["responseId"])
        entry.resolve(obj["data"])
      }
      continue
    }
    yield result.value
    continue
  }

  while (true) {
    const heartbeatReady = new Promise<"heartbeat">((resolve) => {
      if (heartbeatQueue.length > 0) {
        resolve("heartbeat")
        return
      }
      const check = setInterval(() => {
        if (heartbeatQueue.length > 0) {
          clearInterval(check)
          resolve("heartbeat")
        }
      }, 100)
      nextPromise.then(() => clearInterval(check)).catch(() => clearInterval(check))
    })

    const winner = await Promise.race([
      nextPromise.then(() => "next" as const),
      heartbeatReady,
    ])

    if (winner === "heartbeat") {
      yield* drainHeartbeats()
      continue
    }

    break
  }

  const result = await nextPromise
  if (result.done) {
    done = true
    break
  }

  yield* drainHeartbeats()

  const obj = result.value as Record<string, unknown>
  if (obj["type"] === "control_response" && typeof obj["responseId"] === "string") {
    const entry = pendingRequests.get(obj["responseId"])
    if (entry) {
      pendingRequests.delete(obj["responseId"])
      entry.resolve(obj["data"])
    }
    continue
  }

  yield result.value
}

yield* drainHeartbeats()
```

### Regras do Promise.race

- O polling da fila usa `setInterval(100)` — 100ms e barato e garante latencia maxima de 100ms para heartbeats
- O `clearInterval` do check interno e feito tanto quando a fila tem itens quanto quando `nextPromise` resolve — evita leak
- Quando `winner === "heartbeat"`: drena fila e volta ao `Promise.race` (nao consome `nextPromise`)
- Quando `winner === "next"`: drena fila residual, processa mensagem real, segue o loop
- Apos o loop terminar (`result.done`): drena fila final para capturar heartbeats acumulados no ultimo gap

### 4. Cleanup no finally

Alterar o bloco `finally` existente:

```typescript
finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  await stopOnce()
}
```

### Regras do cleanup

- `clearInterval` antes de `stopOnce()` — garante que nenhum heartbeat e empurrado na fila apos o generator fechar
- `heartbeatTimer` pode ser `null` (se heartbeat desabilitado) — check antes de clear
- O `drainHeartbeats()` final antes do `finally` garante que heartbeats acumulados durante o ultimo gap nao se perdem

### 5. Import necessario

Adicionar import de `SDKPresenceMessage` no topo de `query.ts`:

```typescript
import type { SDKMessage, SDKSystemMessage, SDKPresenceMessage, PermissionMode } from "./types/messages.js"
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/query.ts` | Timer + fila + Promise.race no `lifecycleGenerator()`, cleanup no `finally`, import de `SDKPresenceMessage` |

---

## Criterios de Aceite

- [ ] Timer emite heartbeats a cada `presenceIntervalMs` ms (default 15000)
- [ ] Heartbeats chegam ao consumer durante gaps longos do CLI (nao acumulam na fila)
- [ ] `presenceIntervalMs: 0` — nenhum timer criado, zero mensagens `type: "presence"`
- [ ] `presenceIntervalMs: undefined` — timer com 15000ms (default)
- [ ] `seq` e monotonic crescente: 1, 2, 3, ... dentro de um turno
- [ ] `elapsedMs` e consistente com tempo real (+/- 200ms)
- [ ] `ts` e Unix timestamp valido em ms
- [ ] Timer limpo no `finally` — `clearInterval` chamado
- [ ] Sem leak de timers quando o turno termina normalmente ou por abort
- [ ] Logica de `control_response` preservada intacta
- [ ] `tsc --noEmit` passa

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| Timer + heartbeatQueue | S-085 |
| drainHeartbeats() | S-085 |
| Promise.race loop | S-085 |
| clearInterval no finally | S-085 |
| D-114 | S-085 |
| D-115 | S-085 |
| D-116 | S-085 |
