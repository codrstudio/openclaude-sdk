# openclaude-sdk - pickIntention: selecao de frase de intencao por tool e locale

Spec da funcao `pickIntention` que seleciona aleatoriamente uma frase de intencao de um dicionario por locale.

---

## Objetivo

Resolve D-129.

| Problema | Consequencia |
|----------|-------------|
| Nao existe funcao para selecionar frase de intencao a partir de tool + locale | Filtro nao consegue gerar o conteudo do campo `_intention` |
| MCP tools nao estao no dicionario — precisa fallback em etapas | Sem fallback, tools desconhecidas nao teriam frase alguma |

---

## Estado Atual

### `src/locale/`

- `normalizeLocale(raw)` normaliza string BCP 47 para `SupportedLocale`
- `SupportedLocale` = `"pt-BR" | "en-US" | "es-ES"`
- Fallback chain: locale invalido → `"en-US"`

---

## Implementacao

### 1. Criar `src/tool-intention/picker.ts`

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

### Assinatura

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `toolName` | `string` | Nome da tool (ex: `"Bash"`, `"mcp__github__create_issue"`) |
| `locale` | `string \| undefined` | Locale BCP 47 do consumer |
| **retorno** | `string` | Frase de intencao selecionada |

### Fallback em duas etapas para MCP tools

MCP tools chegam como `mcp__<server>__<tool>` (ex: `mcp__github__create_issue`):

1. Tenta o nome completo no dicionario
2. Se nao encontra, extrai ultimo segmento apos `__` e tenta novamente
3. Se nao encontra, usa `_fallback`
4. Se `_fallback` tambem nao existir (impossivel na v1), retorna string hardcoded `"Usando uma ferramenta"`

### Regras

- **100% sincrono** — zero `await`, zero `fetch`, zero dependencia externa
- Imports estaticos com `with { type: "json" }` — dicionarios carregados em tempo de bundle
- `Math.random()` para selecao aleatoria — nao precisa ser criptograficamente seguro
- Funcao pura exceto pela aleatoriedade — nao tem side effects
- Locale `undefined` resolve para o default de `normalizeLocale()` (pt-BR)

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/tool-intention/picker.ts` | Novo arquivo — funcao `pickIntention` |

---

## Criterios de Aceite

- [ ] `pickIntention(toolName, locale)` exportado de `src/tool-intention/picker.ts`
- [ ] Retorna string do dicionario correto conforme locale
- [ ] Fallback em duas etapas para MCP tools (nome completo → ultimo segmento → `_fallback`)
- [ ] String hardcoded `"Usando uma ferramenta"` como ultimo recurso
- [ ] Zero `await` na implementacao
- [ ] `pickIntention("Bash", "pt-BR")` retorna uma das 5 variantes de Bash em pt-BR
- [ ] `pickIntention("mcp__github__create_issue", "en-US")` retorna `_fallback` em en-US
- [ ] `tsc --noEmit` passa sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `pickIntention()` | S-091 |
| D-129 | S-091 |
