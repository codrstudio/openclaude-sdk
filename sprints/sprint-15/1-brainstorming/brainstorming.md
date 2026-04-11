# Brainstorming — Sprint 15

## Contexto

O TASK.md desta wave descreve o **Locale Options**: adição de um campo `locale?: string` à interface `Options` do SDK para controlar o idioma usado em strings narrativas que o próprio SDK gera (hoje a tool intention da task 03; no futuro, potencialmente mais).

### O que a wave precisa entregar

1. `src/locale/types.ts` — tipo `SupportedLocale` (`"pt-BR" | "en-US" | "es-ES"`) e constante `SUPPORTED_LOCALES`
2. `src/locale/normalize.ts` — função `normalizeLocale(input: string | undefined): SupportedLocale` com todas as regras BCP 47 descritas no TASK.md
3. `src/locale/index.ts` — barrel exportando types, normalizeLocale e constante
4. `src/types/options.ts` — campo `locale?: string` com JSDoc completo (deixa claro que NÃO afeta o idioma do agente)
5. `src/index.ts` — re-exports públicos de `normalizeLocale`, `SUPPORTED_LOCALES` e `SupportedLocale`
6. Validação: `locale` não deve aparecer em `buildCliArgs()` (é puramente SDK-side)
7. Script de teste manual em `.tmp/demo/test-locale.mjs`
8. Typecheck (`tsc --noEmit`) e build (`tsup`) devem passar

### Motivação

O SDK já gera conteúdo por conta própria na task 03 (tool intention filter vai substituir `tool_use.input` por uma frase humana em linguagem natural). Hardcodar pt-BR seria errado — o `agentic-chat` roda em pt-BR, en-US e es-ES. Heurísticas (detectar do prompt) são frágeis. A solução correta é receber o locale como parâmetro explícito do aplicativo hospedeiro.

---

## Funcionalidades mapeadas (já implementadas)

### Waves 1–13 (D-001 a D-093) — Núcleo do SDK
- **package.json, tsup, tsconfig** — build, dist, exports (D-001)
- **buildCliArgs()** em `process.ts` — mapeamento completo de Options → CLI flags (D-003, D-051, D-057)
- **Hierarquia de erros tipados** — OpenClaudeError, AuthError, BillingError, etc. (D-005)
- **Sessions API** — createSession, resumeSession, listSessions, getSessionMessages, etc. (D-044, D-045, D-016, D-038)
- **MCP SDK servers** — tool(), createSdkMcpServer(), lifecycle management em query.ts (D-039, D-040, D-055)
- **richOutput** em Options + módulo `src/display/` completo — 19 schemas Zod, 4 meta-tools, DISPLAY_SYSTEM_PROMPT, createDisplayMcpServer() (D-071–D-081)
- **askUser** em Options + módulo `src/ask-user/` completo — AskUserRequest, schema, server, prompt, Query.onAskUser/respondToAskUser (D-082–D-093)

### Wave 14 (D-094 a D-103) — React Rich Output
- `DisplayReactSchema` em `src/display/schemas.ts` com todos os campos (version, title, description, code, language, entry, imports, initialProps, layout, theme)
- Action `react` adicionada ao `visualSchema` em `src/display/tools.ts`
- `REACT_OUTPUT_SYSTEM_PROMPT` em `src/display/prompt.ts`
- `reactOutput?: boolean` em Options
- Integração em `query.ts` dentro do bloco `richOutput`
- Exports públicos: `DisplayReactSchema`, `DisplayReact` em `display/index.ts` e `src/index.ts`
- README seção "React Rich Output"
- Demo endpoint `GET /display` atualizado

### Estado atual de `src/types/options.ts`
A interface `Options` contém os campos `richOutput`, `reactOutput`, `askUser`, `askUserTimeoutMs` mas **não possui `locale`**.

### Estado atual de `src/`
Não existe diretório `src/locale/`. Nenhuma lógica de normalização BCP 47 existe no codebase.

---

## Lacunas e oportunidades

### Lacuna principal: ausência do módulo `src/locale/`
O TASK.md especifica toda a estrutura: `types.ts`, `normalize.ts`, `index.ts`. Nada disso existe.

### Lacuna: `locale?: string` ausente em `Options`
A interface não tem o campo. Sem ele, os 4 entry points (`query`, `prompt`, `createSession`, `resumeSession`) não têm como receber o locale do consumidor.

### Lacuna: `normalizeLocale()` não implementada
A função de normalização BCP 47 precisa lidar com: undefined → default pt-BR, case-insensitive, underscores como separadores, lang primary match (pt→pt-BR, es→es-ES, en→en-US), fallback final en-US para locales desconhecidos.

### Lacuna: exports públicos ausentes em `src/index.ts`
`normalizeLocale`, `SUPPORTED_LOCALES` e o tipo `SupportedLocale` precisam ser exportados públicos do SDK para que consumidores possam usar a mesma lógica de normalização.

### Lacuna: JSDoc do campo `locale`
É crucial deixar explícito no JSDoc que `locale` **não afeta o idioma da resposta do agente** — apenas strings que o próprio SDK gera. Sem esse aviso, consumidores podem achar que `locale: "en-US"` fará o agente responder em inglês.

### Oportunidade: separação clara de responsabilidades
O módulo `src/locale/` encapsula toda lógica de locale em um único lugar, fácil de estender no futuro com mais locales (task futura que envolve também a task 03 com arquivos JSON de strings).

### Oportunidade: zero-dependency
A task é completamente independente — não precisa de nenhuma nova dependência npm. Qualquer string BCP 47 é aceita sem throw; a normalização é puramente de string.

### Oportunidade: validação por inspeção
A não-propagação de `locale` para o CLI pode ser verificada por inspeção de `buildCliArgs()` — `locale` não é uma flag do `openclaude` CLI, então não deve aparecer nos args. Isso garante que o comportamento SDK-side-only está correto.

### Oportunidade: test script completo
O TASK.md já fornece 18 casos de teste para `normalizeLocale()` (undefined, null, "", variações de pt-BR/en-US/es-ES, locales desconhecidos). Implementar o script `.tmp/demo/test-locale.mjs` permite validação imediata sem framework de testes.

---

## Priorização

| Discovery | Descrição | Score | Justificativa |
|-----------|-----------|-------|---------------|
| D-104 | `src/locale/types.ts` — SupportedLocale + SUPPORTED_LOCALES | 9 | Base de tudo; bloqueia D-105 e D-106 |
| D-105 | `src/locale/normalize.ts` — normalizeLocale() | 9 | Core da feature; sem isso nada funciona |
| D-106 | `src/locale/index.ts` — barrel | 8 | Necessário para imports limpos |
| D-107 | `locale?: string` em Options com JSDoc | 9 | Entry point público; critério de aceite principal |
| D-108 | Exports públicos em `src/index.ts` | 7 | Permite consumidores usar normalizeLocale diretamente |
| D-109 | Inspeção: `locale` não em buildCliArgs() | 7 | Critério de aceite explícito no TASK.md |
| D-110 | Test script `.tmp/demo/test-locale.mjs` | 7 | 18 casos de teste explícitos no TASK.md; validação rápida |
| D-111 | Typecheck + build pass | 8 | Gate de qualidade; critério de aceite final |

**Ordem lógica de implementação**: D-104 → D-105 → D-106 → D-107 → D-108 → D-109 → D-110 → D-111
