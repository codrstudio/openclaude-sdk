# PRP-001 — Project Setup & Package Distribution

## Objetivo

Configurar o projeto `openclaude-sdk` para distribuicao npm: copiar fontes do prototipo, configurar package.json, tsconfig.json, tsup, e validar que o build produz ESM + CJS + DTS.

Referencia: spec S-001 (D-001).

## Execution Mode

`implementar`

## Contexto

O prototipo da SDK existe em `proto/sdk/src/` (artefato do projeto) com os seguintes arquivos:
- `index.ts` — re-exports
- `query.ts` — `query()`, `collectMessages()`
- `process.ts` — `spawnAndStream()`, `buildCliArgs()`
- `registry.ts` — `createOpenRouterRegistry()`, `resolveModelEnv()`, `resolveCommand()`
- `sessions.ts` — `listSessions()`, `getSessionMessages()`, etc.
- `types/` — tipos TypeScript completos

O prototipo usa `@claude-chat/sdk-3` como nome e esta marcado como `private`. Precisa ser migrado para um projeto standalone publicavel.

## Especificacao

### 1. Copiar fontes do prototipo

Copiar `proto/sdk/src/` (do diretorio de artefatos do projeto) para `src/` na raiz do repositorio. Manter a estrutura de arquivos intacta.

O diretorio de artefatos do projeto e: o diretorio declarado em `project.json` como `target_folder`, ou se ausente, o caminho `D:/aw/context/projects/openclaude-sdk/artifacts/`.

### 2. package.json

Criar `package.json` na raiz com:

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
| `scripts.build` | `"tsup"` |
| `scripts.dev` | `"tsup --watch"` |
| `scripts.typecheck` | `"tsc --noEmit"` |
| `devDependencies` | `tsup`, `typescript` >= 5.4 |

NAO incluir `"private": true`. Nenhuma dependencia de runtime em `dependencies`.

### 3. tsconfig.json

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

### 4. tsup.config.ts

| Campo | Valor |
|-------|-------|
| `entry` | `["src/index.ts"]` |
| `format` | `["esm", "cjs"]` |
| `dts` | `true` |
| `clean` | `true` |
| `target` | `"es2022"` |
| `splitting` | `false` |
| `sourcemap` | `true` |

### 5. .gitignore

Incluir: `node_modules/`, `dist/`, `*.tgz`.

### 6. LICENSE

Criar arquivo MIT license.

### 7. Validacao

Executar:
1. `npm install` — instala devDependencies
2. `npm run build` — deve produzir `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`
3. `npm run typecheck` — deve passar sem erros

Se o typecheck falhar por causa de imports `.js` ou tipos ausentes, corrigir os fontes ate passar.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-001 | Copiar fontes | Copiar `proto/sdk/src/` para `src/` |
| F-002 | Package config | Criar `package.json`, `tsconfig.json`, `tsup.config.ts`, `.gitignore`, `LICENSE` |
| F-003 | Build & validate | `npm install && npm run build && npm run typecheck` passam |

## Limites

- NAO modificar logica dos fontes do prototipo (apenas ajustes de import/tipo para compilar)
- NAO adicionar dependencias de runtime
- NAO publicar no npm
- NAO criar README ainda (sera PRP-007)

## Dependencias

Nenhuma. Este e o primeiro PRP.
