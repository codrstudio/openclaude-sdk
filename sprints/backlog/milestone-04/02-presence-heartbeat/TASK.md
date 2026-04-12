# Presence Heartbeat — mensagem `presence` emitida periodicamente durante `query()`

Adiciona um novo tipo de `SDKMessage` — `SDKPresenceMessage` — emitido pelo
`query()` em intervalos fixos enquanto o turno esta ativo. Serve como sinal
de liveness para consumidores que fazem streaming (UIs de chat, servidores
SSE), evitando que watchdogs do cliente abortem conexoes que estao vivas
mas passando por gaps naturais do modelo.

---

## ⚠️ Implementacao intermediaria ja aplicada (abril 2026)

**Contexto**: um bug de producao (usuario caindo com "Tempo esgotado
aguardando resposta do servidor" durante turnos longos) forcou um hot-patch
antes desta task ser formalmente implementada no SDK. O hot-patch vive no
**demo server** em `.tmp/demo/server.mjs` e no cliente `openclaude-chat`. Esta
secao documenta o que existe hoje e o **contrato de wire format que o
implementador desta task DEVE preservar** para nao quebrar os dois lados.

### O que existe hoje

**Lado server (`.tmp/demo/server.mjs`, funcao `pipeQueryToSSE`)**:
- `HEARTBEAT_INTERVAL_MS = 15_000` (15s) — threshold de quanto tempo sem
  atividade gera um ping
- `HEARTBEAT_POLL_MS = 1_000` (1s) — intervalo do `setInterval` que verifica
  a condicao. Escolha deliberada de **polling 1s em vez de 15s**: um
  `setInterval(15000)` falha em gaps medios (16-29s) porque os ticks
  absolutos podem cair dentro do gap e nenhum tick ver o elapsed >= 15s.
  Com polling de 1s, qualquer gap >= 15s gera exatamente 1 ping quando
  o relogio bate o threshold. Custo: 1 closure check/segundo — irrelevante.
- A cada tick: `if (Date.now() - lastEmitAt >= HEARTBEAT_INTERVAL_MS)` → emit
- Cada emit incrementa `heartbeatSeq` (1-indexed, zera a cada `pipeQueryToSSE`)
- Turn start e capturado na entrada da funcao; `elapsedMs = Date.now() - turnStart`
- `lastEmitAt` e atualizado tanto no heartbeat emit quanto no emit de
  mensagens reais — garante que pings so fluem durante gaps reais
- Cleanup no `finally` do try/catch + no `stream.onAbort`
- **Node http.Server timeouts desabilitados** no server.mjs:
  `httpServer.requestTimeout = 0` e `httpServer.headersTimeout = 0`.
  Motivo: Node 18+ tem default 300s que mata turnos longos independente
  de heartbeat.

**Lado cliente (`openclaude-chat/src/hooks/useOpenClaudeChat.ts`)**:
- `STALL_MS` subiu de 45s pra **90s** (watchdog folgado, reseta a cada chunk)
- `HARD_LIMIT_MS` (60s) **removido inteiro** — nao existe mais hard cap de turno
- Handler SSE ignora silenciosamente `event: ping`, `event: keepalive`,
  `event: heartbeat` — **qualquer um dos tres e aceito** como liveness
- `armStall()` e chamado pra qualquer chunk SSE recebido (inclusive pings),
  renovando o watchdog automaticamente
- Implica: o server pode escolher qualquer um dos 3 nomes. Ate mesmo
  `: keepalive\n\n` (SSE comment line pura, sem `event:` nem `data:`)
  reseta o stall porque conta como chunk recebido no nivel EventSource
  / `fetch + ReadableStream`. Isso da liberdade total pro implementador
  final do SDK escolher o nome que preferir.

### Contrato de wire format (imutavel)

O SSE emitido pelo server **hoje** tem exatamente este shape:

```
event: ping
data: {"ts":1775881234567,"seq":1,"elapsedMs":15000}
```

Campos obrigatorios no `data`:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `ts` | `number` | Unix timestamp em ms no momento do emit |
| `seq` | `number` | Sequencia monotonica dentro do turno, 1-indexed, zera entre turnos |
| `elapsedMs` | `number` | Ms desde o inicio do turno (entrada de `pipeQueryToSSE`) |

**Por que este shape**: e **exatamente** igual ao `SDKPresenceMessage`
especificado nesta task (menos o campo `type: "presence"`, que e
estrutural do discriminated union do SDK e nao vai pro JSON do
`data:` — o nome do SSE event ja identifica).

### Como a implementacao final desta task deve se encaixar

Quando esta task for executada:

1. **SDK**: `query()` passa a emitir `SDKPresenceMessage` via generator
   (conforme especificado acima nesta mesma TASK.md). Campos: `{type: "presence", ts, seq, elapsedMs}`.

2. **server.mjs**: o `pipeQueryToSSE` deve ser **refatorado** pra NAO ter
   mais o `setInterval` proprio. Em vez disso, faz relay dos
   `SDKPresenceMessage` que chegam do SDK:
   ```js
   for await (const msg of q) {
     if (msg.type === "presence") {
       await stream.writeSSE({
         event: "ping",
         data: JSON.stringify({ ts: msg.ts, seq: msg.seq, elapsedMs: msg.elapsedMs }),
       })
       continue
     }
     await stream.writeSSE({ event: "message", data: JSON.stringify(msg) })
   }
   ```
   O `lastEmitAt`/`heartbeatSeq`/`heartbeatTimer` locais podem ser
   removidos — a responsabilidade migra pro SDK.

3. **Cliente (`openclaude-chat`)**: **ZERO mudanca** se o wire format for
   respeitado. O handler existente continua funcionando exatamente igual.

4. **Manter os fixes de Node http.Server**: `requestTimeout = 0` e
   `headersTimeout = 0` **devem continuar** no server.mjs mesmo apos a
   task ser implementada. Sao ortogonais ao heartbeat — sao protecoes
   contra timeouts da propria infra Node, independente de qual subsistema
   emite bytes no stream.

### Ponto de atencao — diferenca semantica

O hot-patch atual no server emite heartbeat **so se nao houve trafego
real nos ultimos 15s** (com base em `lastEmitAt`). Isso e uma otimizacao
pra evitar pings redundantes quando o SDK ja ta cuspindo mensagens
normalmente.

Quando a task for implementada, o SDK vai emitir `SDKPresenceMessage` a
cada 15s **independente de atividade real** (spec atual nesta TASK.md).
O relay no server.mjs pode fazer a otimizacao ainda (so relay se houve
gap), mas e opcional.

**Recomendacao pro implementador**: manter a semantica do spec (emit
periodico incondicional) e remover a otimizacao `lastEmitAt` no relay.
Vantagem: mais simples, mais previsivel, cliente nao muda. Desvantagem:
+1 mensagem a cada 15s mesmo em turnos ativos — irrelevante em tamanho.

### Arquivos tocados pelo hot-patch (nao commitar como da task)

- `D:/aw/context/workspaces/openclaude-sdk/repo/.tmp/demo/server.mjs`
  - `HEARTBEAT_INTERVAL_MS` constant
  - heartbeat logic in `pipeQueryToSSE`
  - `httpServer.requestTimeout = 0` / `httpServer.headersTimeout = 0`
- `D:/aw/context/workspaces/openclaude-chat/repo/src/hooks/useOpenClaudeChat.ts`
  - `STALL_MS: 45000 → 90000`
  - `HARD_LIMIT_MS` removido
  - handler de `event: ping|keepalive|heartbeat`

Ao implementar a task, os tres arquivos podem ser revisitados para remover
o hot-patch (server.mjs) ou deixa-los intocados (openclaude-chat — so ganha
que nao precisa de mudanca).

---

## Contexto

O `openclaude` CLI tem dois tipos de gap previsiveis em que nenhum byte flui:

1. **Gap inicial** entre o spawn e o primeiro `assistant` chunk — pode chegar
   a 30-120s com providers baratos (rate limit backoff, context assembly,
   cold starts).
2. **Gap de tool execution** entre um `tool_use` e o `tool_result` — um
   `Bash` longo, um `WebFetch` lento, etc. Pode durar minutos.

Clientes de chat tipicamente implementam **watchdogs** que abortam a conexao
se nao chegar nada por N segundos (o `useOpenClaudeChat.ts` do `openclaude-chat`
tem `STALL_MS = 45_000` e `HARD_LIMIT_MS = 60_000`). Esses watchdogs estao
certos — detectam conexao morta de verdade. O problema e que hoje eles nao
conseguem distinguir "servidor crashou" de "modelo pensando".

A solucao padrao em SSE e emitir **comment lines** (`:heartbeat\n\n`) a cada
15s, que o browser ignora no `onmessage` mas conta como trafego. Como o SDK
nao e SSE-aware (ele yields `SDKMessage`, quem traduz pra SSE e o consumer),
a solucao equivalente e emitir um **novo tipo de `SDKMessage`** que o
consumer trata como quiser. Um server SSE relay vira `event: ping` no wire;
um consumer de scripting (ex: `collectMessages()`) ignora silenciosamente.

---

## Design

### Shape do `SDKPresenceMessage`

```typescript
interface SDKPresenceMessage {
  type: "presence"

  /**
   * Unix timestamp em ms no momento do emit. Usado pelo cliente pra
   * calcular drift ou rate-limitar renders se necessario.
   */
  ts: number

  /**
   * Sequencia do heartbeat dentro do turno atual (1-indexed). Comeca em 1
   * no primeiro emit e incrementa. Zera a cada novo `query()`.
   *
   * Util pra debug ("recebi heartbeats 1, 2, 3 mas faltou o 4 → provavel
   * network stall") e pra testes automatizados.
   */
  seq: number

  /**
   * Numero aproximado de ms desde o inicio do turno. Permite ao cliente
   * mostrar um cronometro "o modelo esta pensando ha 23s" sem ter que
   * marcar tempo local.
   */
  elapsedMs: number
}
```

Adicionar ao discriminated union `SDKMessage` em `src/types/messages.ts`.

### Timer e ciclo de vida

Dentro do `lifecycleGenerator` em `src/query.ts`, logo apos o spawn do CLI
e antes do `for await (const msg of stream)`:

```typescript
// Heartbeat config — fixo por enquanto, configuravel depois se necessario
const HEARTBEAT_INTERVAL_MS = 15_000
const heartbeatQueue: SDKPresenceMessage[] = []
const turnStart = Date.now()
let heartbeatSeq = 0

const heartbeatTimer = setInterval(() => {
  heartbeatSeq++
  heartbeatQueue.push({
    type: "presence",
    ts: Date.now(),
    seq: heartbeatSeq,
    elapsedMs: Date.now() - turnStart,
  })
}, HEARTBEAT_INTERVAL_MS)
```

**Importante**: o timer NAO chama `writeSSE` ou equivalente — ele empurra
numa fila. O generator drena a fila **entre cada yield** da mensagem real
do CLI, e tambem em intervalos regulares quando esta ocioso.

Drenagem integrada ao loop:

```typescript
function* drainHeartbeats() {
  while (heartbeatQueue.length > 0) {
    yield heartbeatQueue.shift()!
  }
}

for await (const msg of stream) {
  yield* drainHeartbeats()    // emite acumulados antes da proxima msg real
  yield msg                    // mensagem real do CLI
}
yield* drainHeartbeats()       // drena o que sobrou apos o CLI fechar
```

**Problema**: se o CLI ficar 30s sem emitir nada, o `for await` bloqueia
nesse iterador e o heartbeat acumulado so sai quando chegar a proxima
mensagem real. Isso quebra o proposito — e exatamente durante gaps que
queremos emitir.

**Solucao**: Promise.race entre o `next()` do stream e um timer que
resolve imediatamente quando a fila tem itens. Pseudocodigo:

```typescript
async function* merged(): AsyncGenerator<SDKMessage> {
  const iter = stream[Symbol.asyncIterator]()
  while (true) {
    const next = iter.next()
    const heartbeatReady = new Promise<"heartbeat">((resolve) => {
      if (heartbeatQueue.length > 0) resolve("heartbeat")
      else {
        const check = setInterval(() => {
          if (heartbeatQueue.length > 0) {
            clearInterval(check)
            resolve("heartbeat")
          }
        }, 100) // polling barato — ou substituir por event emitter
      }
    })

    const winner = await Promise.race([next.then(() => "next" as const), heartbeatReady])

    if (winner === "heartbeat") {
      yield* drainHeartbeats()
      continue
    }

    const result = await next
    if (result.done) break
    yield* drainHeartbeats()
    yield result.value
  }
}
```

**Alternativa mais limpa**: usar um canal (BroadcastChannel-like) com
`promises` acordadas. Implementacao concreta fica a cargo do desenvolvedor
da task — o importante e que gaps longos **ainda emitam heartbeats**.

### Cleanup

No `finally` do `lifecycleGenerator`:

```typescript
finally {
  clearInterval(heartbeatTimer)
  await stopOnce()
}
```

### Configuracao opcional via `Options`

Adiciona um campo opcional pra desabilitar (testes, casos batch que nao
precisam de heartbeat):

```typescript
interface Options {
  /**
   * Intervalo entre heartbeats de presenca em ms. Default: 15000 (15s).
   * Setar para 0 ou valor negativo desabilita o heartbeat.
   *
   * Heartbeats sao emitidos como `SDKMessage` do tipo "presence" e servem
   * pra manter conexoes SSE vivas em UIs de chat. Consumidores que so
   * fazem `collectMessages()` podem ignorar.
   */
  presenceIntervalMs?: number
}
```

`presenceIntervalMs === 0` = desabilitado. `undefined` = default 15s.

### Nao emitir antes do primeiro heartbeat real

O primeiro heartbeat sai no tick do setInterval, nao imediatamente. Nao
emite um heartbeat "zero" logo no spawn — se o modelo responder em 200ms,
o cliente vai receber so a mensagem real, sem poluicao.

---

## Integracao com `collectMessages()`

O helper `collectMessages()` em `src/query.ts` deve **ignorar** mensagens
de presence — elas nao sao conteudo semantico, apenas liveness. Adicionar
um filtro no loop:

```typescript
for await (const msg of q) {
  if (msg.type === "presence") continue   // ignora liveness
  messages.push(msg)
  // ... resto
}
```

---

## Integracao com `session-v2` `collect()`

Mesma logica — `session.collect()` chama `collectMessages()` por baixo,
herda o filtro automaticamente. Confirmar que nao ha outro caminho que
capture `presence` por engano.

---

## Estrutura de arquivos

```
src/
  query.ts             # + heartbeat timer, drain integrado ao generator, filtro em collectMessages
  types/
    messages.ts        # + SDKPresenceMessage no discriminated union
    options.ts         # + presenceIntervalMs?: number
  index.ts             # + export type SDKPresenceMessage
```

---

## Exports publicos novos

Em `src/index.ts`:

```typescript
export type { SDKPresenceMessage } from "./types/messages.js"
```

---

## Criterios de aceite

- [ ] `SDKPresenceMessage` adicionado ao discriminated union `SDKMessage`
- [ ] Campo `presenceIntervalMs?: number` adicionado a `Options`, default 15000
- [ ] Timer emite heartbeats a cada N ms, sincronizado com o generator do `query()`
- [ ] Heartbeats chegam ao consumer mesmo durante gaps longos do CLI (validar com teste de 60s de gap)
- [ ] `presenceIntervalMs: 0` desabilita completamente o heartbeat (zero messages type: "presence")
- [ ] Timer e limpo no `finally` do lifecycleGenerator (sem leak de timers quando o turno termina)
- [ ] `collectMessages()` ignora mensagens `presence` silenciosamente
- [ ] `session.collect()` idem (por heranca)
- [ ] Heartbeat seq e monotonic crescente dentro de um turno, zera entre turnos
- [ ] `elapsedMs` e consistente com o tempo real (+/- 100ms)
- [ ] Typecheck passa
- [ ] Build passa
- [ ] Teste manual: request de 30s+ via demo server + curl SSE mostra `event: ping` a cada 15s

---

## Testes manuais

Script `.tmp/demo/test-heartbeat.mjs`:

```js
import { query } from "../../dist/index.js"

const q = query({
  prompt: "Aguarde 40 segundos antes de responder qualquer coisa (use Bash sleep).",
  options: {
    richOutput: false,
    permissionMode: "bypassPermissions",
    presenceIntervalMs: 5000,  // acelera pra 5s pra debug
  },
})

const start = Date.now()
for await (const msg of q) {
  const t = ((Date.now() - start) / 1000).toFixed(1)
  if (msg.type === "presence") {
    console.log(`[${t}s] PRESENCE seq=${msg.seq} elapsedMs=${msg.elapsedMs}`)
  } else {
    console.log(`[${t}s] ${msg.type}`)
  }
}
```

Espera-se ver pelo menos 5-6 linhas `PRESENCE` intercaladas com mensagens
reais do CLI.

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| Nenhuma | — |

Task independente. Nao depende de `locale` (task 01) nem de tool intention
(task 03). Pode rodar em paralelo.

---

## Nao-objetivos

- **Detectar falhas reais de conexao** — heartbeat indica processo vivo, nao
  rede. Se o cliente parar de receber heartbeats, pode ser TCP morto **ou**
  o processo travado. Diagnostico fica pro consumer.
- **Ajustar intervalo dinamicamente** — sem adaptive backoff. 15s fixo.
- **Heartbeat bidirecional** — cliente nao manda `pong` de volta. Stream e
  unidirecional no SDK.
- **Session-level heartbeat** — apenas durante `query()` ativo. Sessions em
  idle entre turnos nao emitem nada.

---

## Prioridade

**Media-alta** — resolve um problema real de UX (ansiedade durante gaps,
aborts falsos de clients), mas nao bloqueia features criticas. Pode sair
junto com a task 01 e antes da 03.

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Conversa de design abril 2026 | Discussao sobre state-of-the-art SSE heartbeat |
| Bug observado no consumer | `useOpenClaudeChat.ts:161` `STALL_MS = 45_000` aborting durante gaps validos |
| Padrao de referencia | SSE comment lines `:heartbeat\n\n` (RFC 7230, ex: Stripe, OpenAI, Vercel AI SDK) |
| Consumidor final | `D:\aw\context\workspaces\openclaude-chat\repo` |
