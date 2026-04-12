# PRP-052 — Presence Heartbeat integration: exports, teste manual e server relay

## Objetivo

Integrar o heartbeat de presenca ao ecossistema: export publico de `SDKPresenceMessage`, script de teste manual para validar gap-awareness, refatoracao do server.mjs para relay de `SDKPresenceMessage` (removendo hot-patch local), e validacao de typecheck + build.

Referencia: spec S-087 (D-119, D-120, D-121, D-122, D-123).

## Execution Mode

`implementar`

## Contexto

O PRP-051 implementa o core do heartbeat no SDK:
- `SDKPresenceMessage` no union `SDKMessage` (F-131)
- `presenceIntervalMs` em `Options` (F-132)
- Timer + Promise.race no `lifecycleGenerator` (F-133)
- Filtro em `collectMessages()` (F-134)

Faltam:
1. **Export publico** — `SDKPresenceMessage` acessivel a consumidores via `import type`
2. **Teste manual** — script que valida heartbeats durante gap de 40s
3. **Server relay** — refatorar `server.mjs` para fazer relay de `SDKPresenceMessage` em vez de logica local de heartbeat
4. **Timeouts Node** — confirmar que `requestTimeout=0` e `headersTimeout=0` permanecem
5. **Build** — `tsc --noEmit` e `tsup` passam

Estado atual:
- `src/index.ts` — secao "Tipos — Messages" exporta todos os tipos individualmente, sem `SDKPresenceMessage`
- `.tmp/demo/server.mjs` — funcao `pipeQueryToSSE` tem logica local: `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_POLL_MS`, `heartbeatSeq`, `lastEmitAt`, `setInterval` com check de gap
- `.tmp/demo/test-heartbeat.mjs` — NAO existe

## Especificacao

### Feature F-135 — Export publico SDKPresenceMessage em src/index.ts

Na secao "Tipos — Messages" de `src/index.ts`, adicionar `SDKPresenceMessage` junto aos outros tipos de mensagem:

```typescript
export type {
  // ... tipos existentes ...
  SDKPromptSuggestionMessage,
  SDKPresenceMessage,
  SDKMessage,
} from "./types/messages.js"
```

Regras:
- Posicionado antes de `SDKMessage` no bloco de export type (penultimo membro, antes do union)
- Extensao `.js` no import path (ESM)
- Export como `export type` (tree-shaking)

### Feature F-136 — Script de teste manual .tmp/demo/test-heartbeat.mjs

Criar `.tmp/demo/test-heartbeat.mjs`:

```javascript
import { query } from "../../dist/index.js"

const q = query({
  prompt: "Aguarde 40 segundos antes de responder qualquer coisa (use Bash sleep).",
  options: {
    richOutput: false,
    permissionMode: "bypassPermissions",
    presenceIntervalMs: 5000,
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

Regras:
- `presenceIntervalMs: 5000` — acelera para 5s (debug, nao esperar 15s)
- Prompt forca gap de 40s via `Bash sleep`
- Espera-se ver 7-8 linhas `PRESENCE` intercaladas com mensagens reais
- `permissionMode: "bypassPermissions"` evita prompts interativos
- `richOutput: false` evita setup de MCP display server

### Feature F-137 — Refatoracao server.mjs para relay de SDKPresenceMessage

Na funcao `pipeQueryToSSE` de `.tmp/demo/server.mjs`:

**Remover:**
- Constantes `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_POLL_MS`
- Variaveis `heartbeatSeq`, `lastEmitAt`, `heartbeatTimer`
- `setInterval` local e logica de check de gap
- `clearInterval` no cleanup correspondente

**Adicionar** relay no loop principal de mensagens:

```javascript
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

Wire format preservado — exatamente o mesmo shape do hot-patch:

```
event: ping
data: {"ts":1775881234567,"seq":1,"elapsedMs":15000}
```

Regras:
- SSE event name: `ping` (preserva wire format)
- Campos no `data` JSON: `ts`, `seq`, `elapsedMs` — mesmos do hot-patch
- Campo `type: "presence"` NAO vai no JSON do data — event name `ping` ja identifica
- `lastEmitAt` removido — SDK emite incondicionalmente, server faz relay direto
- Zero mudanca no cliente `openclaude-chat` — wire format identico

**Manter no server.mjs:**
- `httpServer.requestTimeout = 0` — protecao contra timeout Node 18+ (default 300s)
- `httpServer.headersTimeout = 0` — idem, ortogonal ao heartbeat

**Adicionar `presenceIntervalMs`** nas options passadas ao `query()` dentro de `pipeQueryToSSE`:
- O server.mjs deve passar `presenceIntervalMs: 15_000` (ou o default) ao chamar `query()`
- Se o server.mjs ja tem um config de intervalo, usar esse valor

### Feature F-138 — Validacao typecheck e build

Executar em sequencia apos todas as mudancas:

```bash
npx tsc --noEmit    # typecheck — zero erros
npx tsup            # build — zero erros, dist/ atualizado
```

Regras:
- Ambos devem passar sem erro
- Se falhar, corrigir antes de considerar PRP completo
- NAO pular validacao

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `import type { SDKPresenceMessage } from "openclaude-sdk"` | Erro | Funciona |
| `node .tmp/demo/test-heartbeat.mjs` (gap 40s) | N/A | 7-8 linhas PRESENCE intercaladas |
| SSE wire format via server.mjs | `event: ping` (hot-patch local) | `event: ping` (relay SDK) — identico |
| `pipeQueryToSSE` — `setInterval` local | Presente | Removido |
| `httpServer.requestTimeout` | `0` | `0` (mantido) |
| `tsc --noEmit` | Passa | Passa |
| `tsup` | Passa | Passa |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-135 | presenceExport | Export `SDKPresenceMessage` de `src/index.ts` na secao de tipos Messages |
| F-136 | presenceTestScript | Script `.tmp/demo/test-heartbeat.mjs` com gap de 40s e intervalo de 5s |
| F-137 | serverRelay | Refatoracao `pipeQueryToSSE` em server.mjs: remover hot-patch, relay `SDKPresenceMessage` como `event: ping` |
| F-138 | presenceBuildValidation | `tsc --noEmit` e `tsup` passam sem erro apos todas as mudancas |

## Limites

- NAO alterar `src/types/messages.ts` — escopo de PRP-051
- NAO alterar `src/types/options.ts` — escopo de PRP-051
- NAO alterar `src/query.ts` — escopo de PRP-051
- NAO alterar o cliente `openclaude-chat` — wire format preservado, zero mudanca necessaria
- NAO adicionar testes unitarios (nao ha framework de teste configurado)
- NAO implementar logica condicional de gap no relay (`lastEmitAt`) — relay direto e mais simples

## Dependencias

Depende de **PRP-051** (tipo, option, timer e filtro existem). Nenhum PRP depende deste — e o ultimo da cadeia para presence heartbeat.
