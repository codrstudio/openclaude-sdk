# openclaude-sdk - Campo toolOutputMode em Options

Spec do novo campo `toolOutputMode` na interface `Options` para controlar exposicao de conteudo de `tool_use` blocks.

---

## Objetivo

Resolve D-124.

| Problema | Consequencia |
|----------|-------------|
| `tool_use.input` expoe paths absolutos, comandos e argumentos sensiveis | Leak tecnico e de privacidade em UIs de produto |
| Nao existe forma de controlar esse comportamento no SDK | Consumidores precisam implementar filtro proprio, cada um de forma diferente |

---

## Estado Atual

### `src/types/options.ts`

- Interface `Options` ja tem `locale?: string` e `presenceIntervalMs?: number`
- Nao existe campo para controlar output de tools
- O campo deve ser adicionado junto aos demais campos de controle de output (`richOutput`, `reactOutput`)

---

## Implementacao

### 1. Adicionar `toolOutputMode` em `Options` (`src/types/options.ts`)

Apos o campo `presenceIntervalMs`, antes de `sandbox`:

```typescript
/**
 * Controla quanto do conteudo interno de `tool_use` blocks e exposto
 * ao consumer:
 *
 * - "intention" (default): substitui `input` por uma frase curta
 *   descrevendo a intencao da chamada, no idioma de `options.locale`.
 *   Protege contra leak de paths, comandos, argumentos sensiveis.
 *
 * - "full": passa o `tool_use` original sem modificacao. Use apenas
 *   em contextos de desenvolvimento/debug ou em UIs de confianca.
 *
 * Display tools (`mcp__display__*`) nunca sao filtradas — elas
 * SAO o conteudo visual renderizado pelo cliente.
 *
 * Default: "intention"
 */
toolOutputMode?: "intention" | "full"
```

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `toolOutputMode` | `"intention" \| "full"` | `"intention"` | Modo de exposicao de `tool_use` blocks |

### Regras

- Default e `"intention"` — filtro ativo por padrao para seguranca
- Valor `"full"` desliga completamente o filtro
- Campo nao gera flag CLI — e puramente SDK-side
- Posicao no interface: apos `presenceIntervalMs`, antes de `sandbox`

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/options.ts` | Novo campo `toolOutputMode` na interface `Options` |

---

## Criterios de Aceite

- [ ] `toolOutputMode?: "intention" | "full"` presente em `Options`
- [ ] JSDoc com descricao dos dois modos e excecao para display tools
- [ ] Default documentado como `"intention"` no JSDoc
- [ ] `tsc --noEmit` passa sem erro
- [ ] Campo acessivel via `options.toolOutputMode` sem cast

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `Options.toolOutputMode` | S-088 |
| D-124 | S-088 |
