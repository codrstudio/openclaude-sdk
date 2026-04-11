# openclaude-sdk - ToolIntentionPayload: shape do input filtrado

Spec do tipo `ToolIntentionPayload` que define o formato do `input` substituido no modo `"intention"`.

---

## Objetivo

Resolve D-125.

| Problema | Consequencia |
|----------|-------------|
| Nao existe tipo para o objeto sintetico que substitui `tool_use.input` | Consumidores nao conseguem fazer type narrowing no input filtrado |
| Shape precisa de marcador explicito (`_filtered`) para distinguir de input real | Sem marcador, codigo que inspeciona `input` pode confundir metadado com dados reais |

---

## Estado Atual

### `src/types/messages.ts`

- `ToolUseBlock` tem campo `input: Record<string, unknown>`
- O filtro precisa substituir esse `input` por um objeto com shape diferente
- Consumidores precisam distinguir input real de input filtrado

---

## Implementacao

### 1. Criar `src/tool-intention/types.ts`

```typescript
export interface ToolIntentionPayload {
  _intention: string
  _toolName: string
  _toolUseId: string
  _filtered: true
}
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `_intention` | `string` | Frase curta descrevendo a intencao da chamada, no locale ativo |
| `_toolName` | `string` | Nome original da tool (ex: `"Bash"`, `"Read"`) |
| `_toolUseId` | `string` | ID original do bloco `tool_use` (ex: `"toolu_01abc"`) |
| `_filtered` | `true` | Literal booleano `true` — marcador de que o input foi substituido pelo SDK |

### Regras

- Todos os campos com prefixo `_` (underline leading) — convencao de metadado do SDK
- `_filtered` e literal `true`, nao `boolean` — permite type guard `if ('_filtered' in input && input._filtered)`
- Interface exportada de `src/tool-intention/types.ts` e re-exportada pelo barrel `src/tool-intention/index.ts`
- Consumidores podem fazer type guard: `function isFiltered(input: unknown): input is ToolIntentionPayload`

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/tool-intention/types.ts` | Novo arquivo — interface `ToolIntentionPayload` |

---

## Criterios de Aceite

- [ ] Interface `ToolIntentionPayload` exportada de `src/tool-intention/types.ts`
- [ ] Campos: `_intention: string`, `_toolName: string`, `_toolUseId: string`, `_filtered: true`
- [ ] `_filtered` e literal `true`, nao `boolean`
- [ ] `tsc --noEmit` passa sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `ToolIntentionPayload` interface | S-089 |
| D-125 | S-089 |
