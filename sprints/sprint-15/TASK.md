# Locale Options — suporte a `locale` BCP 47 em `Options`

Adiciona um campo `locale?: string` a `Options` do SDK que controla o idioma
usado para strings narrativas geradas pelo proprio SDK (hoje so a tool
intention da task 03; amanha possivelmente mais). Implementa normalizacao
BCP 47, fallback chain, e helpers pra leitura em outros modulos.

---

## Contexto

O SDK e neutro de idioma para o fluxo principal — o `openclaude` CLI
responde no idioma do prompt do usuario, sem override. Mas **o SDK tambem
gera conteudo por conta propria**: a task 03 (tool intention filter) vai
substituir `tool_use.input` por uma frase humana que o SDK escreve, nao o
modelo. Essa frase precisa sair no idioma certo.

Hard-codar portugues seria errado — o `agentic-chat` roda em pt-BR, en-US e
es-ES (e possivelmente outros no futuro). Depender de heuristica (tentar
adivinhar do prompt) e fragil. A solucao e receber o locale como **parametro
explicito** vindo do aplicativo hospedeiro, que ja sabe seu contexto.

---

## Design

### Shape em `Options`

```typescript
interface Options {
  // ... campos existentes

  /**
   * Locale BCP 47 (ex: "pt-BR", "en-US", "es-ES") usado por strings
   * narrativas que o SDK gera por conta propria (tool intentions, mensagens
   * de erro estruturadas, etc). NAO afeta o idioma da resposta do agente.
   *
   * Aceita variacoes case-insensitive e underscores: "pt-br", "pt_BR",
   * "PT-BR" sao todos normalizados para "pt-BR" internamente.
   *
   * Locales nao suportados caem em "en-US" via fallback chain.
   *
   * Default: "pt-BR" quando ausente (motivo historico: o consumidor
   * primeiro e `agentic-chat` em pt-BR). Consumidores devem sempre passar
   * explicitamente em producao.
   */
  locale?: string
}
```

### Locales suportados na v1

| BCP 47 | Nome | Status |
|--------|------|--------|
| `pt-BR` | Portugues brasileiro | default, testado |
| `en-US` | Ingles americano | fallback, testado |
| `es-ES` | Espanhol europeu | testado |

Outros locales sao aceitos sem erro, mas caem para `en-US` nas narrativas
(task 03). Nao ha validacao estrita — qualquer string e tolerada.

### Normalizacao

A funcao `normalizeLocale(input: string | undefined): SupportedLocale`
recebe qualquer string e retorna um dos tres locales suportados:

```typescript
export type SupportedLocale = "pt-BR" | "en-US" | "es-ES"

export function normalizeLocale(input: string | undefined): SupportedLocale {
  if (!input) return "pt-BR"                 // default explicito

  // Normaliza separadores e case
  const cleaned = input.trim().replace(/_/g, "-")
  const parts = cleaned.split("-")
  const lang = parts[0]?.toLowerCase()
  const region = parts[1]?.toUpperCase()

  if (!lang) return "pt-BR"

  // Match exato por forma canonica
  const canonical = region ? `${lang}-${region}` : lang
  if (canonical === "pt-BR") return "pt-BR"
  if (canonical === "en-US") return "en-US"
  if (canonical === "es-ES") return "es-ES"

  // Match por lang primary (ex: "pt" → pt-BR, "es" → es-ES, "en" → en-US,
  // "pt-PT" → pt-BR como fallback regional mais proximo)
  if (lang === "pt") return "pt-BR"
  if (lang === "es") return "es-ES"
  if (lang === "en") return "en-US"

  // Desconhecido: fallback final para en-US
  return "en-US"
}
```

### Fallback chain

Para strings narrativas (task 03) o fallback e:

```
locale solicitado → lang primary match → en-US → default hardcoded
```

Exemplo: `ja-JP` → nao ha match primary → `en-US`. Se `en-US` tambem
falhar (improvavel — e o fallback global), usa uma string hardcoded em
ingles no codigo.

### Onde fica o codigo

```
src/
  locale/
    index.ts         # Barrel: exporta types, normalizeLocale, helpers
    types.ts         # SupportedLocale type, SUPPORTED_LOCALES const
    normalize.ts     # normalizeLocale() com regras acima
  types/
    options.ts       # + campo locale
```

### Integracao com `options` existente

`query()`, `prompt()`, `createSession()`, `resumeSession()` todos recebem
`options.locale` diretamente. Nao e propagado ao CLI (nao existe flag no
`openclaude` pra isso — e puramente SDK-side).

Documentar no JSDoc do campo que ele **nao** afeta o idioma do agente
principal. Sem surpresas.

---

## Estrutura de arquivos

```
src/
  locale/
    index.ts           # export { normalizeLocale, type SupportedLocale, SUPPORTED_LOCALES }
    types.ts           # type SupportedLocale = "pt-BR" | "en-US" | "es-ES"
    normalize.ts       # normalizeLocale(input) com tabela e fallback
  types/
    options.ts         # + locale?: string
  index.ts             # re-exporta locale
```

---

## Exports publicos novos

Em `src/index.ts`:

```typescript
export { normalizeLocale, SUPPORTED_LOCALES } from "./locale/index.js"
export type { SupportedLocale } from "./locale/index.js"
```

---

## Criterios de aceite

- [ ] `options.locale?: string` aceito em `Options`
- [ ] `type SupportedLocale = "pt-BR" | "en-US" | "es-ES"` exportado
- [ ] `const SUPPORTED_LOCALES: readonly SupportedLocale[]` exportado
- [ ] `normalizeLocale(input)` implementada com as regras: undefined → default, case/underscore insensitive, lang primary match, fallback en-US
- [ ] Locale nao e propagado pro CLI (verificar por inspecao dos args em `buildCliArgs`)
- [ ] JSDoc explicita que `locale` NAO afeta o idioma do agente
- [ ] Campo aceito nos 4 entry points: `query`, `prompt`, `createSession`, `resumeSession`
- [ ] Typecheck passa (`tsc --noEmit`)
- [ ] Build passa (`tsup`)

---

## Testes manuais

Script simples em `.tmp/demo/test-locale.mjs`:

```js
import { normalizeLocale } from "../../dist/index.js"

const cases = [
  [undefined, "pt-BR"],
  [null, "pt-BR"],
  ["", "pt-BR"],
  ["pt-BR", "pt-BR"],
  ["pt-br", "pt-BR"],
  ["PT-BR", "pt-BR"],
  ["pt_BR", "pt-BR"],
  ["pt", "pt-BR"],
  ["pt-PT", "pt-BR"],
  ["en-US", "en-US"],
  ["en-GB", "en-US"],
  ["en", "en-US"],
  ["es-ES", "es-ES"],
  ["es-MX", "es-ES"],
  ["es", "es-ES"],
  ["ja-JP", "en-US"],
  ["xx", "en-US"],
  ["  pt-br  ", "pt-BR"],
]

for (const [input, expected] of cases) {
  const actual = normalizeLocale(input)
  const ok = actual === expected
  console.log(`${ok ? "PASS" : "FAIL"}: ${JSON.stringify(input)} → ${actual} (expected ${expected})`)
}
```

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| Nenhuma | — |

Task totalmente independente. Nao precisa de nada alem do que ja existe.

---

## Nao-objetivos

- **Validacao estrita de BCP 47** — aceita qualquer string, normaliza o que
  da, default pro resto. Sem throw.
- **Injecao de `locale` no system prompt do agente** — fora de escopo. Se
  o consumidor quiser, usa `options.systemPrompt.append`.
- **Deteccao automatica** (`navigator.language`, `Intl.DateTimeFormat`) —
  o SDK roda no Node, nao tem essas APIs. Consumidor passa explicito.
- **Adicionar mais locales alem de pt-BR/en-US/es-ES** — isso e uma task
  futura que envolve tambem a 03 (mais arquivos JSON) e eh incremental.

---

## Prioridade

**Alta** — prerequisito da task 03 deste milestone. Task 02 pode rodar
em paralelo mas fica dependente se quiser usar heartbeat com mensagens
narrativas localizadas.

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Conversa de design abril 2026 | Discussao sobre multi-lang em tool intentions |
| Consumidor final | `D:\aw\context\workspaces\agentic-chat\repo` |
| Task dependente | `milestone-04/03-tool-intention-filter` |

---

# Projeto

# openclaude-sdk

Um SDK em TypeScript que permite usar o OpenClaude (fork open-source do Claude Code) de forma programática, dentro de aplicações Node.js.

## Problema que resolve

O OpenClaude CLI é uma ferramenta interativa de terminal — você digita prompts e o agente responde. Mas para quem quer **integrar um agente de código em seus próprios sistemas** (automações, pipelines, produtos), usar o terminal não serve. É preciso uma interface programática.

O openclaude-sdk faz essa ponte: transforma o CLI num componente controlável por código.

## O que permite fazer

- **Conversar com o agente** — enviar prompts e receber respostas em streaming, como um chat programático
- **Controlar permissões** — aprovar ou negar ações do agente (leitura de arquivos, execução de comandos) sem intervenção humana
- **Gerenciar sessões** — retomar conversas anteriores, listar histórico, organizar sessões com títulos e tags
- **Usar múltiplos providers** — rotear requests para OpenRouter ou qualquer API compatível com OpenAI, não ficando preso a um único provedor
- **Tratar erros de forma inteligente** — distinguir erros recuperáveis (rate limit, timeout) de fatais (autenticação, billing), permitindo lógica de retry automático

## Para quem é

Desenvolvedores que querem construir produtos ou automações em cima de agentes de código — orquestradores, plataformas de desenvolvimento assistido por IA, ferramentas internas, CI/CD com agentes.

## Relação com o ecossistema

É o equivalente open-source do `@anthropic-ai/claude-code` SDK oficial da Anthropic, mas voltado para o OpenClaude. Mesma ideia, mesmo estilo de API, ecossistema diferente.