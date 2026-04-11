# PRP-053 — Tool Intention core: tipo, option, dicionarios e picker

## Objetivo

Criar a fundacao do Tool Intention Filter: campo `toolOutputMode` em `Options`, tipo `ToolIntentionPayload`, tres dicionarios JSON (pt-BR, en-US, es-ES) com frases de intencao para 23 tools built-in, e funcao `pickIntention` para selecao aleatoria por locale.

Referencia: specs S-088 (D-124), S-089 (D-125), S-090 (D-126, D-127, D-128), S-091 (D-129).

## Execution Mode

`implementar`

## Contexto

O SDK hoje propaga blocos `tool_use` com `input` cru — paths absolutos, comandos literais, argumentos sensiveis. Para UIs de produto (chat), isso causa leak tecnico, leak de privacidade e ruido de UX. A solucao e substituir o `input` por uma frase curta de intencao, multilingue e deterministica.

A dependencia `milestone-04/01-locale-options` ja esta implementada:
- `src/locale/types.ts`, `src/locale/normalize.ts`, `src/locale/index.ts` — prontos
- `normalizeLocale(raw)` normaliza para `SupportedLocale` (`"pt-BR" | "en-US" | "es-ES"`)
- `Options.locale?: string` ja existe em `src/types/options.ts`

Este PRP cria tudo que o filtro (PRP-054) precisa para funcionar: o campo de controle, o tipo do payload, os dicionarios de strings e a funcao de selecao.

## Especificacao

### Feature F-139 — Campo toolOutputMode em Options

Em `src/types/options.ts`, apos o campo `presenceIntervalMs`, antes de `sandbox`:

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

Regras:
- Default e `"intention"` — filtro ativo por padrao
- Valor `"full"` desliga completamente o filtro
- Campo NAO gera flag CLI — puramente SDK-side
- Tipo union literal, NAO string generico

### Feature F-140 — ToolIntentionPayload tipo

Criar `src/tool-intention/types.ts`:

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
| `_intention` | `string` | Frase curta descrevendo a intencao, no locale ativo |
| `_toolName` | `string` | Nome original da tool (ex: `"Bash"`, `"Read"`) |
| `_toolUseId` | `string` | ID original do bloco `tool_use` (ex: `"toolu_01abc"`) |
| `_filtered` | `true` | Literal booleano `true` — marcador de que o input foi substituido |

Regras:
- Todos os campos com prefixo `_` (underline leading) — convencao de metadado do SDK
- `_filtered` e literal `true`, NAO `boolean` — permite type guard `if ('_filtered' in input && input._filtered)`
- Consumidores podem usar: `function isFiltered(input: unknown): input is ToolIntentionPayload`

### Feature F-141 — Dicionarios JSON pt-BR, en-US, es-ES

Criar tres arquivos:
- `src/tool-intention/locales/pt-BR.json`
- `src/tool-intention/locales/en-US.json`
- `src/tool-intention/locales/es-ES.json`

Formato de cada arquivo — objeto com 24 chaves (23 tools + `_fallback`), cada uma com array de exatamente 5 strings:

```json
{
  "Task": ["variante1", "variante2", "variante3", "variante4", "variante5"],
  "AskUserQuestion": [...],
  "Bash": [...],
  "Edit": [...],
  "EnterPlanMode": [...],
  "EnterWorktree": [...],
  "ExitPlanMode": [...],
  "ExitWorktree": [...],
  "Glob": [...],
  "Grep": [...],
  "NotebookEdit": [...],
  "Read": [...],
  "SendMessage": [...],
  "Skill": [...],
  "TaskOutput": [...],
  "TaskStop": [...],
  "TeamCreate": [...],
  "TeamDelete": [...],
  "TodoWrite": [...],
  "ToolSearch": [...],
  "WebFetch": [...],
  "WebSearch": [...],
  "Write": [...],
  "_fallback": [...]
}
```

23 tools cobertas: `Task, AskUserQuestion, Bash, Edit, EnterPlanMode, EnterWorktree, ExitPlanMode, ExitWorktree, Glob, Grep, NotebookEdit, Read, SendMessage, Skill, TaskOutput, TaskStop, TeamCreate, TeamDelete, TodoWrite, ToolSearch, WebFetch, WebSearch, Write`.

Regras:
- 5 variantes por tool por locale — pick aleatorio em runtime
- Strings curtas (max 6 palavras), neutras, no gerundio ou forma equivalente
- Sem emoji, sem giria, sem antropomorfismo
- Sem pontuacao final nas frases
- `_fallback` e a unica chave com prefixo `_` — usada para tools nao mapeadas
- Cada JSON deve ter exatamente 24 chaves
- NAO traduzir literalmente entre locales — usar formas idiomaticas do idioma

Exemplos pt-BR:
```json
{
  "Bash": [
    "Executando um comando",
    "Rodando uma operacao no terminal",
    "Executando uma acao no sistema",
    "Processando um comando",
    "Rodando um script"
  ],
  "Read": [
    "Lendo um arquivo",
    "Consultando um documento",
    "Abrindo um arquivo",
    "Verificando conteudo de um arquivo",
    "Acessando um documento"
  ]
}
```

Exemplos en-US:
```json
{
  "Bash": [
    "Running a command",
    "Executing a terminal operation",
    "Running a system action",
    "Processing a command",
    "Running a script"
  ]
}
```

### Feature F-142 — pickIntention funcao de selecao

Criar `src/tool-intention/picker.ts`:

```typescript
import ptBR from "./locales/pt-BR.json" with { type: "json" }
import enUS from "./locales/en-US.json" with { type: "json" }
import esES from "./locales/es-ES.json" with { type: "json" }
import { normalizeLocale, type SupportedLocale } from "../locale/index.js"

const DICTS: Record<SupportedLocale, Record<string, string[]>> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
}

export function pickIntention(
  toolName: string,
  locale: string | undefined,
): string {
  const normalized = normalizeLocale(locale)
  const dict = DICTS[normalized] ?? DICTS["en-US"]

  let list = dict[toolName]
  if (!list) {
    const lastSegment = toolName.split("__").pop()
    if (lastSegment) list = dict[lastSegment]
  }
  if (!list || list.length === 0) list = dict._fallback ?? []
  if (list.length === 0) return "Usando uma ferramenta"

  return list[Math.floor(Math.random() * list.length)]
}
```

Assinatura:

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `toolName` | `string` | Nome da tool (ex: `"Bash"`, `"mcp__github__create_issue"`) |
| `locale` | `string \| undefined` | Locale BCP 47 do consumer |
| **retorno** | `string` | Frase de intencao selecionada |

Fallback em duas etapas para MCP tools (`mcp__<server>__<tool>`):
1. Tenta o nome completo no dicionario
2. Se nao encontra, extrai ultimo segmento apos `__` e tenta
3. Se nao encontra, usa `_fallback`
4. Se `_fallback` tambem nao existir, retorna `"Usando uma ferramenta"`

Regras:
- **100% sincrono** — zero `await`, zero `fetch`, zero dependencia externa
- Imports estaticos com `with { type: "json" }` — dicionarios carregados em tempo de bundle
- `Math.random()` para selecao aleatoria
- Funcao pura exceto pela aleatoriedade
- Locale `undefined` resolve para o default de `normalizeLocale()` (pt-BR)

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `pickIntention("Bash", "pt-BR")` | Uma das 5 variantes de Bash em pt-BR |
| `pickIntention("Bash", "en-US")` | Uma das 5 variantes de Bash em en-US |
| `pickIntention("Bash", undefined)` | Uma das 5 variantes de Bash em pt-BR (default) |
| `pickIntention("mcp__github__create_issue", "en-US")` | Uma das 5 variantes de `_fallback` em en-US |
| `pickIntention("mcp__display__Read", "pt-BR")` | Uma das 5 variantes de `Read` em pt-BR (match ultimo segmento) |
| `pickIntention("ToolDesconhecida", "es-ES")` | Uma das 5 variantes de `_fallback` em es-ES |
| `pickIntention("Bash", "fr-FR")` | Uma das 5 variantes de Bash em en-US (locale nao suportado → fallback en-US) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-139 | toolOutputModeOption | Campo `toolOutputMode?: "intention" \| "full"` em `Options` com JSDoc e default `"intention"` |
| F-140 | toolIntentionPayloadType | Interface `ToolIntentionPayload` em `src/tool-intention/types.ts` com campos `_intention`, `_toolName`, `_toolUseId`, `_filtered` |
| F-141 | localeDictionaries | Tres JSONs em `src/tool-intention/locales/` — 23 tools × 5 variantes + `_fallback`, em pt-BR, en-US, es-ES |
| F-142 | pickIntentionFn | Funcao `pickIntention(toolName, locale)` em `src/tool-intention/picker.ts` — selecao aleatoria com fallback em duas etapas |

## Limites

- NAO criar barrel `src/tool-intention/index.ts` — escopo de PRP-054
- NAO criar `src/tool-intention/filter.ts` — escopo de PRP-054
- NAO alterar `src/query.ts` — escopo de PRP-054
- NAO alterar `src/index.ts` (exports publicos) — escopo de PRP-054
- NAO adicionar testes unitarios (nao ha framework de teste configurado)
- NAO implementar traducao runtime por LLM — dicionario estatico e definitivo
- NAO implementar pluralizacao ou variaveis ICU
- NAO curar mensagens especificas para MCP tools de terceiros — `_fallback` cobre todas

## Dependencias

Depende de `milestone-04/01-locale-options` (ja implementado): `normalizeLocale()`, `SupportedLocale` de `src/locale/`. **Bloqueante para PRP-054** (filtro e integracao dependem de tipo, option, dicionarios e picker existirem).
