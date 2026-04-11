# PRP-054 — Tool Intention filter e integracao: filtro, barrel, exports e lifecycleGenerator

## Objetivo

Implementar o filtro `applyToolIntentionFilter` que transforma blocos `tool_use` e suprime `tool_result`, criar o barrel do modulo, adicionar exports publicos em `src/index.ts` e integrar o filtro no `lifecycleGenerator` de `query.ts`.

Referencia: specs S-092 (D-130), S-093 (D-131, D-132, D-133).

## Execution Mode

`implementar`

## Contexto

O PRP-053 cria a fundacao do Tool Intention Filter:
- `Options.toolOutputMode` — campo de controle (F-139)
- `ToolIntentionPayload` — shape do input filtrado (F-140)
- Dicionarios JSON pt-BR/en-US/es-ES — 23 tools × 5 variantes + `_fallback` (F-141)
- `pickIntention(toolName, locale)` — selecao aleatoria (F-142)

Faltam:
1. **Filtro** — funcao que transforma mensagens do stream, substituindo `tool_use.input` e suprimindo `tool_result`
2. **Barrel** — ponto unico de entrada do modulo `src/tool-intention/`
3. **Exports publicos** — consumidores do SDK precisam acessar `pickIntention`, `applyToolIntentionFilter`, `ToolIntentionPayload`
4. **Integracao** — o filtro precisa ser aplicado no `lifecycleGenerator` de `query.ts` para funcionar

Estado atual de `query.ts`:
- `lifecycleGenerator()` tem dois loops: um com heartbeat (Promise.race) e um simples (for await)
- Ambos processam mensagens via `processMsg()` antes de yield
- O ponto de insercao e apos `processMsg()` e `drainHeartbeats()`, antes do `yield`

## Especificacao

### Feature F-143 — applyToolIntentionFilter funcao de filtro

Criar `src/tool-intention/filter.ts`:

```typescript
import type { SDKMessage } from "../types/messages.js"
import { pickIntention } from "./picker.js"
import type { ToolIntentionPayload } from "./types.js"

export function applyToolIntentionFilter(
  msg: SDKMessage,
  locale: string | undefined,
): SDKMessage | null {
  if (msg.type === "user" && isOnlyToolResult(msg)) {
    return null
  }

  if (msg.type === "assistant") {
    const newContent = msg.message.content.map((block) => {
      if (block.type !== "tool_use") return block
      if (block.name.startsWith("mcp__display__")) return block
      return {
        ...block,
        input: {
          _intention: pickIntention(block.name, locale),
          _toolName: block.name,
          _toolUseId: block.id,
          _filtered: true,
        } satisfies ToolIntentionPayload,
      }
    })
    return { ...msg, message: { ...msg.message, content: newContent } }
  }

  return msg
}
```

Helper `isOnlyToolResult`:

```typescript
function isOnlyToolResult(msg: SDKUserMessage): boolean {
  return msg.message.content.every(
    (block) => typeof block !== "string" && block.type === "tool_result"
  )
}
```

Assinatura:

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `msg` | `SDKMessage` | Mensagem do stream do CLI |
| `locale` | `string \| undefined` | Locale BCP 47 do consumer |
| **retorno** | `SDKMessage \| null` | Mensagem transformada, ou `null` para suprimir |

Comportamento por tipo de mensagem:

| `msg.type` | Acao |
|------------|------|
| `"assistant"` com `tool_use` blocks | Substitui `input` por `ToolIntentionPayload` (exceto `mcp__display__*`) |
| `"user"` com conteudo somente `tool_result` | Retorna `null` — mensagem suprimida |
| Qualquer outro tipo | Retorna mensagem inalterada |

Regras:
- **100% sincrono** — zero `await`
- Retorno `null` = suprimir mensagem inteira — caller faz `continue`
- Shallow copy com spread — NAO muta original
- `satisfies ToolIntentionPayload` garante type safety
- Manter `type: "tool_use"` no bloco — NAO inventar novo tipo
- Display tools (`mcp__display__*`) bypassam completamente — o bloco passa integral

### Feature F-144 — Barrel src/tool-intention/index.ts

Criar `src/tool-intention/index.ts`:

```typescript
export { pickIntention } from "./picker.js"
export { applyToolIntentionFilter } from "./filter.js"
export type { ToolIntentionPayload } from "./types.js"
```

Regras:
- Re-exporta apenas a API publica do modulo
- `ToolIntentionPayload` como `export type` (tree-shaking)
- Extensao `.js` nos import paths (ESM)

### Feature F-145 — Exports publicos em src/index.ts

Na secao de exports de `src/index.ts`, adicionar nova secao:

```typescript
// ---------------------------------------------------------------------------
// Tool Intention Filter
// ---------------------------------------------------------------------------

export { pickIntention, applyToolIntentionFilter } from "./tool-intention/index.js"
export type { ToolIntentionPayload } from "./tool-intention/index.js"
```

Regras:
- Posicionado apos a secao de Locale exports (seguindo ordem logica do milestone-04)
- Extensao `.js` no import path (ESM)
- `ToolIntentionPayload` como `export type`

### Feature F-146 — Integracao do filtro no lifecycleGenerator de query.ts

Import no topo de `query.ts`:

```typescript
import { applyToolIntentionFilter } from "./tool-intention/index.js"
```

Integracao em **dois pontos** dentro do `lifecycleGenerator`:

**Ponto 1 — Loop com heartbeat (Promise.race):**

Apos `yield* drainHeartbeats()` e `processMsg()`, antes do yield original:

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

**Ponto 2 — Loop simples (heartbeat desabilitado):**

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

Regras:
- `optionsForCli` ja tem acesso a `toolOutputMode` e `locale` via `Options`
- Quando `toolOutputMode` e `undefined`, trata como `"intention"` (filtro ativo) — check e `!== "full"`
- `filtered === null` → `continue` (pula mensagem suprimida)
- Filtro aplicado **apos** `processMsg()` — mensagens internas do SDK nao passam pelo filtro
- Filtro aplicado **apos** `drainHeartbeats()` — heartbeats nao sao atrasados

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `toolOutputMode: "intention"` + `tool_use` Bash | `input` substituido por `ToolIntentionPayload` com `_intention` em locale ativo |
| `toolOutputMode: "intention"` + `tool_result` | Mensagem suprimida (nao emitida ao consumer) |
| `toolOutputMode: "intention"` + `mcp__display__display_highlight` | `tool_use` passa integral — input original preservado |
| `toolOutputMode: "full"` + qualquer mensagem | Mensagem inalterada — bypass completo |
| `toolOutputMode: undefined` + `tool_use` Bash | Tratado como `"intention"` — `input` substituido |
| Mensagem `assistant` com texto e `tool_use` misturados | Texto preservado, apenas blocos `tool_use` tem input substituido |
| Mensagem `user` com texto e `tool_result` misturados | Mensagem NAO suprimida (`isOnlyToolResult` retorna false) |
| `import { applyToolIntentionFilter } from "openclaude-sdk"` | Funciona — export publico |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-143 | applyToolIntentionFilter | Funcao em `src/tool-intention/filter.ts` — transforma `tool_use` blocks, suprime `tool_result`, bypass de display tools |
| F-144 | toolIntentionBarrel | Barrel `src/tool-intention/index.ts` re-exportando `pickIntention`, `applyToolIntentionFilter`, `ToolIntentionPayload` |
| F-145 | toolIntentionExports | Exports publicos em `src/index.ts` — `pickIntention`, `applyToolIntentionFilter`, `ToolIntentionPayload` |
| F-146 | toolIntentionIntegration | Integracao do filtro no `lifecycleGenerator` de `query.ts` nos dois loops (com e sem heartbeat) |

## Limites

- NAO alterar `src/types/options.ts` — escopo de PRP-053
- NAO alterar `src/tool-intention/types.ts` — escopo de PRP-053
- NAO alterar `src/tool-intention/picker.ts` — escopo de PRP-053
- NAO alterar dicionarios JSON — escopo de PRP-053
- NAO adicionar testes unitarios (nao ha framework de teste configurado)
- NAO implementar filtro seletivo de `tool_result` por display tool — v1 suprime todos os `tool_result`
- NAO implementar cache de mensagens filtradas — filtro e stateless

## Dependencias

Depende de **PRP-053** (tipo, option, dicionarios e picker existem). **Bloqueante para PRP-055** (validacao final depende de toda a integracao estar feita).
