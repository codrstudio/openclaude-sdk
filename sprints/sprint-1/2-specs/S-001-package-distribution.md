# openclaude-sdk - Configuracao de Package para Distribuicao

Configurar o package para publicacao npm com build ESM + CJS + DTS via tsup.

---

## Objetivo

Resolver D-001: o prototipo esta como `@claude-chat/sdk-3` (private). A SDK precisa ser instalavel via npm com nome correto, exports configurados e build profissional.

---

## Estrutura do Projeto

| Item | Valor |
|------|-------|
| Nome do package | `openclaude-sdk` |
| Diretorio raiz | `/` (raiz do repo) |
| Source | `src/` |
| Output | `dist/` |
| Entry point | `src/index.ts` |

---

## package.json

| Campo | Valor |
|-------|-------|
| `name` | `"openclaude-sdk"` |
| `version` | `"0.1.0"` |
| `description` | `"TypeScript SDK wrapper for the OpenClaude CLI"` |
| `license` | `"MIT"` |
| `type` | `"module"` |
| `main` | `"./dist/index.cjs"` |
| `module` | `"./dist/index.js"` |
| `types` | `"./dist/index.d.ts"` |
| `exports["."].import` | `"./dist/index.js"` |
| `exports["."].require` | `"./dist/index.cjs"` |
| `exports["."].types` | `"./dist/index.d.ts"` |
| `files` | `["dist", "README.md", "LICENSE"]` |
| `engines.node` | `">=20"` |
| `private` | remover campo ou `false` |

---

## Build (tsup)

| Campo | Valor |
|-------|-------|
| `entry` | `["src/index.ts"]` |
| `format` | `["esm", "cjs"]` |
| `dts` | `true` |
| `clean` | `true` |
| `target` | `"es2022"` |
| `splitting` | `false` |
| `sourcemap` | `true` |

### Scripts

| Script | Comando |
|--------|---------|
| `build` | `tsup` |
| `dev` | `tsup --watch` |
| `typecheck` | `tsc --noEmit` |

---

## tsconfig.json

| Campo | Valor |
|-------|-------|
| `target` | `"ES2022"` |
| `module` | `"ESNext"` |
| `moduleResolution` | `"bundler"` |
| `strict` | `true` |
| `noUncheckedIndexedAccess` | `true` |
| `declaration` | `true` |
| `outDir` | `"dist"` |
| `rootDir` | `"src"` |
| `include` | `["src"]` |
| `exclude` | `["node_modules", "dist"]` |

---

## Dependencias

| Tipo | Pacote | Justificativa |
|------|--------|---------------|
| `dependencies` | (nenhuma) | SDK usa apenas APIs nativas do Node.js |
| `devDependencies` | `tsup` | Build ESM + CJS + DTS |
| `devDependencies` | `typescript` >= 5.4 | Type checking e declarations |

---

## Migracoes do Prototipo

| De (prototipo) | Para (producao) |
|-----------------|-----------------|
| `@claude-chat/sdk-3` | `openclaude-sdk` |
| `"private": true` | remover |
| Imports com `.js` extension | Manter (bundler resolution) |
| Arquivos em `proto/sdk/src/` | Copiar para `src/` |

---

## Criterios de Aceite

- [ ] `npm run build` produz `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` (DTS)
- [ ] `npm run typecheck` passa sem erros
- [ ] `import { query } from "openclaude-sdk"` funciona em ESM
- [ ] `const { query } = require("openclaude-sdk")` funciona em CJS
- [ ] `npm pack` produz tarball com apenas `dist/`, `README.md`, `LICENSE`
- [ ] Nenhuma dependencia de runtime no `dependencies`

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| package.json | S-001 |
| tsconfig.json | S-001 |
| tsup.config.ts | S-001 |
| Build pipeline | S-001 |
| Discovery | D-001 |
