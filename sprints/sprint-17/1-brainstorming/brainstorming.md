# Brainstorming — Sprint 17

## Contexto

O TASK.md desta wave define a implementação do **Tool Intention Filter**, identificado
como o entregável mais visível do milestone-04 para o usuário final. O filtro substitui
o conteúdo bruto de blocos `tool_use` (paths, comandos, argumentos) por frases curtas
descrevendo a intenção da chamada, no idioma definido por `options.locale`.

A feature resolve três problemas reais no SDK atual:
1. **Leak técnico** — `tool_use.input` expõe estrutura de diretórios e comandos literais
2. **Leak de privacidade** — queries de busca aparecem antes do resultado no stream
3. **Ruído de UX** — ver `find / -name "*.env"` numa bolha de chat quebra a narrativa

A dependência bloqueante `milestone-04/01-locale-options` já está implementada:
- `src/locale/types.ts`, `src/locale/normalize.ts`, `src/locale/index.ts` — prontos
- `Options.locale?: string` com JSDoc completo — já em `src/types/options.ts`
- `Options.presenceIntervalMs?: number` — já implementado
- `SDKPresenceMessage` — já no discriminated union `SDKMessage`
- Heartbeat completo no `lifecycleGenerator` de `query.ts`

## Funcionalidades mapeadas (estado atual do código)

### Já implementado (sprints anteriores)

| Componente | Status |
|---|---|
| `src/locale/` — `normalizeLocale()`, `SupportedLocale`, `SUPPORTED_LOCALES` | ✅ Implementado |
| `Options.locale?: string` com fallback chain pt-BR/en-US/es-ES | ✅ Implementado |
| `Options.presenceIntervalMs?: number` | ✅ Implementado |
| `SDKPresenceMessage` no union `SDKMessage` | ✅ Implementado |
| Heartbeat no `lifecycleGenerator` com `setInterval` + `Promise.race` | ✅ Implementado |
| `collectMessages()` filtra `presence` messages | ✅ Implementado |
| `prompt()` helper em `session-v2.ts` | ✅ Implementado |
| Display tools (`mcp__display__*`) via `richOutput: true` | ✅ Implementado |
| `askUser` injection via MCP server | ✅ Implementado |

### Não implementado (alvo desta wave)

| Componente | Status |
|---|---|
| `Options.toolOutputMode?: "intention" \| "full"` | ❌ Falta |
| `src/tool-intention/locales/pt-BR.json` — 23 tools × 5 variantes | ❌ Falta |
| `src/tool-intention/locales/en-US.json` — idem | ❌ Falta |
| `src/tool-intention/locales/es-ES.json` — idem | ❌ Falta |
| `pickIntention(toolName, locale)` — seleção aleatória sem async | ❌ Falta |
| `applyToolIntentionFilter(msg, locale)` — transforma `tool_use`, suprime `tool_result` | ❌ Falta |
| Integração do filtro no `lifecycleGenerator` de `query.ts` | ❌ Falta |
| Bypass de display tools (`mcp__display__*`) | ❌ Falta |
| Exports públicos em `src/index.ts` | ❌ Falta |
| `scripts/translate-locale.ts` com validação e fallback | ❌ Falta |
| `npm run translate -- xx-YY` no `package.json` | ❌ Falta |

## Lacunas e oportunidades

### Lacuna principal: módulo `src/tool-intention/` ausente

O TASK.md especifica uma estrutura precisa de arquivos que não existe ainda:
```
src/tool-intention/
  index.ts         # barrel
  filter.ts        # applyToolIntentionFilter
  picker.ts        # pickIntention
  types.ts         # ToolIntentionPayload
  locales/
    pt-BR.json
    en-US.json
    es-ES.json
```

### Lacuna: `Options` sem `toolOutputMode`

O campo `toolOutputMode?: "intention" | "full"` não existe em
`src/types/options.ts`. Precisa ser adicionado com JSDoc explicando o comportamento
de cada valor, incluindo a exceção para display tools.

### Lacuna: integração com `lifecycleGenerator`

O `query.ts` já tem a estrutura correta para inserção do filtro. O ponto de
integração está em dois lugares:
1. Loop principal com heartbeat — após `yield* drainHeartbeats()`, antes de `yield result.value`
2. Loop simples sem heartbeat — dentro do `for await`, antes do `yield msg`

O TASK.md especifica a integração logo após o drain de heartbeats, usando:
```typescript
if (optionsForCli.toolOutputMode !== "full") {
  const filtered = applyToolIntentionFilter(msg, optionsForCli.locale)
  if (filtered === null) continue
  yield filtered
} else {
  yield msg
}
```

### Lacuna: dicionários JSON com 345 strings

23 tools × 5 variantes × 3 locales = 345 strings. As tools built-in cobertas são:
`Task, AskUserQuestion, Bash, Edit, EnterPlanMode, EnterWorktree, ExitPlanMode,
ExitWorktree, Glob, Grep, NotebookEdit, Read, SendMessage, Skill, TaskOutput,
TaskStop, TeamCreate, TeamDelete, TodoWrite, ToolSearch, WebFetch, WebSearch, Write`
+ `_fallback`.

### Lacuna: script `translate-locale.ts` ausente

O diretório `scripts/` não existe. O script precisa ser criado do zero com:
- Validação BCP 47 básica
- Verificação de arquivo existente (--force)
- Uso do `prompt()` helper do SDK para tradução
- Fallback para pt-BR em caso de falha (com comentário TODO)
- Log de progresso por tool

### Oportunidade: filtro `tool_result` melhora UX sem custo

Suprimir `tool_result` no modo `"intention"` é simples (retornar `null`) e elimina
ruído: o consumer não precisa ver "tool completou" após já ter visto "executando X".
O próximo bloco de texto do assistant cobre o fechamento narrativo naturalmente.

### Oportunidade: bypass de display tools é crítico para integridade

Display tools (`mcp__display__*`) são o conteúdo visual renderizado pelo cliente.
Filtrar o `input` delas quebraria a exibição de métricas, gráficos, etc. O bypass
deve ser implementado com verificação de prefixo `mcp__display__` no nome da tool.

### Inconsistência identificada: `isOnlyToolResult()` helper não existe

A função `isOnlyToolResult(msg)` mencionada no TASK.md precisa ser implementada
em `filter.ts`. Ela verifica se `msg.type === "user"` e se todo o content é
`tool_result` blocks.

## Priorização

### Ranking por impacto e ordem lógica de implementação

| # | ID | Feature | Score | Justificativa |
|---|---|---|---|---|
| 1 | D-124 | `Options.toolOutputMode` em `options.ts` | 9 | Pré-requisito de tudo |
| 2 | D-125 | `ToolIntentionPayload` type em `types.ts` | 7 | Shape do objeto filtrado |
| 3 | D-126 | `pt-BR.json` — 23 tools × 5 variantes + _fallback | 10 | Core do feature — sem ele nada funciona |
| 4 | D-127 | `en-US.json` — 23 tools × 5 variantes + _fallback | 9 | Locale padrão internacional |
| 5 | D-128 | `es-ES.json` — 23 tools × 5 variantes + _fallback | 8 | 3º locale obrigatório da v1 |
| 6 | D-129 | `pickIntention(toolName, locale)` em `picker.ts` | 9 | Motor de seleção — 100% síncrono |
| 7 | D-130 | `applyToolIntentionFilter(msg, locale)` em `filter.ts` | 10 | Transforma tool_use, suprime tool_result |
| 8 | D-131 | Barrel `index.ts` do módulo tool-intention | 7 | Encapsulamento do módulo |
| 9 | D-132 | Integração do filtro no `lifecycleGenerator` de `query.ts` | 10 | Ponto de ativação do feature |
| 10 | D-133 | Exports públicos em `src/index.ts` | 7 | API pública do SDK |
| 11 | D-134 | Script `scripts/translate-locale.ts` | 8 | Tooling de i18n para novos locales |
| 12 | D-135 | `npm run translate` no `package.json` | 6 | Conveniência de invocação |
| 13 | D-136 | Typecheck e build passando | 9 | Validação de integridade |
