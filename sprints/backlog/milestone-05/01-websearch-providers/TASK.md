# WebSearch Providers — configuracao programatica via SDK

Expoe os providers de web search do `openclaude` como uma opcao de primeira
classe no SDK. O consumidor passa providers (com API keys) via `Options`,
sem depender de variaveis de ambiente. Tambem exporta um registry tipado
com metadata rica pra construcao de UIs que listam/selecionam providers.

---

## Contexto

O `openclaude` suporta 10 providers de web search (`firecrawl`, `tavily`,
`exa`, `you`, `jina`, `bing`, `mojeek`, `linkup`, `ddg`, `custom`) em
`src/tools/WebSearchTool/providers/`. Hoje **toda a configuracao vive em
env vars**: `WEB_SEARCH_PROVIDER` pra escolher o modo e `*_API_KEY` pra
cada provider. O SDK (`src/entrypoints/sdk/`) **nao expoe nada disso**.

Isso e ruim pra consumidores da SDK (ex: `agentic-chat`) que precisam:

1. Configurar providers programaticamente a partir de config do app
   (nao querem poluir env vars do processo)
2. Ter autocomplete e validacao de tipo — saber quais providers existem
   sem consultar docs
3. Construir UIs que listam providers disponiveis com nome, descricao,
   link pra documentacao, indicacao se precisa de chave, etc.

A decisao de design (conversa abril 2026) foi:

- SDK expoe `options.webSearch` aceitando **um objeto OU array** de
  configs — array = chain de fallback, replica o modo `auto` de hoje
- Cada item e uma **discriminated union** por `name`, permitindo que
  providers ganhem opcoes especificas no futuro sem breaking change
  (hoje so `custom` tem superficie gorda; os outros pedem so `apiKey`)
- Config da SDK **sempre ganha** de env var. Env var vira default
  quando a SDK nao define nada
- Exporta constante `WEB_SEARCH_PROVIDERS` com metadata rica pra UIs

---

## Design

### Shape em `Options`

```typescript
interface Options {
  // ... campos existentes

  /**
   * Configuracao dos providers de web search usados pelo `WebSearchTool`.
   *
   * Aceita um objeto (um provider so) ou um array (chain de fallback na
   * ordem fornecida — se o primeiro falhar, tenta o proximo).
   *
   * Quando ausente, o SDK cai nas variaveis de ambiente do processo
   * (`WEB_SEARCH_PROVIDER`, `TAVILY_API_KEY`, etc). Quando presente,
   * **sobrescreve completamente** as env vars — o SDK nao faz merge.
   *
   * Nao afeta se o tool esta habilitado: isso e controlado por
   * `allowedTools`. Essa opcao so configura QUAL provider roda quando
   * o agente chama `WebSearch`.
   */
  webSearch?: WebSearchProviderConfig | WebSearchProviderConfig[]
}
```

### Discriminated union

```typescript
export type WebSearchProviderConfig =
  | { name: "tavily",    apiKey: string }
  | { name: "firecrawl", apiKey: string }
  | { name: "exa",       apiKey: string }
  | { name: "you",       apiKey: string }
  | { name: "jina",      apiKey: string }
  | { name: "bing",      apiKey: string }
  | { name: "mojeek",    apiKey: string }
  | { name: "linkup",    apiKey: string }
  | { name: "ddg" }                              // nao precisa de chave
  | {
      name: "custom"
      urlTemplate: string                        // ex: "https://api.x.com/search?q={query}"
      apiKey?: string
      authHeader?: string                        // default: "Authorization"
      authScheme?: string                        // default: "Bearer"
      queryParam?: string                        // default: "q"
      method?: "GET" | "POST"                    // default: "GET"
      headers?: Record<string, string>
      params?: Record<string, string>
      bodyTemplate?: string                      // para POST
      jsonPath?: string                          // onde achar os hits no response
    }
```

A variante `custom` espelha 1-pra-1 as env vars de `custom.ts` hoje
(`WEB_URL_TEMPLATE`, `WEB_AUTH_HEADER`, `WEB_AUTH_SCHEME`, `WEB_QUERY_PARAM`,
`WEB_METHOD`, `WEB_HEADERS`, `WEB_PARAMS`, `WEB_BODY_TEMPLATE`, `WEB_JSON_PATH`,
`WEB_KEY`). Nao incluir os de seguranca (`WEB_CUSTOM_ALLOW_HTTP`,
`WEB_CUSTOM_ALLOW_PRIVATE`, etc) — esses continuam so via env var porque sao
decisoes operacionais, nao configuracao do consumidor.

### Registry de metadata

```typescript
export interface WebSearchProviderMeta {
  id: WebSearchProviderId
  displayName: string
  tagline: string                                // 1 linha humana
  website: string
  docsUrl: string
  envVar: string | null                          // null para ddg
  requiresApiKey: boolean
  pricing: string                                // string livre, ex: "~$0.008/query"
  category: "llm-native" | "neural" | "scraper" | "keyword" | "custom"
  recommended: boolean
}

export const WEB_SEARCH_PROVIDERS = {
  tavily: {
    id: "tavily",
    displayName: "Tavily",
    tagline: "Busca LLM-native com respostas resumidas e citacoes",
    website: "https://tavily.com",
    docsUrl: "https://docs.tavily.com",
    envVar: "TAVILY_API_KEY",
    requiresApiKey: true,
    pricing: "~$0.008/query (1k free/mes)",
    category: "llm-native",
    recommended: true,
  },
  exa: {
    id: "exa",
    displayName: "Exa",
    tagline: "Busca neural/semantica, otima pra papers e codigo",
    website: "https://exa.ai",
    docsUrl: "https://docs.exa.ai",
    envVar: "EXA_API_KEY",
    requiresApiKey: true,
    pricing: "~$5/1k queries",
    category: "neural",
    recommended: true,
  },
  firecrawl: {
    id: "firecrawl",
    displayName: "Firecrawl",
    tagline: "Search + scraping em markdown limpo na mesma chamada",
    website: "https://firecrawl.dev",
    docsUrl: "https://docs.firecrawl.dev",
    envVar: "FIRECRAWL_API_KEY",
    requiresApiKey: true,
    pricing: "~$16/mes start",
    category: "scraper",
    recommended: false,
  },
  linkup: {
    id: "linkup",
    displayName: "Linkup",
    tagline: "Resultados premium com foco europeu",
    website: "https://linkup.so",
    docsUrl: "https://docs.linkup.so",
    envVar: "LINKUP_API_KEY",
    requiresApiKey: true,
    pricing: "~EUR 5/1k queries",
    category: "llm-native",
    recommended: false,
  },
  you: {
    id: "you",
    displayName: "You.com",
    tagline: "Search API com modo web e news",
    website: "https://you.com",
    docsUrl: "https://documentation.you.com",
    envVar: "YOU_API_KEY",
    requiresApiKey: true,
    pricing: "pago",
    category: "llm-native",
    recommended: false,
  },
  jina: {
    id: "jina",
    displayName: "Jina Reader",
    tagline: "Extracao de conteudo barata, bom fallback pago",
    website: "https://jina.ai",
    docsUrl: "https://jina.ai/reader",
    envVar: "JINA_API_KEY",
    requiresApiKey: true,
    pricing: "quase gratis",
    category: "scraper",
    recommended: false,
  },
  bing: {
    id: "bing",
    displayName: "Bing (Azure)",
    tagline: "Search tradicional estavel via Azure",
    website: "https://www.microsoft.com/en-us/bing/apis/bing-web-search-api",
    docsUrl: "https://learn.microsoft.com/en-us/bing/search-apis",
    envVar: "BING_API_KEY",
    requiresApiKey: true,
    pricing: "~$15/1k queries",
    category: "keyword",
    recommended: false,
  },
  mojeek: {
    id: "mojeek",
    displayName: "Mojeek",
    tagline: "Search independente com indice proprio",
    website: "https://www.mojeek.com",
    docsUrl: "https://www.mojeek.com/services/search/web-search-api/",
    envVar: "MOJEEK_API_KEY",
    requiresApiKey: true,
    pricing: "pago",
    category: "keyword",
    recommended: false,
  },
  ddg: {
    id: "ddg",
    displayName: "DuckDuckGo",
    tagline: "Gratis, sem chave, rate-limited — ultimo recurso",
    website: "https://duckduckgo.com",
    docsUrl: "https://duckduckgo.com",
    envVar: null,
    requiresApiKey: false,
    pricing: "gratis (rate-limited)",
    category: "keyword",
    recommended: false,
  },
  custom: {
    id: "custom",
    displayName: "Custom HTTP",
    tagline: "Provider HTTP generico configuravel (url, headers, auth)",
    website: "",
    docsUrl: "",
    envVar: null,
    requiresApiKey: false,
    pricing: "depende do backend",
    category: "custom",
    recommended: false,
  },
} as const satisfies Record<string, WebSearchProviderMeta>

export type WebSearchProviderId = keyof typeof WEB_SEARCH_PROVIDERS
```

A constante e `as const` pra que `WebSearchProviderId` seja um literal union
(nao `string`), garantindo autocomplete e pegando typo em tempo de compile.

### Como a config chega ate o tool

O runtime do SDK recebe `options.webSearch` e precisa traduzir isso pras
variaveis que os providers (`tavily.ts`, `exa.ts`, etc) leem hoje
(`process.env.TAVILY_API_KEY`, `process.env.WEB_SEARCH_PROVIDER`, etc).

Estrategia mais simples: **injetar nas env vars do processo antes de
spawn do CLI**, so que isoladas ao escopo daquela `query()`/`session`.
Concretamente:

1. Serializar `webSearch` em env vars equivalentes
2. Passar como `env` extras pro child process do CLI (`spawn(..., { env })`)
3. Setar `WEB_SEARCH_PROVIDER`:
   - Array: `auto` + filtrar `ALL_PROVIDERS` pelos que foram fornecidos
     (mas o codigo atual nao suporta "auto parcial" — ver alternativa abaixo)
   - Objeto unico: nome especifico (`tavily`, `exa`, etc)

**Alternativa** (mais limpa mas mexe em mais codigo): criar um novo modo
`WEB_SEARCH_PROVIDER=sdk` em `providers/index.ts` que le a chain de um
JSON passado via `WEB_SEARCH_SDK_CONFIG` env var. Isso mantem o fluxo
atual intacto e isola a mudanca. **Recomendado.**

Passos concretos da alternativa:

- Em `providers/index.ts`, aceitar modo `"sdk"` em `ProviderMode`
- Nova funcao `loadSdkChain(): SearchProvider[]` que parseia
  `process.env.WEB_SEARCH_SDK_CONFIG` (JSON) e constroi providers
  "envelopados" que leem `apiKey` diretamente do config ao inves de
  `process.env.*_API_KEY`
- Isso exige refatorar os 10 providers pra aceitar um `apiKey` injetado
  ao inves de ler `process.env` direto — ou criar um wrapper por provider

**Decisao pragmatica**: comecar com a abordagem 1 (injetar env vars). E
mais feia mas zero refactor dos providers. Documentar o caminho pra
abordagem 2 como tech-debt pra quando precisarmos de algo que env vars
nao dao conta (ex: passar chaves diferentes pro mesmo provider em
sessions paralelas — nao e um caso real hoje).

### Precedencia (SDK > env)

Se `options.webSearch` esta presente, o SDK:

1. NAO passa adiante as env vars `WEB_SEARCH_PROVIDER` e `*_API_KEY` do
   processo pai
2. Passa apenas as env vars derivadas do `options.webSearch`

Se `options.webSearch` esta ausente, o SDK:

1. Passa as env vars do processo pai como hoje (comportamento atual)

Isso garante "SDK sempre ganha, env e default" sem merge confuso.

---

## Estrutura de arquivos

```
src/
  websearch/
    index.ts           # barrel
    providers.ts       # WEB_SEARCH_PROVIDERS, WebSearchProviderId, WebSearchProviderMeta
    config.ts          # WebSearchProviderConfig (discriminated union)
    toEnv.ts           # serializeWebSearchConfig(cfg): Record<string, string>
  types/
    options.ts         # + webSearch?: WebSearchProviderConfig | WebSearchProviderConfig[]
  bridge/
    sessionRunner.ts   # usar serializeWebSearchConfig ao montar env do spawn
  index.ts             # re-exporta websearch
```

---

## Exports publicos novos

Em `src/index.ts`:

```typescript
export {
  WEB_SEARCH_PROVIDERS,
} from "./websearch/index.js"
export type {
  WebSearchProviderId,
  WebSearchProviderMeta,
  WebSearchProviderConfig,
} from "./websearch/index.js"
```

---

## Criterios de aceite

- [ ] `options.webSearch?: WebSearchProviderConfig | WebSearchProviderConfig[]` aceito em `Options`
- [ ] `WebSearchProviderConfig` exportado como discriminated union por `name`
- [ ] `WEB_SEARCH_PROVIDERS` exportado como const com os 10 providers e metadata completa
- [ ] `WebSearchProviderId` exportado como literal union (nao `string`)
- [ ] `WebSearchProviderMeta` interface exportada
- [ ] Passar `options.webSearch` na SDK sobrescreve env vars do processo ao spawnar o CLI (SDK > env)
- [ ] Ausencia de `options.webSearch` preserva comportamento atual (env vars do processo sao usadas)
- [ ] Variante `custom` aceita todas as opcoes mapeadas: `urlTemplate`, `apiKey`, `authHeader`, `authScheme`, `queryParam`, `method`, `headers`, `params`, `bodyTemplate`, `jsonPath`
- [ ] Variante `ddg` NAO exige `apiKey` (o TS deve reclamar se alguem passar)
- [ ] Campo aceito nos 4 entry points: `query`, `prompt`, `createSession`, `resumeSession`
- [ ] JSDoc no campo `webSearch` explicita que SDK sobrescreve env e que nao liga/desliga o tool
- [ ] Typecheck passa (`tsc --noEmit`)
- [ ] Build passa (`tsup`)
- [ ] **README.md atualizado** com a tabela de providers (ver secao "Documentacao")

---

## Documentacao

**Obrigatorio**: atualizar o `README.md` da raiz do `openclaude` (ou o
README do SDK, o que for o canonical) com uma nova secao **"WebSearch
Providers"** contendo:

1. Tabela dos 10 providers com colunas: **Provider | Descricao | Precisa
   de chave | Preco aprox. | Categoria | Recomendado**
2. Exemplo de uso programatico via SDK com um provider unico:
   ```ts
   query({
     prompt: "...",
     allowedTools: ["WebSearch"],
     webSearch: { name: "tavily", apiKey: process.env.TAVILY_KEY! },
   })
   ```
3. Exemplo com chain de fallback:
   ```ts
   query({
     prompt: "...",
     allowedTools: ["WebSearch"],
     webSearch: [
       { name: "tavily", apiKey: "..." },
       { name: "exa",    apiKey: "..." },
       { name: "ddg" },
     ],
   })
   ```
4. Exemplo do provider `custom`
5. Nota explicita sobre precedencia SDK > env
6. Link pra `WEB_SEARCH_PROVIDERS` como fonte programatica de verdade
   (pra quem quer montar UI)

A tabela deve ser gerada a partir da mesma fonte do registry (ou manualmente
espelhada — aceitavel pra v1, ja que muda pouco).

---

## Testes manuais

Script em `.tmp/demo/test-websearch-providers.mjs`:

```js
import {
  WEB_SEARCH_PROVIDERS,
  query,
} from "../../dist/index.js"

// 1. Registry bate com os 10 providers esperados
const ids = Object.keys(WEB_SEARCH_PROVIDERS).sort()
const expected = ["bing","custom","ddg","exa","firecrawl","jina","linkup","mojeek","tavily","you"]
console.log("registry:", JSON.stringify(ids) === JSON.stringify(expected) ? "PASS" : "FAIL")

// 2. Provider unico (precisa de TAVILY_API_KEY real pra rodar ponta-a-ponta)
if (process.env.TAVILY_API_KEY) {
  const result = await query({
    prompt: "search the web for 'openclaude sdk' and report the top 3 urls",
    allowedTools: ["WebSearch"],
    webSearch: { name: "tavily", apiKey: process.env.TAVILY_API_KEY },
  })
  console.log("tavily single:", result.ok ? "PASS" : "FAIL")
}

// 3. Chain de fallback
if (process.env.TAVILY_API_KEY) {
  const result = await query({
    prompt: "search the web for 'claude code'",
    allowedTools: ["WebSearch"],
    webSearch: [
      { name: "tavily", apiKey: process.env.TAVILY_API_KEY },
      { name: "ddg" },
    ],
  })
  console.log("chain:", result.ok ? "PASS" : "FAIL")
}

// 4. DDG puro (sem chave)
const result = await query({
  prompt: "search the web for 'typescript'",
  allowedTools: ["WebSearch"],
  webSearch: { name: "ddg" },
})
console.log("ddg:", result.ok ? "PASS" : "FAIL")

// 5. Metadata tem os campos esperados
for (const meta of Object.values(WEB_SEARCH_PROVIDERS)) {
  const ok = meta.id && meta.displayName && meta.tagline && meta.category
  if (!ok) console.log("FAIL metadata:", meta.id)
}
```

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| Nenhuma | — |

Task independente. Nao depende de outros milestones.

---

## Nao-objetivos

- **Refatorar os providers** pra pararem de ler `process.env.*_API_KEY`
  direto. A v1 injeta env vars no spawn do CLI. Refactor fica como
  tech-debt pra uma v2 quando precisarmos (ex: chaves diferentes por
  sessao paralela)
- **Validacao de formato de API key** (regex, checksum). O SDK aceita
  qualquer string — se esta errada, o provider falha em runtime
- **Healthcheck / "test this provider" endpoint** no SDK. Pode vir depois
- **Modificar o tool WebSearch em si** (comportamento, UI, prompt). Esta
  task so mexe em configuracao
- **Mover as env vars de seguranca do `custom`** (`WEB_CUSTOM_ALLOW_HTTP`,
  etc) pra SDK — essas sao decisoes operacionais do host, nao config do app
- **Mapear `native` provider** pra SDK — depende de firstParty/vertex/foundry
  e nao faz sentido configurar via options

---

## Prioridade

**Media-alta** — desbloqueia consumidores que nao querem gerenciar env
vars (`agentic-chat` e outros apps que hospedam a SDK). Nao bloqueia
nenhum outro milestone conhecido.

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Conversa de design abril 2026 | Discussao sobre expor providers programaticamente |
| Codigo fonte providers | `src/tools/WebSearchTool/providers/` |
| Index atual | `src/tools/WebSearchTool/providers/index.ts` |
| SDK entrypoint | `src/entrypoints/sdk/` |
| Consumidor alvo | `agentic-chat` |
