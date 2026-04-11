# Brainstorming — Sprint 14

## Contexto

O TASK.md desta wave descreve o **React Rich Output**: uma extensão do módulo `display` (implementado em wave-13/sprint-12) que adiciona uma nova action `react` ao meta-tool `display_visual`. Isso permite que o modelo emita **componentes React funcionais com Framer Motion** que o cliente renderiza como widgets animados.

A feature é gated por uma nova flag `reactOutput?: boolean` que só tem efeito se `richOutput` também estiver ligada — `reactOutput` sozinho é ignorado silenciosamente. O padrão arquitetural segue exatamente o que já existe para `richOutput` e `askUser`.

### O que a wave precisa entregar

1. `DisplayReactSchema` (Zod) com todos os campos especificados (version, code, language, entry, imports, initialProps, layout, theme, title, description)
2. Action `react` adicionada ao `visualSchema` em `display/tools.ts`
3. `REACT_OUTPUT_SYSTEM_PROMPT` em `display/prompt.ts`
4. `reactOutput?: boolean` em `Options`
5. Integração em `query.ts` — second merge dentro do bloco `richOutput`
6. Exports públicos em `display/index.ts` e `src/index.ts`
7. README atualizado com seção "React Rich Output"
8. Demo endpoint `GET /display` atualizado para listar `react`

---

## Funcionalidades mapeadas (já implementadas)

### Wave-12 / Sprint-12 (D-071 a D-081)
- `src/display/schemas.ts` — 19 schemas Zod (DisplayMetric, DisplayChart, ..., DisplayChoices) + DisplayToolRegistry + tipos
- `src/display/tools.ts` — 4 meta-tools (display_highlight, display_collection, display_card, display_visual) com `visualSchema` tendo 5 actions: chart, map, code, progress, steps
- `src/display/server.ts` — `createDisplayMcpServer()`
- `src/display/prompt.ts` — `DISPLAY_SYSTEM_PROMPT` + `mergeSystemPromptAppend()`
- `src/display/index.ts` — barrel do módulo display
- `Options.richOutput?: boolean` — flag ativa (em `src/types/options.ts`)
- Integração em `query.ts` linha ~222 — bloco `if (optionsForCli.richOutput)` completo
- Exports públicos em `src/index.ts` — 19 schemas, 19 tipos, DisplayToolRegistry, DisplayToolName

### Wave-13 / Sprint-13 (D-082 a D-093)
- `src/ask-user/` — módulo completo (types.ts, schema.ts, server.ts, prompt.ts, index.ts)
- `Options.askUser?: boolean` e `Options.askUserTimeoutMs?: number` — flags ativas
- Integração em `query.ts` linha ~239 — bloco `if (optionsForCli.askUser)` completo
- Query.onAskUser() e Query.respondToAskUser() — métodos implementados

### Infraestrutura reutilizável
- `tool()` factory (`src/mcp.ts`) — aceita ZodTypeAny (fix D-081)
- `createSdkMcpServer()` — cria McpServer in-process
- `mergeSystemPromptAppend()` — disponível em `display/prompt.ts`, importável pelo módulo react
- `startSdkServers()` em `query.ts` — lifecycle management automático
- Padrão de flag: Options flag → server inject + system prompt inject

---

## Lacunas e oportunidades

### Lacuna principal: `reactOutput` flag e `DisplayReactSchema` (TASK.md)
Nenhum dos 19 schemas existentes produz componentes React renderizáveis. `display_visual.code` gera código estático com syntax highlight — não é renderizável como widget. Para dashboards/explainers animados, falta o canal de transmissão de JSX.

### Lacuna: `reactOutput?: boolean` ausente em `Options`
A interface `Options` não tem a flag. Sem ela, não há como o usuário ativar a feature.

### Lacuna: `DisplayReactSchema` ausente em `schemas.ts`
O schema Zod com version, code, language, entry, imports, initialProps, layout e theme precisa ser adicionado.

### Lacuna: action `react` ausente no `visualSchema` de `tools.ts`
O `visualSchema` em `tools.ts` tem 5 entries (chart, map, code, progress, steps). Falta adicionar `react` como 6ª entry.

### Lacuna: `REACT_OUTPUT_SYSTEM_PROMPT` ausente em `prompt.ts`
O system prompt adicional que instrui o modelo sobre MODULE SHAPE, IMPORTS, STYLING, DATA, ANIMATION e LAYOUT não existe ainda.

### Lacuna: integração em `query.ts`
Dentro do bloco `if (optionsForCli.richOutput)`, após o merge do `DISPLAY_SYSTEM_PROMPT`, precisa de um segundo merge condicional com `REACT_OUTPUT_SYSTEM_PROMPT` quando `reactOutput` também é `true`.

### Lacuna: exports públicos
`display/index.ts` precisa exportar `DisplayReactSchema`, tipo `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT`. `src/index.ts` precisa exportar `DisplayReactSchema` e tipo `DisplayReact`.

### Lacuna: README
Seção "React Rich Output" com tabela de gate das duas flags, exemplo de payload, pipeline cliente (validate → transpile → sandbox → inject → render → theme) e nota de segurança sobre sandbox.

### Lacuna: demo endpoint
`GET /display` no demo server precisa listar a nova action `react` em `display_visual`.

### Oportunidade: gate silencioso elegante
A decisão de ignorar `reactOutput` sem `richOutput` em silêncio (sem warn/error) é intencional e está documentada no TASK.md. O bloco `if (optionsForCli.richOutput)` externo já cobre isso — a injeção React fica **dentro** dele, então `reactOutput: true` sem `richOutput: true` simplesmente não é alcançado.

### Débitos técnicos de sprints anteriores (ainda não implementados)
Os itens D-056, D-057, D-059, D-061, D-062, D-063, D-064, D-065, D-066, D-067, D-068 continuam pendentes mas são ortogonais a esta wave.

---

## Priorização

### Tier 1 — Bloqueante / Core (score 9)
Sem estes, a feature não existe:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-094 | `reactOutput?: boolean` adicionado à interface `Options` em `options.ts` | 9 |
| D-095 | `DisplayReactSchema` criado em `src/display/schemas.ts` com todos os campos (version, code, language, entry, imports, initialProps, layout, theme, title, description) | 9 |
| D-096 | Action `react` adicionada ao `visualSchema` em `src/display/tools.ts` | 9 |
| D-097 | Integração em `query.ts`: dentro do bloco `richOutput`, segundo mergeSystemPromptAppend com `REACT_OUTPUT_SYSTEM_PROMPT` quando `reactOutput: true` | 9 |

### Tier 2 — Contrato e instrução (score 7-8)
Necessários para correctude e usabilidade do modelo:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-098 | `REACT_OUTPUT_SYSTEM_PROMPT` criado em `src/display/prompt.ts` com regras completas (MODULE SHAPE, IMPORTS whitelist, STYLING, DATA, ANIMATION, LAYOUT) | 8 |
| D-099 | `src/display/index.ts` reexporta `DisplayReactSchema`, tipo `DisplayReact` e `REACT_OUTPUT_SYSTEM_PROMPT` | 7 |
| D-100 | `src/index.ts` adiciona exports públicos de `DisplayReactSchema` e tipo `DisplayReact` | 7 |

### Tier 3 — Qualidade e docs (score 5-6)
Importantes mas não bloqueantes para o funcionamento:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-101 | README: seção "React Rich Output" com tabela de gate das duas flags, exemplo end-to-end de payload, pipeline obrigatório do cliente (validate → transpile → sandbox → inject scope → render → theme), nota de segurança sobre sandbox | 6 |
| D-102 | Demo endpoint `GET /display` atualiza listagem de `display_visual` para incluir action `react` | 5 |
| D-103 | Verificação: typecheck passa (`tsc --noEmit`) e build passa (`tsup`) após todos os deltas | 6 |
