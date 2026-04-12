# Brainstorming — Sprint 16

## Contexto

O TASK.md desta wave descreve o **Presence Heartbeat**: adição de um novo tipo de `SDKMessage` — `SDKPresenceMessage` — emitido pelo `query()` em intervalos fixos (default 15s) enquanto o turno está ativo.

### O que a wave precisa entregar

1. `src/types/messages.ts` — novo tipo `SDKPresenceMessage` com campos `type: "presence"`, `ts`, `seq`, `elapsedMs`, adicionado ao discriminated union `SDKMessage`
2. `src/types/options.ts` — campo `presenceIntervalMs?: number` com JSDoc completo (default 15000, 0=desabilita)
3. `src/query.ts` — timer + fila no `lifecycleGenerator`, Promise.race para emissão gap-aware, drenaagem integrada ao loop, filtro em `collectMessages()`
4. `src/index.ts` — re-export público de `SDKPresenceMessage`
5. `.tmp/demo/test-heartbeat.mjs` — script de teste manual com gap de 40s e intervalo acelerado de 5s
6. `.tmp/demo/server.mjs` — refatoração para relay de `SDKPresenceMessage` (remover setInterval local)
7. Manutenção de `requestTimeout=0` / `headersTimeout=0` no server.mjs
8. Typecheck (`tsc --noEmit`) e build (`tsup`) passando

### Motivação

O `openclaude` CLI tem dois tipos de gap previsíveis em que nenhum byte flui:
- **Gap inicial** (spawn → primeiro chunk assistant): 30-120s em providers baratos
- **Gap de tool execution** (tool_use → tool_result): Bash longo, WebFetch lento — pode durar minutos

Clientes SSE (ex: `openclaude-chat`) implementam watchdogs que abortam se nada chegar por N segundos. Hoje esses watchdogs não distinguem "servidor crashou" de "modelo pensando". A solução SSE padrão é emitir comment lines a cada 15s, mas como o SDK não é SSE-aware, a solução equivalente é um novo `SDKMessage` que o consumer trata como quiser.

### Contexto do hot-patch existente

Um bug de produção forçou um hot-patch antes desta task:
- **server.mjs**: tem `HEARTBEAT_INTERVAL_MS = 15_000`, `HEARTBEAT_POLL_MS = 1_000`, lógica local de setInterval com `lastEmitAt`
- **openclaude-chat**: `STALL_MS` subiu de 45s → 90s; `HARD_LIMIT_MS` removido; handler aceita `event: ping|keepalive|heartbeat`
- **Wire format atual**: `event: ping\ndata: {"ts":..., "seq":..., "elapsedMs":...}`

Este wire format **deve ser preservado** — o cliente não muda.

---

## Funcionalidades mapeadas (já implementadas)

### Waves 1–14 (D-001 a D-103)
- Build/package setup, buildCliArgs() completo, hierarquia de erros, sessions API, MCP SDK servers
- richOutput (display system), reactOutput, askUser
- Ver sprints 1-14 para listagem completa

### Wave 15 (D-104 a D-111) — Locale Options
- `src/locale/types.ts` — `SupportedLocale`, `SUPPORTED_LOCALES`
- `src/locale/normalize.ts` — `normalizeLocale()` com regras BCP 47
- `src/locale/index.ts` — barrel
- `locale?: string` em Options com JSDoc
- Exports públicos: `normalizeLocale`, `SUPPORTED_LOCALES`, `SupportedLocale`
- Validação: `locale` ausente de `buildCliArgs()`
- Test script `.tmp/demo/test-locale.mjs`
- Typecheck + build passando

### Estado atual do codebase (wave-16 início)
- `src/types/messages.ts`: sem `SDKPresenceMessage`
- `src/types/options.ts`: sem `presenceIntervalMs`
- `src/query.ts`: sem timer de heartbeat, sem filtro em `collectMessages()`
- `src/index.ts`: sem export de `SDKPresenceMessage`
- `.tmp/demo/server.mjs`: tem hot-patch com setInterval local (a ser refatorado)

---

## Lacunas e oportunidades

### Lacuna principal: `SDKPresenceMessage` ausente do discriminated union
O tipo não existe. Sem ele, nada mais pode ser implementado — é o bloco fundamental. O union `SDKMessage` em `messages.ts` precisa incluir essa entrada.

### Lacuna: `presenceIntervalMs` ausente em Options
Sem esse campo, consumidores não podem desabilitar heartbeat (batch jobs, testes) nem ajustar o intervalo. O campo deve ser opcional com semântica clara: `undefined` = default 15s, `0` = desabilitado.

### Lacuna: timer + fila ausentes em `lifecycleGenerator`
O `lifecycleGenerator` em `query.ts` não tem nenhuma lógica de heartbeat. Precisa de: `setInterval` que empurra em fila, `Promise.race` entre `iter.next()` e fila pronta, drenagem antes de cada yield real, cleanup no `finally`.

### Lacuna: Promise.race é necessário para gaps longos
Sem ele, o `for await` bloqueia durante gaps e os heartbeats acumulam na fila sem chegar ao consumer. É exatamente durante gaps que o consumer precisa receber heartbeats. O TASK.md especifica o pseudocódigo completo.

### Lacuna: `collectMessages()` não filtra `presence`
O helper coleta todas as mensagens. Presence são liveness signals, não conteúdo semântico. Sem o filtro, batch consumers acidentalmente incluem presence na lista de mensagens retornadas.

### Lacuna: `session-v2 collect()` precisa verificação
O TASK.md exige confirmar que não existe outro caminho que capture `presence` por engano. `session.collect()` chama `collectMessages()` por baixo — herda o filtro automaticamente, mas precisa ser verificado explicitamente.

### Lacuna: export público de `SDKPresenceMessage`
Consumidores que fazem type narrowing no discriminated union (`msg.type === "presence"`) precisam do tipo público. Seguindo o padrão das outras waves.

### Oportunidade: relay simples no server.mjs
O server.mjs hoje tem lógica complexa (`lastEmitAt`, `heartbeatSeq` local, `HEARTBEAT_POLL_MS`). Com SDK emitindo `SDKPresenceMessage`, o relay fica trivial: `if (msg.type === "presence") → emit SSE event: ping`. Remove complexidade do lado do servidor.

### Oportunidade: wire format preservado sem mudança de cliente
O `openclaude-chat` não precisa de nenhuma mudança se o server fizer relay com o mesmo shape `{ts, seq, elapsedMs}` via `event: ping`. Zero breaking change.

### Oportunidade: `requestTimeout=0` / `headersTimeout=0` são ortogonais
Esses fixes no Node http.Server protegem contra timeouts da infra Node — independente do heartbeat. Devem ser mantidos mesmo após a refatoração.

### Oportunidade: desabilitação limpa via `presenceIntervalMs: 0`
Testes e batch consumers que não precisam de heartbeat podem desabilitar completamente sem nenhum overhead de timer. O timer simplesmente não é criado quando `presenceIntervalMs <= 0`.

---

## Priorização

| Discovery | Descrição | Score | Justificativa |
|-----------|-----------|-------|---------------|
| D-112 | `SDKPresenceMessage` no discriminated union em messages.ts | 9 | Base de tudo; bloqueia D-113 em diante |
| D-113 | `presenceIntervalMs?: number` em Options com JSDoc | 8 | Entry point de configuração; sem isso timer não tem parâmetro |
| D-114 | Timer + heartbeat queue no lifecycleGenerator | 9 | Core da feature; emite mensagens periodicamente |
| D-115 | Promise.race para emissão durante gaps do CLI | 9 | Sem isso heartbeat só sai quando chega msg real — inútil para gaps longos |
| D-116 | Cleanup no finally (clearInterval) | 8 | Evita leak de timers; critério de aceite explícito |
| D-117 | Filtro em `collectMessages()` — ignorar presence | 8 | Sem isso batch consumers recebem lixo na lista de mensagens |
| D-118 | Verificação de `session-v2 collect()` — herança do filtro | 6 | Confirmação de correção; TASK.md exige explicitamente |
| D-119 | Export `SDKPresenceMessage` de src/index.ts | 7 | Consumidores precisam do tipo para type narrowing |
| D-120 | Script `.tmp/demo/test-heartbeat.mjs` | 7 | Validação manual do gap de 40s com intervalo de 5s |
| D-121 | Refatoração server.mjs — relay SDKPresenceMessage, remover setInterval local | 8 | Remove complexidade do hot-patch; simplifica server significativamente |
| D-122 | Manter `requestTimeout=0` / `headersTimeout=0` no server.mjs | 7 | Proteção ortogonal ao heartbeat; critério de aceite implícito do TASK.md |
| D-123 | Typecheck + build passando | 8 | Gate de qualidade; critério de aceite final |

**Ordem lógica de implementação**: D-112 → D-113 → D-114 → D-115 → D-116 → D-117 → D-118 → D-119 → D-120 → D-121 → D-122 → D-123
