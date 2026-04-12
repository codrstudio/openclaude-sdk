# Tool Intention Filter — substitui `tool_use.input` cru por placeholders narrativos multilingue

Adiciona uma flag `toolOutputMode: "intention" | "full"` em `Options` que, quando
`"intention"` (default), substitui o conteudo de cada bloco `tool_use` emitido
pelo agente por uma frase curta descrevendo a INTENCAO da chamada, no idioma
definido por `options.locale`. O conteudo real (comando, paths, args) **nao
chega ao consumidor** nesse modo — eliminando leak de info sensivel.

Inclui:
- Dicionario por locale/tool em JSON (3 locales iniciais: pt-BR, en-US, es-ES)
- Script `npm run translate xx-YY` que gera o JSON de um novo locale usando
  o proprio `openclaude` como tradutor, usando pt-BR como origem
- Bypass automatico para `mcp__display__*` (display tools nao sao filtradas)
- Filtro sincrono sem await (preserva streaming 100%)

---

## Contexto

Hoje, quando o agente chama uma tool, o SDK propaga o bloco `tool_use` original
pro consumer com `input` cheio — path absoluto, comando, argumentos, query de
busca, etc. Para um desenvolvedor usando o SDK isso e util (debug, logs). Para
um **chat de produto exposto ao usuario final** e desastre:

1. **Leak tecnico**: expoe estrutura de diretorios, nomes de arquivos internos,
   comandos executados — informacao que da mapa de ataque pra quem inspeciona
   o stream.
2. **Leak de privacidade**: se o agente pesquisar dados sobre uma pessoa ou
   empresa, o query literal aparece na UI do usuario — mesmo que so seja
   exibido por 200ms antes do resultado chegar.
3. **Ruido de UX**: ver `Bash: find / -name "*.env" -type f 2>/dev/null` numa
   bolha de chat quebra a ilusao de um "assistente" — revela a maquinaria.

O estado da arte em UIs de agente (Cursor, Cline, Claude.ai, v0.dev) e sempre
mostrar uma **narrativa de intenção**, nao o comando bruto. Esta task traz o
mesmo padrao pro SDK como primeira-classe, com tres caracteristicas chave:
multilingue, determinista (sem LLM em tempo de request), zero latencia.

---

## Design

### Flag em `Options`

```typescript
interface Options {
  /**
   * Controla quanto do conteudo interno de `tool_use` blocks e exposto
   * ao consumer:
   *
   * - "intention" (default): substitui `input` por uma frase curta
   *   descrevendo a intenção da chamada, no idioma de `options.locale`.
   *   Protege contra leak de paths, comandos, argumentos sensíveis.
   *
   * - "full": passa o `tool_use` original sem modificacao. Use apenas
   *   em contextos de desenvolvimento/debug ou em UIs que voce confia
   *   100%.
   *
   * Display tools (`mcp__display__*`) **nunca** sao filtradas — elas
   * SAO o conteudo visual renderizado pelo cliente.
   *
   * Default: "intention"
   */
  toolOutputMode?: "intention" | "full"
}
```

### Shape do bloco filtrado

No modo `"intention"`, cada `tool_use` block tem seu `input` substituido por
um objeto sintetico marcado com `_` (underline leading) pra indicar que e
metadado do SDK, nao do modelo:

```typescript
// Antes do filtro (CLI raw):
{
  type: "tool_use",
  id: "toolu_01abc",
  name: "Bash",
  input: { command: "grep -rn 'API_KEY' ~/.config" }
}

// Depois do filtro:
{
  type: "tool_use",
  id: "toolu_01abc",
  name: "Bash",
  input: {
    _intention: "Procurando por padroes no codigo",
    _toolName: "Bash",
    _toolUseId: "toolu_01abc",
    _filtered: true,
  }
}
```

Manter `type: "tool_use"` (nao inventar novo tipo) garante que clientes
existentes que iteram por `block.type` continuam identificando o bloco
como "operacao em curso" — eles so veem um `input` diferente.

### `tool_result` no modo intention

Blocos `tool_result` (que aparecem como content de um `SDKUserMessage` tipo
"tool_result") sao **suprimidos** no modo intention — o consumer nao recebe
a mensagem de user-tool-result de volta. Motivo: o placeholder do `tool_use`
ja comunicou visualmente "operacao em andamento"; mostrar um "concluido"
duplica sem agregar, e o proximo chunk de texto do assistant natural cobre
o fechamento narrativo.

Implementacao: o filtro dentro do `lifecycleGenerator` detecta
`SDKUserMessage` com content contendo blocos `tool_result` e nao emite a
mensagem para o consumer (skip inteiro).

**Excecao**: se o `tool_use` correspondente era de uma display tool (nao
filtrada), o `tool_result` passa. Display tools SAO o conteudo visual.

### Dicionario JSON por locale

Estrutura em `src/tool-intention/locales/<locale>.json`:

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
  ],
  "Write": [...],
  "_fallback": [
    "Usando uma ferramenta",
    "Executando uma operacao",
    "Realizando uma acao",
    "Processando uma tarefa",
    "Trabalhando num recurso"
  ]
}
```

Uma entrada por built-in tool + uma `_fallback` usada quando o nome da tool
nao esta no dicionario (ex: MCP tools externas). 5 variantes por tool por
locale. Pick random em runtime.

### Tools built-in cobertas (v1)

Lista extraida do init message do CLI `openclaude` 2.1.101:

```
Task, AskUserQuestion, Bash, Edit, EnterPlanMode, EnterWorktree,
ExitPlanMode, ExitWorktree, Glob, Grep, NotebookEdit, Read, SendMessage,
Skill, TaskOutput, TaskStop, TeamCreate, TeamDelete, TodoWrite, ToolSearch,
WebFetch, WebSearch, Write
```

23 tools × 5 variantes × 3 locales = **345 strings na v1**. Commitadas no
repo como JSON legivel.

### Funcao `pickIntention`

```typescript
// src/tool-intention/index.ts
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

  // MCP tools chegam como "mcp__<server>__<tool>" — tenta o nome completo,
  // depois o sufixo, depois fallback
  let list = dict[toolName]
  if (!list) {
    const lastSegment = toolName.split("__").pop()
    if (lastSegment) list = dict[lastSegment]
  }
  if (!list || list.length === 0) list = dict._fallback ?? []
  if (list.length === 0) return "Usando uma ferramenta" // ultimo recurso

  return list[Math.floor(Math.random() * list.length)]
}
```

Zero async. Zero fetch. Zero dependencia externa em runtime.

### Filtro integrado ao `query.ts`

Dentro do `lifecycleGenerator`, apos a leitura de cada mensagem do CLI:

```typescript
for await (const msg of stream) {
  yield* drainHeartbeats()

  if (optionsForCli.toolOutputMode !== "full") {
    const filtered = applyToolIntentionFilter(msg, optionsForCli.locale)
    if (filtered === null) continue  // mensagem inteira suprimida (tool_result)
    yield filtered
  } else {
    yield msg
  }
}
```

A funcao `applyToolIntentionFilter(msg, locale)` em
`src/tool-intention/filter.ts`:

```typescript
export function applyToolIntentionFilter(
  msg: SDKMessage,
  locale: string | undefined,
): SDKMessage | null {
  // tool_result msgs: suprime inteira (exceto se for de display tool)
  if (msg.type === "user" && isOnlyToolResult(msg)) {
    // TODO: se o tool_use correspondente era de display, preservar.
    // v1: suprime tudo por simplicidade.
    return null
  }

  // tool_use blocks: filtra content
  if (msg.type === "assistant") {
    const newContent = msg.message.content.map((block) => {
      if (block.type !== "tool_use") return block
      if (block.name.startsWith("mcp__display__")) return block  // bypass
      return {
        ...block,
        input: {
          _intention: pickIntention(block.name, locale),
          _toolName: block.name,
          _toolUseId: block.id,
          _filtered: true,
        },
      }
    })
    return { ...msg, message: { ...msg.message, content: newContent } }
  }

  return msg
}
```

Tudo sincrono. Nenhum `await`. Streaming 100% preservado.

---

## Script `npm run translate xx-YY`

Gera um novo arquivo de locale JSON traduzindo do pt-BR como origem, usando
o proprio `openclaude` como motor de traducao (modelo barato por default).

### Localizacao

`scripts/translate-locale.ts` — invocado via `npm run translate -- xx-YY`.

### Entrada

- Locale de destino como argumento: `pt-PT`, `fr-FR`, `ja-JP`, etc.
- Locale de origem fixo: `src/tool-intention/locales/pt-BR.json`

### Processo

1. Valida o formato BCP 47 basico (`/^[a-z]{2}-[A-Z]{2}$/i`)
2. Verifica se o arquivo destino ja existe — se sim, aborta ou pede
   `--force`
3. Carrega `pt-BR.json`
4. Para cada entrada `toolName: string[]`:
   - Chama `openclaude` CLI com um prompt estruturado pedindo traducao
     das 5 variantes
   - Parseia a resposta JSON
   - Valida (array de 5 strings)
5. Monta objeto final e escreve em `src/tool-intention/locales/<locale>.json`
6. Imprime resumo: quantas tools traduzidas, quantos fallbacks, tempo total

### Prompt de traducao (system)

```
Voce e um tradutor especializado em strings curtas de UI para software.
Sua tarefa: traduzir narrativas de acao de agente de IA do portugues
brasileiro (pt-BR) para o idioma de destino.

REGRAS:
- Preserve o TOM: discreto, funcional, no gerundio ou forma equivalente.
- Preserve o TAMANHO: maximo 6 palavras, similar ao original.
- Nao traduza literalmente — use a forma idiomatica do idioma destino.
- Preserve a neutralidade: sem emoji, sem gírias, sem antropomorfismo.
- Nao adicione pontuacao final nas frases.

FORMATO DE SAIDA:
JSON array com exatamente o mesmo numero de strings que o input, na ordem.
Nada alem do JSON. Sem explicacao, sem markdown fence.

Exemplo de entrada:
["Executando um comando", "Rodando uma operacao no terminal"]

Exemplo de saida (idioma destino = en-US):
["Running a command", "Executing a terminal operation"]
```

### Prompt de traducao (user)

```
Idioma destino: {locale}
Tool: {toolName}

Traduza estas 5 variantes do portugues para {locale}:
{JSON.stringify(ptBRVariants)}
```

### Invocacao do `openclaude`

Reutiliza o proprio SDK (`prompt()` helper) com:

```typescript
const result = await prompt(userPrompt, {
  systemPrompt: translatorSystemPrompt,
  model: "z-ai/glm-4.7-flash",  // override se existir, senao default
  permissionMode: "bypassPermissions",
  toolOutputMode: "full",        // nao filtra (seria recursivo)
  presenceIntervalMs: 0,         // sem heartbeat em script batch
  richOutput: false,
  mcpServers: {},                 // sem MCP servers
  locale: "en-US",                // irrelevante — translator tem seu proprio flow
})
```

### Output

- Arquivo JSON commitavel em `src/tool-intention/locales/<locale>.json`
- Log no stdout: `✓ Bash (5 variantes)`, `✗ FAILED: Edit (retry...)`, resumo
  final

### Tratamento de falhas

Se uma entrada falha (JSON invalido, numero errado de variantes, timeout),
o script:
1. Retry 1 vez
2. Se continuar falhando, usa a entrada em pt-BR como fallback commented
   com `// TODO: traduzir manualmente`
3. Nao aborta — continua pra proxima
4. No final, imprime lista de entradas que precisam revisao manual

Isso garante que um novo locale sempre termina com arquivo utilizavel,
mesmo imperfeito.

### Package.json

```json
{
  "scripts": {
    "translate": "tsx scripts/translate-locale.ts"
  }
}
```

Uso: `npm run translate -- pt-PT`

---

## Estrutura de arquivos

```
src/
  tool-intention/
    index.ts              # barrel: pickIntention, applyToolIntentionFilter
    filter.ts             # applyToolIntentionFilter (aplicado em query.ts)
    picker.ts             # pickIntention (random por locale)
    types.ts              # ToolIntentionPayload (shape do _intention)
    locales/
      pt-BR.json          # 23 tools × 5 variantes + _fallback
      en-US.json          # idem
      es-ES.json          # idem
  query.ts                # integracao do filtro no lifecycleGenerator
  types/
    options.ts            # + toolOutputMode
  index.ts                # exports novos

scripts/
  translate-locale.ts     # `npm run translate xx-YY`

package.json              # + script "translate"
```

---

## Exports publicos novos

Em `src/index.ts`:

```typescript
export { pickIntention, applyToolIntentionFilter } from "./tool-intention/index.js"
export type { ToolIntentionPayload } from "./tool-intention/index.js"
```

---

## Criterios de aceite

- [ ] Campo `toolOutputMode?: "intention" | "full"` em `Options` (default `"intention"`)
- [ ] `src/tool-intention/locales/pt-BR.json` com 23 tools built-in + `_fallback`, 5 variantes cada
- [ ] `src/tool-intention/locales/en-US.json` idem
- [ ] `src/tool-intention/locales/es-ES.json` idem
- [ ] `pickIntention(toolName, locale)` implementado com fallback em duas etapas (nome completo → ultimo segmento → `_fallback`)
- [ ] `applyToolIntentionFilter(msg, locale)` transforma `tool_use` blocks trocando `input`, suprime `tool_result` messages (exceto display)
- [ ] Integrado ao `lifecycleGenerator` de `query.ts` apos o drain de heartbeats
- [ ] Display tools (`mcp__display__*`) bypassam o filtro completamente
- [ ] Modo `"full"` passa mensagens inalteradas
- [ ] Filtro e **100% sincrono** (zero await no filtro) — validar por inspecao
- [ ] Script `scripts/translate-locale.ts` implementado com validacao de argumento, prompt estruturado, fallback em erro, log de progresso
- [ ] `npm run translate -- pt-PT` gera um JSON valido (nao precisa commitar o resultado — so provar que o script roda)
- [ ] Teste manual: request com `Bash` via demo server mostra `_intention` em pt-BR no stream, mostra em en-US quando `locale: "en-US"` passado
- [ ] Teste manual: mesmo request com `toolOutputMode: "full"` mostra o `input` original
- [ ] Teste manual: request que usa `mcp__display__display_highlight` NAO filtra — o input chega integral
- [ ] Typecheck passa
- [ ] Build passa

---

## Testes manuais

### Test 1 — filtro em pt-BR (default)

```bash
curl -s -N -X POST http://localhost:9500/api/v1/ai/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"rode um ls -la no diretorio atual e me diga quantos arquivos tem"}' | \
  grep -o '"_intention":"[^"]*"'
```

Esperado: linhas tipo `"_intention":"Executando um comando"` aparecem no
stream. `ls -la` NAO aparece em lugar nenhum.

### Test 2 — filtro em en-US

Mesmo request + `"options":{"locale":"en-US"}`. Esperado: `_intention` em
ingles (`"Running a command"` ou similar).

### Test 3 — modo full

Mesmo request + `"options":{"toolOutputMode":"full"}`. Esperado: `ls -la`
visivel no stream, `_intention` ausente.

### Test 4 — display tool bypass

```bash
curl -s -N -X POST http://localhost:9500/api/v1/ai/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"use mcp__display__display_highlight com action=metric, label=teste, value=42"}' | \
  grep -oE '"action":"metric"'
```

Esperado: display tool_use passa integral com `action: "metric"` e todos os
outros campos visiveis. Nao filtra.

### Test 5 — script de translate

```bash
npm run translate -- pt-PT
```

Esperado: gera `src/tool-intention/locales/pt-PT.json` sem erros, 23 tools,
5 variantes cada, algumas possivelmente marcadas com TODO se falharem.

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| `milestone-04/01-locale-options` | **Bloqueante** — usa `normalizeLocale` e `SupportedLocale` |
| `milestone-04/02-presence-heartbeat` | Nao bloqueante, mas testes manuais se beneficiam de heartbeat ativo |
| `tsx` como devDependency | Ja presente |
| `prompt()` helper do SDK | Ja existe (session-v2) |

---

## Nao-objetivos

- **Traducao runtime por LLM** — foi considerada e descartada por latencia,
  custo e nao-determinismo. O dicionario estatico e definitivo.
- **Pluralizacao / variaveis ICU** — strings atuais sao curtas e sem
  interpolacao. Migrar pra `@formatjs/intl` e tarefa futura se necessario.
- **Filtro de `tool_result` preservando display** — v1 suprime todos os
  `tool_result` no modo intention, incluindo display. Isso cria uma pequena
  inconsistencia (display tool invoca, mas nao vemos o retorno). Como
  display handlers sao echo puro e o proprio `tool_use.input` ja contem a
  info que o cliente renderiza, nao ha perda pratica. Refinamento fica pra
  v2.
- **LLM-assisted translation pipeline** (Inlang, Lingo.dev, Paraglide) —
  overkill na escala atual (3 locales, 115 strings). O `npm run translate`
  artesanal supre.
- **Translation Management Platform** — idem.
- **Suportar MCP tools de terceiros com mensagens especificas** — v1 trata
  todas as MCP tools nao-display pelo `_fallback`. Curar mensagens pra MCP
  tools populares (ex: `mcp__github__create_issue`) e incremento futuro.

---

## Prioridade

**Alta** — e o entregavel mais visivel do milestone pro usuario final.
Elimina o leak de info sensivel e da polish profissional ao chat.

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Conversa de design abril 2026 | Discussao sobre intention vs full tool output |
| Consumidor final | `D:\aw\context\workspaces\openclaude-chat\repo` |
| Task dependente | `milestone-04/01-locale-options` |
| Padrao de referencia | Cursor, Cline, Claude.ai — todos mostram narrativa de intencao, nao comando bruto |
| Bug observado | `openclaude` CLI hoje emite `tool_use.input` cru com paths absolutos e comandos literais |
