# openclaude-sdk - Modulo locale: tipos e constantes

Spec dos tipos fundamentais do modulo `src/locale/` — tipo `SupportedLocale` e constante `SUPPORTED_LOCALES`.

---

## Objetivo

Resolve D-104.

| Problema | Consequencia |
|----------|-------------|
| Nao existe tipo para representar locales suportados pelo SDK | Sem type-safety para locale em todo o codebase |
| Nao existe lista enumerada dos locales validos | Consumidores nao sabem quais locales o SDK suporta |

---

## Estado Atual

### `src/`

- Nao existe diretorio `src/locale/`
- Nenhum tipo `SupportedLocale` no codebase
- Nenhuma constante `SUPPORTED_LOCALES` no codebase

---

## Implementacao

### 1. Criar `src/locale/types.ts`

```typescript
export type SupportedLocale = "pt-BR" | "en-US" | "es-ES"

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  "pt-BR",
  "en-US",
  "es-ES",
] as const
```

### Regras

- `SupportedLocale` e um union de string literals — nao enum
- `SUPPORTED_LOCALES` e `readonly` e `as const` — imutavel em runtime
- Ordem: pt-BR primeiro (default historico), en-US segundo (fallback global), es-ES terceiro
- Nao importa nenhuma dependencia externa

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/locale/types.ts` | Novo — tipo `SupportedLocale`, constante `SUPPORTED_LOCALES` |

---

## Criterios de Aceite

- [ ] `type SupportedLocale = "pt-BR" | "en-US" | "es-ES"` exportado de `src/locale/types.ts`
- [ ] `const SUPPORTED_LOCALES: readonly SupportedLocale[]` exportado de `src/locale/types.ts`
- [ ] Array contem exatamente 3 entries: `"pt-BR"`, `"en-US"`, `"es-ES"`
- [ ] Array e `as const` e `readonly`
- [ ] Zero dependencias externas
- [ ] `tsc --noEmit` passa

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `SupportedLocale` tipo | S-079 |
| `SUPPORTED_LOCALES` constante | S-079 |
| D-104 | S-079 |
