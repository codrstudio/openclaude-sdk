# openclaude-sdk - Barrel locale, campo Options.locale e exports publicos

Spec do barrel `src/locale/index.ts`, campo `locale?: string` em `Options`, e re-exports em `src/index.ts`.

---

## Objetivo

Resolve D-106, D-107, D-108.

| Problema | Consequencia |
|----------|-------------|
| Sem barrel, imports do modulo locale seriam profundos e frageis | Consumidores internos teriam que importar de paths especificos |
| `Options` nao tem campo `locale` | Consumidores nao conseguem passar locale nos 4 entry points |
| Tipos e funcoes de locale nao estao no export publico | Consumidores nao tem acesso a `normalizeLocale` nem `SupportedLocale` |

---

## Estado Atual

### `src/locale/`

Nao existe. Sera criado por S-079 e S-080.

### `src/types/options.ts`

Interface `Options` (linha 268) contem `richOutput`, `reactOutput`, `askUser`, `askUserTimeoutMs` mas **nao** contem `locale`.

### `src/index.ts`

Nao ha exports de `locale/`.

---

## Implementacao

### 1. Criar `src/locale/index.ts`

```typescript
export type { SupportedLocale } from "./types.js"
export { SUPPORTED_LOCALES } from "./types.js"
export { normalizeLocale } from "./normalize.js"
```

### 2. Adicionar `locale?: string` em `Options` (`src/types/options.ts`)

Apos `askUserTimeoutMs?: number` (linha 311), adicionar:

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

### 3. Re-exports em `src/index.ts`

Adicionar nova secao apos o bloco "Ask User":

```typescript
// ---------------------------------------------------------------------------
// Locale — Internationalization helpers (locale option)
// ---------------------------------------------------------------------------

export { normalizeLocale, SUPPORTED_LOCALES } from "./locale/index.js"
export type { SupportedLocale } from "./locale/index.js"
```

### Regras

- O campo `locale` em `Options` e `string`, nao `SupportedLocale` — aceita qualquer string, normalizacao acontece internamente
- JSDoc **deve** explicitar que `locale` NAO afeta o idioma do agente
- Barrel exporta apenas: `SupportedLocale` (tipo), `SUPPORTED_LOCALES` (constante), `normalizeLocale` (funcao)
- `locale` NAO deve aparecer em `buildCliArgs()` — verificar por inspecao que `process.ts` nao mapeia o campo

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/locale/index.ts` | Novo — barrel exports |
| `src/types/options.ts` | + campo `locale?: string` com JSDoc |
| `src/index.ts` | + secao de re-exports de locale |

---

## Criterios de Aceite

- [ ] `src/locale/index.ts` exporta `SupportedLocale`, `SUPPORTED_LOCALES`, `normalizeLocale`
- [ ] `Options.locale?: string` presente em `src/types/options.ts`
- [ ] JSDoc do campo explicita que NAO afeta o idioma do agente
- [ ] `src/index.ts` re-exporta `normalizeLocale`, `SUPPORTED_LOCALES`, `SupportedLocale`
- [ ] `locale` NAO aparece em `buildCliArgs()` de `src/process.ts`
- [ ] Campo aceito nos 4 entry points: `query`, `prompt`, `createSession`, `resumeSession` (todos recebem `Options`)
- [ ] `tsc --noEmit` passa
- [ ] `tsup` builda sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `src/locale/index.ts` barrel | S-081 |
| `Options.locale` campo | S-081 |
| JSDoc locale | S-081 |
| Re-exports publicos | S-081 |
| D-106 | S-081 |
| D-107 | S-081 |
| D-108 | S-081 |
