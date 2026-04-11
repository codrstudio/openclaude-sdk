---
name: npm-publish
description: Publica o pacote npm da raiz do repo via tag-driven GitHub Action. Detecta o pacote do package.json local — funciona idêntico em qualquer repo que tenha o workflow `.github/workflows/publish.yml` e npm Trusted Publisher configurado via OIDC. Use quando o humano pedir para publicar/fazer release no npm.
---

# Skill: npm-publish

Skill determinística que publica o pacote npm da raiz do repo. **Zero publish local.** Toda publicação acontece via tag → GitHub Action com provenance OIDC. Garante que `package.json.version`, a tag git e a versão publicada no npm estão sempre sincronizadas, porque tudo nasce de um único `npm version <level>`.

## Quando usar

- O humano pediu "publica no npm", "faz release", "sobe versão nova", "cut a release", `/npm-publish`, etc.
- Antes de publicar, **leia esta skill inteira** e siga o fluxo passo a passo.

## Invariantes (nunca quebrar)

1. `package.json.version` ≡ git tag ≡ versão publicada no npm — sempre. Tudo nasce de `npm version <level>`.
2. **Nunca** rodar `npm publish` localmente. Só via tag → GitHub Action.
3. **Nunca** usar `git push --force`.
4. **Nunca** usar credenciais npm locais (sem `npm login`, sem `.npmrc` com token). Autenticação é 100% via OIDC do GitHub Actions (Trusted Publishers).
5. **Sempre** pedir confirmação humana ANTES de bumpar versão.
6. **Abortar** em qualquer falha de pre-flight, build sanity ou GitHub Action.

## Pré-requisitos do repo (verificar uma vez)

Antes da primeira execução, garantir que existem:

1. `.github/workflows/publish.yml` — workflow tag-driven que publica no npm com `--provenance --access public`. Template padrão:
   ```yaml
   name: Publish to npm
   on:
     push: { tags: ['v*'] }
     workflow_dispatch:
   jobs:
     publish:
       runs-on: ubuntu-latest
       permissions: { contents: read, id-token: write }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20, registry-url: https://registry.npmjs.org }
         - run: npm ci
         - run: npm run typecheck
         - run: npm run build
         - run: npm publish --provenance --access public
   ```
   Ordem `typecheck → build` ou `build → typecheck` é livre — escolha o que faz mais sentido pro repo. Funcional é idêntico.

2. **npm Trusted Publisher** configurado para o pacote em npmjs.com → Package Settings → Trusted Publishers → Add, apontando para o repo + workflow filename (`publish.yml`) + environment (se usar). Isso permite autenticação OIDC sem secret — o GitHub Action troca o `id-token` emitido pelo runner por um token de curta duração do npm registry. **Não precisa de `NPM_TOKEN`.**

3. `gh` CLI autenticado localmente (`gh auth status` ok).

Se algum desses faltar, **abortar com mensagem clara** instruindo o humano a configurar antes de rodar a skill de novo.

## Argumentos aceitos

- `patch` | `minor` | `major` — nível do bump (obrigatório, exceto com `--dry-run`)
- `--dry-run` — roda preflight + build sanity + `npm pack --dry-run`, **não** bumpa, **não** dá push, **não** publica. Usado pra validar que tudo está ok sem efeito colateral.
- `--branch <nome>` — override do default `main`
- `--no-release-notes` — pula a criação automática de release notes no GitHub (passo 8)

## Fluxo (passo a passo, determinístico)

### 1. Pre-flight (bloqueante)

Cada item abaixo aborta a skill com mensagem clara em caso de falha:

- Working tree limpo: `git status --porcelain` retorna vazio
- Branch correta: `git rev-parse --abbrev-ref HEAD` == `main` (ou o valor de `--branch`)
- Sincronizado com remote: `git fetch origin` e depois `git rev-parse HEAD == git rev-parse origin/<branch>`
- Workflow existe: `.github/workflows/publish.yml` está presente
- `gh auth status` ok
- Argumento de bump informado (ou `--dry-run`)
- Calcula a próxima versão a partir do `package.json.version` atual + nível de bump (sem aplicar ainda)
- Próxima tag não existe: `git tag -l v<nova-versao>` retorna vazio

### 2. Build sanity local

- `npm ci` (instalação limpa, igual ao CI)
- Se `package.json.scripts.typecheck` existir: `npm run typecheck`. Se ausente: pula com aviso. Não bloqueia se ausente.
- Se `package.json.scripts.test` existir: `npm test`. Mesma regra.
- `npm run build`
- **Validação genérica de exports**: ler `package.json.exports` (e/ou `main`/`types`/`module`) e verificar que cada caminho declarado existe no `dist/` após o build. Funciona idêntico em qualquer repo, sem hardcode. Exemplo: se `exports["."].default == "./dist/index.js"` e `exports["./styles.css"] == "./dist/styles.css"`, ambos arquivos precisam existir. Falta de qualquer entrypoint declarado → ABORTAR.
- `npm pack --dry-run` para gerar a lista de arquivos que vão pro tarball

### 3. Confirmação humana (CHECKPOINT OBRIGATÓRIO)

Mostrar pro humano em formato compacto:

- Pacote: `<package.json.name>`
- Versão atual → nova: `X.Y.Z` → `X.Y.(Z+1)` (ou minor/major)
- Branch: `main`
- Lista de arquivos do tarball (output do `npm pack --dry-run`)
- Tamanho do tarball

Pedir confirmação explícita: aguardar `yes` (ou equivalente). Qualquer outra resposta aborta.

Se rodando com `--dry-run`, o fluxo **para aqui** sem fazer mais nada. Reportar sucesso do dry-run.

### 4. Bump de versão (atomic)

- `npm version <patch|minor|major>` — isso faz **três coisas atomicamente**:
  1. Bumpa `version` no `package.json` (ex: `0.1.0` → `0.1.1`)
  2. Cria commit com mensagem padrão (ex: `0.1.1`)
  3. Cria git tag `v0.1.1` apontando pro commit
- Mostrar o commit gerado e a tag criada

### 5. Push

- `git push origin <branch>` (sem `--force`)
- `git push origin --tags`

### 6. Monitor da GitHub Action

- Esperar a action disparar (a tag push ativa o workflow `publish.yml`)
- `gh run watch` na última run do workflow `publish.yml` (streama o log)
- Se a action **falhar**: ABORTAR com erro claro. **Não tentar republicar.** Instruir o humano a investigar o log do CI antes de tentar de novo.

### 7. Verificação no registry

- `npm view <pkg>@<version>` — confirma que a versão apareceu no registry npm
- Mostrar link: `https://www.npmjs.com/package/<pkg>`
- Se a action passou mas `npm view` não encontra a versão (race condition rara), esperar 5-10s e tentar de novo. Se ainda assim não aparecer, alertar humano.

### 8. Release notes (default ON, opcional)

- Se `--no-release-notes` **não** foi passado:
- `gh release create v<version> --generate-notes` — gera automaticamente release notes baseadas nos commits/PRs desde a tag anterior
- Mostrar link da release no GitHub

## Recuperação de erros

- **Falha no pre-flight ou build sanity**: nada foi modificado, abortar e reportar. Humano corrige e roda de novo.
- **Falha entre `npm version` e `git push`**: o commit + tag locais existem mas não foram pra origin. **Não desfazer automaticamente.** Reportar pro humano a situação exata e perguntar como prosseguir (opções: `git push` manual depois de corrigir o problema, ou `git tag -d v<x> && git reset --hard HEAD~1` pra desfazer localmente).
- **Falha na GitHub Action**: o tag já está pushed. **Não tentar republicar.** Instruir humano a investigar o log do CI. Se a correção exigir um novo commit, o caminho é bumpar uma versão patch nova (ex: `0.1.1` → `0.1.2`) — **nunca reapagar a tag publicada**.
- **Race no `npm view`**: retry com backoff curto (uma tentativa após 10s). Se ainda assim falhar, alertar mas não abortar — a action passou, então o publish ocorreu.

## O que esta skill NÃO faz

- Não gera changelog automático (release notes do GitHub via `--generate-notes` cobrem o valor sem overhead)
- Não publica monorepos com múltiplos pacotes — assume **um pacote por repo, na raiz**. Para monorepos, parametrizar o `cwd` em uma versão futura
- Não chama `npm login`, não usa credenciais locais — autenticação é 100% via OIDC do GitHub Actions
- Não roda `npm publish` localmente em **nenhuma** circunstância
- Não usa `--force` em git push
- Não desfaz commits/tags automaticamente em caso de erro pós-`npm version`
