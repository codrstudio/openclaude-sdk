# PRP-050 — Locale integration: barrel, Options.locale, exports e validacao

## Objetivo

Integrar o modulo `src/locale/` ao SDK: criar barrel, adicionar `locale?: string` a `Options`, reexportar publicamente `normalizeLocale`, `SUPPORTED_LOCALES` e `SupportedLocale`, e validar que o campo nao vaza para o CLI.

Referencia: specs S-081 (D-106, D-107, D-108), S-082 (D-109, D-110, D-111).

## Execution Mode

`implementar`

## Contexto

O modulo `src/locale/` ja existe (PRP-049) com:
- `types.ts` — `SupportedLocale` type + `SUPPORTED_LOCALES` const
- `normalize.ts` — `normalizeLocale()` com 18 casos de normalizacao

Faltam:
1. **Barrel** — `src/locale/index.ts` para imports internos limpos
2. **Options.locale** — campo na interface `Options` em `src/types/options.ts`
3. **Exports publicos** — reexports em `src/index.ts`
4. **Validacao** — confirmar que `locale` NAO aparece em `buildCliArgs()` de `src/process.ts`
5. **Build** — `tsc --noEmit` e `tsup` passam sem erro
6. **Teste manual** — script `.tmp/demo/test-locale.mjs` com 18 casos

**Referencia**: `src/types/options.ts`, interface `Options` (linhas 307-311):

```typescript
  richOutput?: boolean
  reactOutput?: boolean
  askUser?: boolean
  askUserTimeoutMs?: number
  sandbox?: SandboxSettings
```

**Referencia**: `src/index.ts` ja tem blocos de exports: Display (linhas 202-251), Ask User (linhas 253-257), V2 Session API (linhas 259-270).

## Especificacao

### Feature F-127 — Barrel src/locale/index.ts

Criar `src/locale/index.ts`:

```typescript
export type { SupportedLocale } from "./types.js"
export { SUPPORTED_LOCALES } from "./types.js"
export { normalizeLocale } from "./normalize.js"
```

Regras:
- Extensao `.js` nos imports (ESM)
- `SupportedLocale` exportado como `export type` (tree-shaking)
- Barrel exporta exatamente 3 itens: tipo, constante, funcao

### Feature F-128 — Options.locale em src/types/options.ts

Apos `askUserTimeoutMs?: number` (linha 310), adicionar:

```typescript
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
   * Default: "pt-BR" quando ausente.
   */
  locale?: string
```

Regras:
- Tipo e `string`, NAO `SupportedLocale` — aceita qualquer string, normalizacao e interna
- JSDoc DEVE explicitar que `locale` NAO afeta o idioma do agente
- Posicionado apos `askUserTimeoutMs`, antes de `sandbox`
- O campo e aceito nos 4 entry points (`query`, `prompt`, `createSession`, `resumeSession`) porque todos recebem `Options` — nenhuma alteracao necessaria nos entry points

### Feature F-129 — Exports publicos em src/index.ts

Adicionar nova secao apos o bloco "Ask User" (linha 257) e antes de "V2 Session API" (linha 259):

```typescript
// ---------------------------------------------------------------------------
// Locale — Internationalization helpers (locale option)
// ---------------------------------------------------------------------------

export { normalizeLocale, SUPPORTED_LOCALES } from "./locale/index.js"
export type { SupportedLocale } from "./locale/index.js"
```

Regras:
- Secao posicionada entre "Ask User" e "V2 Session API"
- `SupportedLocale` exportado como `export type` (tree-shaking)
- Extensao `.js` nos imports (ESM)

### Feature F-130 — Validacao: nao-propagacao CLI, build e teste manual

**1. Verificacao de nao-propagacao:**

Inspecionar `buildCliArgs()` em `src/process.ts` e confirmar que `locale` NAO aparece:
- Nao ha `if (options.locale)` no corpo
- Nao ha `args.push("--locale", ...)`
- Nao ha mencao de `locale` em nenhum mapeamento de args

`locale` e puramente SDK-side — o `openclaude` CLI nao tem flag `--locale`.

**2. Script de teste manual `.tmp/demo/test-locale.mjs`:**

```javascript
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

let pass = 0
let fail = 0

for (const [input, expected] of cases) {
  const actual = normalizeLocale(input)
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(
    `${ok ? "PASS" : "FAIL"}: ${JSON.stringify(input)} → ${actual} (expected ${expected})`,
  )
}

console.log(`\n${pass}/${pass + fail} passed`)
if (fail > 0) process.exit(1)
```

**3. Validacao de build:**

```bash
npx tsc --noEmit    # typecheck
npx tsup            # build
node .tmp/demo/test-locale.mjs   # teste manual contra dist/
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `import { normalizeLocale } from "openclaude-sdk"` | Erro | Funciona |
| `import { SUPPORTED_LOCALES } from "openclaude-sdk"` | Erro | Funciona |
| `import type { SupportedLocale } from "openclaude-sdk"` | Erro | Funciona |
| `query({ prompt: "...", options: { locale: "pt-BR" } })` | TypeError | Aceito |
| `locale` em `buildCliArgs()` output | N/A | NAO aparece |
| `tsc --noEmit` | Passa | Passa |
| `tsup` | Passa | Passa |
| `.tmp/demo/test-locale.mjs` | N/A | 18/18 passed |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-127 | localeBarrel | Barrel `src/locale/index.ts` exportando tipo, constante e funcao |
| F-128 | optionsLocale | Campo `locale?: string` em `Options` com JSDoc explicando que NAO afeta idioma do agente |
| F-129 | publicExportsLocale | Reexports de `normalizeLocale`, `SUPPORTED_LOCALES` e `SupportedLocale` em `src/index.ts` |
| F-130 | localeValidation | Inspecao `buildCliArgs()`, script de teste `.tmp/demo/test-locale.mjs`, `tsc --noEmit` e `tsup` passam |

## Limites

- NAO alterar `src/locale/types.ts` — escopo de PRP-049
- NAO alterar `src/locale/normalize.ts` — escopo de PRP-049
- NAO alterar `src/process.ts` — apenas verificar por inspecao que `locale` nao aparece
- NAO alterar `src/query.ts` — `locale` nao precisa de tratamento especial em query
- NAO adicionar `locale` como flag CLI — o `openclaude` CLI nao tem essa flag
- NAO exportar `normalizeLocale` de `src/locale/index.ts` como `default` — named export apenas
- NAO adicionar testes unitarios (nao ha framework de teste configurado)

## Dependencias

Depende de **PRP-049** (tipos e funcao existem). Nenhum PRP depende deste — e o ultimo da cadeia para locale.
