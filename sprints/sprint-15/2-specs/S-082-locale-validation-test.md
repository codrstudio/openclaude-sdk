# openclaude-sdk - Validacao: nao-propagacao CLI e teste manual

Spec da verificacao de nao-propagacao de `locale` para o CLI e do script de teste manual.

---

## Objetivo

Resolve D-109, D-110, D-111.

| Problema | Consequencia |
|----------|-------------|
| `locale` poderia vazar como flag CLI por engano | O `openclaude` CLI nao tem flag `--locale` — passaria como arg invalido |
| Sem teste manual, regressoes na normalizacao passam despercebidas | 18 casos de teste do TASK.md precisam ser validados |
| Build e typecheck podem quebrar com novos arquivos | Novos modulos precisam compilar corretamente |

---

## Estado Atual

### `src/process.ts` — `buildCliArgs()`

A funcao (linha 72) mapeia campos de `Options` para flags CLI. Os campos `richOutput`, `reactOutput`, `askUser`, `askUserTimeoutMs` nao geram flags CLI (sao SDK-side). `locale` tambem nao deve gerar flag.

### `.tmp/demo/`

Diretorio de scripts de teste manual. Pode ou nao existir.

---

## Implementacao

### 1. Verificacao de nao-propagacao

Inspecionar `buildCliArgs()` em `src/process.ts` e confirmar que `locale` **nao** aparece:

- Nao ha `if (options.locale)` no corpo
- Nao ha `args.push("--locale", ...)` 
- Nao ha menção de `locale` em nenhum mapeamento de args

✅ Se `locale` nao aparece em `buildCliArgs()`, a verificacao passa.
❌ Se aparecer, remover — `locale` e puramente SDK-side.

### 2. Script de teste manual `.tmp/demo/test-locale.mjs`

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

### 3. Validacao de build

Executar em sequencia:

```bash
npx tsc --noEmit    # typecheck
npx tsup            # build
node .tmp/demo/test-locale.mjs   # teste manual contra dist/
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/process.ts` | Nenhuma (verificacao por inspecao) |
| `.tmp/demo/test-locale.mjs` | Novo — script de teste manual |

---

## Criterios de Aceite

- [ ] `locale` NAO aparece em `buildCliArgs()` de `src/process.ts`
- [ ] `.tmp/demo/test-locale.mjs` executa 18 casos de teste
- [ ] Todos os 18 casos passam (exit code 0)
- [ ] `tsc --noEmit` passa sem erro
- [ ] `tsup` builda sem erro
- [ ] `dist/index.js` exporta `normalizeLocale` corretamente

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| Inspecao `buildCliArgs()` | S-082 |
| `.tmp/demo/test-locale.mjs` | S-082 |
| Typecheck + build | S-082 |
| D-109 | S-082 |
| D-110 | S-082 |
| D-111 | S-082 |
