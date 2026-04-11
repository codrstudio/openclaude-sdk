# PRP-049 — Locale module core: tipos e normalizeLocale

## Objetivo

Criar o modulo `src/locale/` com o tipo `SupportedLocale`, constante `SUPPORTED_LOCALES` e funcao `normalizeLocale()` que normaliza qualquer string BCP 47 para um dos tres locales suportados.

Referencia: specs S-079 (D-104), S-080 (D-105).

## Execution Mode

`implementar`

## Contexto

O SDK precisa de um mecanismo de locale para strings narrativas geradas internamente (tool intentions, mensagens de erro estruturadas). O locale vem do aplicativo hospedeiro via `Options.locale` (PRP-050) e e normalizado internamente pelo SDK.

Nao existe `src/locale/` no codebase. Este PRP cria os dois arquivos fundacionais do modulo.

## Especificacao

### Feature F-125 — SupportedLocale type e SUPPORTED_LOCALES em src/locale/types.ts

Criar `src/locale/types.ts`:

```typescript
export type SupportedLocale = "pt-BR" | "en-US" | "es-ES"

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  "pt-BR",
  "en-US",
  "es-ES",
] as const
```

Regras:
- `SupportedLocale` e um union de string literals — NAO enum
- `SUPPORTED_LOCALES` e `readonly` e `as const` — imutavel em runtime
- Ordem: pt-BR primeiro (default historico), en-US segundo (fallback global), es-ES terceiro
- Zero dependencias externas
- Arquivo nao importa nada

### Feature F-126 — normalizeLocale() em src/locale/normalize.ts

Criar `src/locale/normalize.ts`:

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

Regras de normalizacao:

| Input | Output | Regra |
|-------|--------|-------|
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

Fallback chain: `locale solicitado → match exato canonico → lang primary match → en-US`

Regras de design:
- Nunca lanca excecao — qualquer input produz um `SupportedLocale` valido
- `null` tratado como `undefined` em runtime (JS coercion via `!input`)
- Trim antes de processar — espacos em volta sao ignorados
- Underscore normalizado para hyphen antes de split
- Apenas primeira e segunda partes do BCP 47 sao consideradas (lang + region)
- Import de `SupportedLocale` e `type`-only (nao puxa valor em runtime)

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `normalizeLocale(undefined)` | `"pt-BR"` |
| `normalizeLocale("")` | `"pt-BR"` |
| `normalizeLocale("pt-br")` | `"pt-BR"` |
| `normalizeLocale("pt_BR")` | `"pt-BR"` |
| `normalizeLocale("ja-JP")` | `"en-US"` |
| `SUPPORTED_LOCALES.includes("pt-BR")` | `true` |
| `SUPPORTED_LOCALES.push("fr-FR")` | TypeError (readonly) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-125 | localeTypes | `SupportedLocale` type + `SUPPORTED_LOCALES` const em `src/locale/types.ts` |
| F-126 | normalizeLocale | `normalizeLocale()` em `src/locale/normalize.ts` com 18 casos de normalizacao |

## Limites

- NAO criar `src/locale/index.ts` (barrel) — escopo de PRP-050
- NAO alterar `src/types/options.ts` — escopo de PRP-050
- NAO alterar `src/index.ts` — escopo de PRP-050
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO validar BCP 47 estritamente — aceita qualquer string, normaliza o que da
- NAO adicionar mais locales alem de pt-BR/en-US/es-ES

## Dependencias

Nenhuma dependencia de outros PRPs. **Bloqueante para PRP-050** (barrel, Options.locale e exports dependem dos tipos e funcao existirem).
