# openclaude-sdk - applyToolIntentionFilter: filtro de tool_use e tool_result

Spec da funcao `applyToolIntentionFilter` que transforma mensagens do stream substituindo `tool_use.input` e suprimindo `tool_result`.

---

## Objetivo

Resolve D-130.

| Problema | Consequencia |
|----------|-------------|
| `tool_use.input` no stream contem paths absolutos, comandos e argumentos | Leak de informacao sensivel para o consumer |
| `tool_result` duplica informacao apos tool_use filtrado | Ruido de UX — consumer ve "concluido" sem ter visto o conteudo real |

---

## Estado Atual

### `src/types/messages.ts`

- `SDKAssistantMessage` tem `message.content: ContentBlock[]` onde `ContentBlock` inclui `ToolUseBlock`
- `SDKUserMessage` tem `message.content` que pode conter `ToolResultBlock`
- O discriminante principal e `msg.type` (`"assistant"` vs `"user"`)

---

## Implementacao

### 1. Criar `src/tool-intention/filter.ts`

```typescript
import type { SDKMessage } from "../types/messages.js"
import { pickIntention } from "./picker.js"
import type { ToolIntentionPayload } from "./types.js"

export function applyToolIntentionFilter(
  msg: SDKMessage,
  locale: string | undefined,
): SDKMessage | null {
  // tool_result: suprime mensagem inteira
  if (msg.type === "user" && isOnlyToolResult(msg)) {
    return null
  }

  // tool_use blocks: substitui input
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

### Assinatura

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `msg` | `SDKMessage` | Mensagem do stream do CLI |
| `locale` | `string \| undefined` | Locale BCP 47 do consumer |
| **retorno** | `SDKMessage \| null` | Mensagem transformada, ou `null` para suprimir |

### Comportamento por tipo de mensagem

| `msg.type` | Acao |
|------------|------|
| `"assistant"` | Itera `message.content`, substitui `input` de blocos `tool_use` (exceto `mcp__display__*`) |
| `"user"` com conteudo somente `tool_result` | Retorna `null` — mensagem suprimida |
| Qualquer outro tipo | Retorna mensagem inalterada |

### Helper `isOnlyToolResult`

```typescript
function isOnlyToolResult(msg: SDKUserMessage): boolean {
  return msg.message.content.every(
    (block) => typeof block !== "string" && block.type === "tool_result"
  )
}
```

Verifica se todos os blocos de content sao `tool_result`. Se houver texto misturado, nao suprime.

### Bypass de display tools

- Tools com nome iniciando em `mcp__display__` nao sao filtradas
- O bloco `tool_use` passa integral com `input` original
- Motivo: display tools SAO o conteudo visual renderizado pelo cliente

### Regras

- **100% sincrono** — zero `await`
- Retorno `null` significa "suprimir mensagem inteira" — o caller (lifecycleGenerator) faz `continue`
- Shallow copy com spread (`{ ...msg, message: { ...msg.message, content: newContent } }`) — nao muta original
- `satisfies ToolIntentionPayload` garante type safety no objeto sintetico
- Manter `type: "tool_use"` no bloco — nao inventar novo tipo de bloco

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/tool-intention/filter.ts` | Novo arquivo — funcao `applyToolIntentionFilter` + helper `isOnlyToolResult` |

---

## Criterios de Aceite

- [ ] `applyToolIntentionFilter(msg, locale)` exportado de `src/tool-intention/filter.ts`
- [ ] Mensagens `assistant` com `tool_use` blocks tem `input` substituido por `ToolIntentionPayload`
- [ ] Mensagens `user` com somente `tool_result` retornam `null`
- [ ] Display tools (`mcp__display__*`) passam sem filtro
- [ ] Mensagens de outros tipos passam inalteradas
- [ ] Zero `await` na implementacao
- [ ] Shallow copy — nao muta mensagem original
- [ ] `tsc --noEmit` passa sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `applyToolIntentionFilter()` | S-092 |
| `isOnlyToolResult()` helper | S-092 |
| D-130 | S-092 |
