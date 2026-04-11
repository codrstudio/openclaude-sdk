# openclaude-sdk - Barrel, exports publicos e integracao no lifecycleGenerator

Spec do barrel do modulo tool-intention, exports publicos e integracao do filtro no `query.ts`.

---

## Objetivo

Resolve D-131, D-132, D-133.

| Problema | Consequencia |
|----------|-------------|
| Modulo `tool-intention` precisa de barrel para encapsulamento | Imports espalhados pelo codebase sem ponto unico de entrada |
| Filtro precisa ser integrado no `lifecycleGenerator` | Sem integracao, filtro existe mas nao e aplicado ao stream |
| Funcoes e tipos precisam ser exportados publicamente | Consumidores do SDK nao conseguem acessar `pickIntention` nem `ToolIntentionPayload` |

---

## Implementacao

### 1. Criar barrel `src/tool-intention/index.ts`

```typescript
export { pickIntention } from "./picker.js"
export { applyToolIntentionFilter } from "./filter.js"
export type { ToolIntentionPayload } from "./types.js"
```

### 2. Adicionar exports em `src/index.ts`

Na secao de exports, apos o bloco de Locale:

```typescript
// ---------------------------------------------------------------------------
// Tool Intention Filter
// ---------------------------------------------------------------------------

export { pickIntention, applyToolIntentionFilter } from "./tool-intention/index.js"
export type { ToolIntentionPayload } from "./tool-intention/index.js"
```

### 3. Integrar filtro no `lifecycleGenerator` de `src/query.ts`

Import no topo de `query.ts`:

```typescript
import { applyToolIntentionFilter } from "./tool-intention/index.js"
```

#### Ponto de integracao 1: loop com heartbeat

Dentro do loop `while (true)` com heartbeat, apos `yield* drainHeartbeats()` e antes de `yield result.value`:

```typescript
yield* drainHeartbeats()

if (!processMsg(result.value)) {
  if (optionsForCli.toolOutputMode !== "full") {
    const filtered = applyToolIntentionFilter(result.value, optionsForCli.locale)
    if (filtered === null) continue
    yield filtered
  } else {
    yield result.value
  }
}
```

#### Ponto de integracao 2: loop simples (heartbeat desabilitado)

Dentro do `for await (const msg of stream)`:

```typescript
for await (const msg of stream) {
  if (!processMsg(msg)) {
    if (optionsForCli.toolOutputMode !== "full") {
      const filtered = applyToolIntentionFilter(msg, optionsForCli.locale)
      if (filtered === null) continue
      yield filtered
    } else {
      yield msg
    }
  }
}
```

### Regras

- `optionsForCli` ja tem acesso a `toolOutputMode` e `locale` via `Options`
- Quando `toolOutputMode` e `undefined` (default), trata como `"intention"` (filtro ativo)
- Check e `!== "full"` — qualquer valor que nao seja `"full"` ativa o filtro
- `filtered === null` → `continue` (pula mensagem suprimida)
- Filtro e aplicado **apos** `processMsg()` para que mensagens internas do SDK (result, system) nao passem pelo filtro desnecessariamente
- Filtro e aplicado **apos** `drainHeartbeats()` para nao atrasar heartbeats

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/tool-intention/index.ts` | Novo arquivo — barrel do modulo |
| `src/index.ts` | Novos exports: `pickIntention`, `applyToolIntentionFilter`, `ToolIntentionPayload` |
| `src/query.ts` | Import de `applyToolIntentionFilter` + integracao nos dois loops do `lifecycleGenerator` |

---

## Criterios de Aceite

- [ ] `src/tool-intention/index.ts` exporta `pickIntention`, `applyToolIntentionFilter`, `ToolIntentionPayload`
- [ ] `src/index.ts` re-exporta os tres itens acima
- [ ] `lifecycleGenerator` em `query.ts` aplica filtro nos dois loops (com e sem heartbeat)
- [ ] Modo `"full"` passa mensagens inalteradas (bypass completo)
- [ ] Modo `"intention"` (ou `undefined`) ativa o filtro
- [ ] `filtered === null` causa `continue` (mensagem suprimida)
- [ ] `tsc --noEmit` passa sem erro
- [ ] Build (`npm run build`) passa sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `src/tool-intention/index.ts` barrel | S-093 |
| Exports publicos em `src/index.ts` | S-093 |
| Integracao no `lifecycleGenerator` | S-093 |
| D-131 | S-093 |
| D-132 | S-093 |
| D-133 | S-093 |
