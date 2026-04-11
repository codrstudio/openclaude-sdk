# openclaude-sdk - Funcao normalizeLocale

Spec da funcao `normalizeLocale()` que normaliza qualquer string BCP 47 para um `SupportedLocale`.

---

## Objetivo

Resolve D-105.

| Problema | Consequencia |
|----------|-------------|
| Consumidores passam locale em formatos variados (case, underscores, lang-only) | Sem normalizacao, comparacoes falham e o SDK nao reconhece locales validos |
| Locales desconhecidos precisam de fallback previsivel | Sem fallback chain, locale invalido causaria erro ou comportamento indefinido |

---

## Estado Atual

### `src/`

- Nao existe `src/locale/normalize.ts`
- Nenhuma logica de normalizacao BCP 47 no codebase

---

## Implementacao

### 1. Criar `src/locale/normalize.ts`

```typescript
import type { SupportedLocale } from "./types.js"

export function normalizeLocale(input: string | undefined): SupportedLocale {
  if (!input) return "pt-BR"

  const cleaned = input.trim().replace(/_/g, "-")
  const parts = cleaned.split("-")
  const lang = parts[0]?.toLowerCase()
  const region = parts[1]?.toUpperCase()

  if (!lang) return "pt-BR"

  const canonical = region ? `${lang}-${region}` : lang
  if (canonical === "pt-BR") return "pt-BR"
  if (canonical === "en-US") return "en-US"
  if (canonical === "es-ES") return "es-ES"

  if (lang === "pt") return "pt-BR"
  if (lang === "es") return "es-ES"
  if (lang === "en") return "en-US"

  return "en-US"
}
```

### Regras de normalizacao

| Input | Output | Regra aplicada |
|-------|--------|----------------|
| `undefined` | `"pt-BR"` | Default explicito |
| `""` | `"pt-BR"` | Falsy → default |
| `"pt-BR"` | `"pt-BR"` | Match exato |
| `"pt-br"` | `"pt-BR"` | Case-insensitive |
| `"PT-BR"` | `"pt-BR"` | Case-insensitive |
| `"pt_BR"` | `"pt-BR"` | Underscore → hyphen |
| `"pt"` | `"pt-BR"` | Lang primary match |
| `"pt-PT"` | `"pt-BR"` | Lang primary fallback regional |
| `"en-US"` | `"en-US"` | Match exato |
| `"en-GB"` | `"en-US"` | Lang primary fallback regional |
| `"en"` | `"en-US"` | Lang primary match |
| `"es-ES"` | `"es-ES"` | Match exato |
| `"es-MX"` | `"es-ES"` | Lang primary fallback regional |
| `"es"` | `"es-ES"` | Lang primary match |
| `"ja-JP"` | `"en-US"` | Desconhecido → fallback final |
| `"xx"` | `"en-US"` | Desconhecido → fallback final |
| `"  pt-br  "` | `"pt-BR"` | Trim + case-insensitive |

### Fallback chain

```
locale solicitado → match exato canonico → lang primary match → en-US
```

### Regras de design

- Nunca lanca excecao — qualquer input produz um `SupportedLocale` valido
- `null` tratado como `undefined` em runtime (JS coercion via `!input`)
- Trim antes de processar — espacos em volta sao ignorados
- Underscore normalizado para hyphen antes de split
- Apenas primeira e segunda partes do BCP 47 sao consideradas (lang + region)

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/locale/normalize.ts` | Novo — funcao `normalizeLocale()` |

---

## Criterios de Aceite

- [ ] `normalizeLocale(input: string | undefined): SupportedLocale` exportada de `src/locale/normalize.ts`
- [ ] `undefined` e `""` retornam `"pt-BR"`
- [ ] Case-insensitive: `"pt-br"`, `"PT-BR"` → `"pt-BR"`
- [ ] Underscore: `"pt_BR"` → `"pt-BR"`
- [ ] Lang primary: `"pt"` → `"pt-BR"`, `"en"` → `"en-US"`, `"es"` → `"es-ES"`
- [ ] Regional fallback: `"pt-PT"` → `"pt-BR"`, `"en-GB"` → `"en-US"`, `"es-MX"` → `"es-ES"`
- [ ] Desconhecido: `"ja-JP"`, `"xx"` → `"en-US"`
- [ ] Nunca lanca excecao
- [ ] `tsc --noEmit` passa

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `normalizeLocale()` | S-080 |
| Fallback chain | S-080 |
| D-105 | S-080 |
