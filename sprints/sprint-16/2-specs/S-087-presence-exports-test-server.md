# openclaude-sdk - Export publico, teste manual e refatoracao server.mjs

Spec dos exports publicos de `SDKPresenceMessage`, script de teste manual e refatoracao do server.mjs para relay de presence.

---

## Objetivo

Resolve D-119, D-120, D-121, D-122, D-123.

| Problema | Consequencia |
|----------|-------------|
| `SDKPresenceMessage` nao exportado publicamente | Consumidores nao podem fazer type narrowing |
| Sem teste manual para validar gap-awareness | Nao ha forma de verificar que heartbeats chegam durante gaps |
| server.mjs tem logica local de heartbeat duplicada | Complexidade desnecessaria apos SDK emitir presence nativamente |
| Typecheck/build nao validados apos mudancas | Regressoes podem passar despercebidas |

---

## Estado Atual

### `src/index.ts`

- Secao "Tipos — Messages" (linha 59) exporta todos os tipos de `SDKMessage` individualmente
- `SDKPresenceMessage` nao existe nessa lista

### `.tmp/demo/server.mjs`

- Funcao `pipeQueryToSSE` tem logica local: `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_POLL_MS`, `heartbeatSeq`, `lastEmitAt`, `setInterval` com check de gap
- `httpServer.requestTimeout = 0` e `httpServer.headersTimeout = 0` desabilitam timeouts Node

### `.tmp/demo/test-heartbeat.mjs`

- Nao existe

---

## Implementacao

### 1. Export publico em `src/index.ts`

Na secao "Tipos — Messages", adicionar `SDKPresenceMessage`:

```typescript
export type {
  // ... tipos existentes ...
  SDKPromptSuggestionMessage,
  SDKPresenceMessage,
  SDKMessage,
} from "./types/messages.js"
```

### 2. Script de teste manual `.tmp/demo/test-heartbeat.mjs`

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

### Regras do teste

- Usa `presenceIntervalMs: 5000` para acelerar (5s em vez de 15s)
- O prompt forca um gap de 40s via `Bash sleep`
- Espera-se ver 7-8 linhas `PRESENCE` intercaladas com mensagens reais
- `permissionMode: "bypassPermissions"` evita prompts interativos
- `richOutput: false` evita setup de MCP display server

### 3. Refatoracao do server.mjs — relay de SDKPresenceMessage

Na funcao `pipeQueryToSSE`:

**Remover**:
- Constantes `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_POLL_MS`
- Variaveis `heartbeatSeq`, `lastEmitAt`, `heartbeatTimer`
- `setInterval` local e logica de check de gap
- `clearInterval` no cleanup

**Adicionar** relay no loop principal:

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

### Regras do relay

- SSE event name: `ping` (preserva wire format do hot-patch)
- Campos no `data` JSON: `ts`, `seq`, `elapsedMs` — exatamente os mesmos do hot-patch
- Campo `type: "presence"` NAO vai no JSON do data — o event name `ping` ja identifica
- `lastEmitAt` removido — SDK emite incondicionalmente, server faz relay direto

### 4. Manter timeouts Node desabilitados

✅ `httpServer.requestTimeout = 0` e `httpServer.headersTimeout = 0` devem permanecer no server.mjs.

Sao protecoes contra timeouts da infra Node (default 300s no Node 18+), ortogonais ao heartbeat.

### 5. Validacao de typecheck e build

Executar em sequencia apos todas as mudancas:

```bash
npx tsc --noEmit    # typecheck
npx tsup            # build
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/index.ts` | Export de `SDKPresenceMessage` na secao de tipos Messages |
| `.tmp/demo/test-heartbeat.mjs` | Novo — script de teste manual |
| `.tmp/demo/server.mjs` | Refatoracao: remover logica local de heartbeat, adicionar relay de `SDKPresenceMessage` |

---

## Criterios de Aceite

- [ ] `SDKPresenceMessage` exportado de `src/index.ts`
- [ ] `.tmp/demo/test-heartbeat.mjs` existe e executa com `node .tmp/demo/test-heartbeat.mjs`
- [ ] server.mjs faz relay de `msg.type === "presence"` como `event: ping` com shape `{ts, seq, elapsedMs}`
- [ ] server.mjs nao tem mais `setInterval` local para heartbeat
- [ ] server.mjs mantem `requestTimeout = 0` e `headersTimeout = 0`
- [ ] Wire format preservado: `event: ping\ndata: {"ts":...,"seq":...,"elapsedMs":...}`
- [ ] `tsc --noEmit` passa sem erro
- [ ] `tsup` builda sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| Export `SDKPresenceMessage` | S-087 |
| `.tmp/demo/test-heartbeat.mjs` | S-087 |
| Relay presence no server.mjs | S-087 |
| Timeouts Node no server.mjs | S-087 |
| Typecheck + build | S-087 |
| D-119 | S-087 |
| D-120 | S-087 |
| D-121 | S-087 |
| D-122 | S-087 |
| D-123 | S-087 |
