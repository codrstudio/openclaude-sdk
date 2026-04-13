---
name: publish
description: Publica o pacote nos registries npm e GitHub Packages via tag-driven GitHub Actions. Uma tag v* dispara ambos os workflows em paralelo. Detecta o pacote do package.json local. Use quando o humano pedir para publicar, fazer release, ou subir versao nova.
---

# Skill: publish

Skill deterministica que publica o pacote nos registries **npm** e **GitHub Packages** simultaneamente. **Zero publish local.** Toda publicacao acontece via tag -> GitHub Actions. Uma unica tag `v*` dispara ambos os workflows em paralelo. Garante que `package.json.version`, a tag git e as versoes publicadas nos dois registries estao sempre sincronizadas, porque tudo nasce de um unico `npm version <level>`.

## Quando usar

- O humano pediu "publica", "faz release", "sobe versao nova", "cut a release", `/publish`, etc.
- Antes de publicar, **leia esta skill inteira** e siga o fluxo passo a passo.

## Invariantes (nunca quebrar)

1. `package.json.version` === git tag === versao publicada nos dois registries — sempre.
2. **Nunca** rodar `npm publish` localmente. So via tag -> GitHub Actions.
3. **Nunca** usar `git push --force`.
4. **Nunca** usar credenciais npm locais (sem `npm login`, sem `.npmrc` com token). npm usa OIDC (Trusted Publishers); GitHub Packages usa `GITHUB_TOKEN`.
5. **Sempre** pedir confirmacao humana ANTES de bumpar versao.
6. **Abortar** em qualquer falha de pre-flight, build sanity ou GitHub Action.

## Pre-requisitos do repo (verificar uma vez)

Antes da primeira execucao, garantir que existem:

1. `.github/workflows/publish.yml` — workflow tag-driven que publica no **npm** com `--provenance --access public`.
2. `.github/workflows/publish-github.yml` — workflow tag-driven que publica no **GitHub Packages** com `GITHUB_TOKEN`.
3. **npm Trusted Publisher** configurado para o pacote em npmjs.com -> Package Settings -> Trusted Publishers -> Add, apontando para o repo + workflow filename (`publish.yml`).
4. `gh` CLI autenticado localmente (`gh auth status` ok).

Se algum desses faltar, **abortar com mensagem clara** instruindo o humano a configurar antes de rodar a skill de novo.

## Argumentos aceitos

- `patch` | `minor` | `major` — **opcional**. Override manual do nivel do bump. Se omitido, a skill **infere automaticamente** pelos commits (ver abaixo). Nunca perguntar ao humano.
- `--dry-run` — roda preflight + build sanity + `npm pack --dry-run`, **nao** bumpa, **nao** da push, **nao** publica.
- `--branch <nome>` — override do default `main`
- `--no-release-notes` — pula a criacao automatica de release notes no GitHub (passo 8)

## Inferencia do nivel de bump (semver)

Quando o humano nao passa `patch|minor|major` explicito, a skill determina o nivel sozinha seguindo semver estrito. **Nunca perguntar ao humano qual nivel usar** — ele nao precisa saber, a skill infere.

Regras (nesta ordem, primeira que casar vence):

1. **major** -> quebra de compatibilidade da API publica do pacote. Sinais: remocao/renomeacao de export, mudanca de assinatura de funcao exportada, mudanca de shape de tipo exportado, remocao de prop de componente publico, mudanca de comportamento observavel que forca o consumidor a alterar codigo. Tambem dispara se algum commit tiver `BREAKING CHANGE:` no corpo ou `!` apos o tipo (ex: `feat!:`).
2. **minor** -> adicao de funcionalidade retrocompativel. Sinais: novo export, nova prop opcional, novo componente, novo parametro opcional, `feat:` nos commits.
3. **patch** -> correcao retrocompativel, refactor interno, docs, build, deps sem breaking. Sinais: `fix:`, `refactor:`, `chore:`, `docs:`, `build:`, `perf:` (sem mudanca de API).

**Como inferir na pratica**:
- Listar commits desde a ultima tag `v*`: `git log <last-tag>..HEAD --format=%s%n%b`
- Classificar cada commit pelo tipo convencional + corpo
- Pegar o **maior** nivel entre todos os commits (major > minor > patch)
- Se nao houver commits desde a ultima tag, abortar com mensagem "nada para publicar"
- Antes do passo 3 (confirmacao), **mostrar** ao humano o nivel inferido + os commits que justificam a decisao. O humano pode corrigir respondendo `major`/`minor`/`patch` em vez de `yes`.

## Fluxo (passo a passo, deterministico)

### 1. Pre-flight (bloqueante)

Cada item abaixo aborta a skill com mensagem clara em caso de falha:

- Working tree limpo: `git status --porcelain` retorna vazio
- Branch correta: `git rev-parse --abbrev-ref HEAD` == `main` (ou o valor de `--branch`)
- Sincronizado com remote: `git fetch origin` e depois `git rev-parse HEAD == git rev-parse origin/<branch>`
- Ambos workflows existem: `.github/workflows/publish.yml` e `.github/workflows/publish-github.yml`
- `gh auth status` ok
- Determina o nivel de bump: usa o argumento `patch|minor|major` se informado; senao **infere pelos commits** (ver secao "Inferencia do nivel de bump"). Nunca perguntar ao humano.
- Calcula a proxima versao a partir do `package.json.version` atual + nivel de bump (sem aplicar ainda)
- Proxima tag nao existe: `git tag -l v<nova-versao>` retorna vazio. Se existir, ABORTAR.

### 2. Build sanity local

- `npm ci` (instalacao limpa, igual ao CI)
- Se `package.json.scripts.typecheck` existir: `npm run typecheck`. Se ausente: pula com aviso.
- Se `package.json.scripts.test` existir: `npm test`. Mesma regra.
- `npm run build`
- **Validacao de exports**: ler `package.json.exports` (e/ou `main`/`types`/`module`) e verificar que cada caminho declarado existe no `dist/` apos o build.
- `npm pack --dry-run` para gerar a lista de arquivos que vao pro tarball

### 3. Confirmacao humana (CHECKPOINT OBRIGATORIO)

Mostrar pro humano em formato compacto:

- Pacote: `<package.json.name>`
- Versao atual -> nova: `X.Y.Z` -> `A.B.C`
- Nivel: `patch|minor|major` + como foi decidido (inferido / override)
- Commits que justificam o nivel inferido
- Branch: `main`
- Lista de arquivos do tarball (output do `npm pack --dry-run`)
- Tamanho do tarball
- **Destinos**: npm + GitHub Packages

Pedir confirmacao explicita: aguardar `yes`. Qualquer outra resposta aborta. Se o humano responder `patch`/`minor`/`major`, usar como override.

Se rodando com `--dry-run`, o fluxo **para aqui**.

### 4. Bump de versao (atomic)

- `npm version <patch|minor|major>` — faz tres coisas atomicamente:
  1. Bumpa `version` no `package.json`
  2. Cria commit com mensagem padrao (ex: `0.4.0`)
  3. Cria git tag `v0.4.0` apontando pro commit

### 5. Push

- `git push origin <branch>` (sem `--force`)
- `git push origin --tags`

### 6. Monitor das GitHub Actions

- A tag push ativa **ambos** os workflows (`publish.yml` e `publish-github.yml`)
- Monitorar as duas runs em paralelo:
  - `gh run watch` na run do `publish.yml` (npm)
  - `gh run watch` na run do `publish-github.yml` (GitHub Packages)
- Se **qualquer** action falhar: reportar qual falhou com erro claro. **Nao tentar republicar.**

### 7. Verificacao nos registries

Confirmar nos **dois** registries:

- **npm**: `npm view <pkg>@<version>` — confirma no registry npm
  - Link: `https://www.npmjs.com/package/<pkg>`
- **GitHub Packages**: `npm view <pkg>@<version> --registry=https://npm.pkg.github.com`
  - Link: `https://github.com/<owner>/<repo>/packages`

Se race condition (action passou mas view nao encontra), esperar 10s e retry uma vez.

### 8. Release notes (default ON)

- Se `--no-release-notes` **nao** foi passado:
- `gh release create v<version> --generate-notes`
- Mostrar link da release

## Recuperacao de erros

- **Falha no pre-flight ou build sanity**: nada foi modificado, abortar e reportar.
- **Falha entre `npm version` e `git push`**: commit + tag locais existem mas nao foram pra origin. **Nao desfazer automaticamente.** Reportar e perguntar como prosseguir.
- **Falha em uma das GitHub Actions**: reportar qual falhou. A outra pode ter passado. **Nao tentar republicar.** Instruir humano a investigar o log do CI.
- **Race no `npm view`**: retry com backoff curto (10s). Se ainda falhar, alertar mas nao abortar.

## O que esta skill NAO faz

- Nao gera changelog automatico (release notes do GitHub via `--generate-notes` cobrem)
- Nao publica monorepos com multiplos pacotes — assume **um pacote por repo, na raiz**
- Nao chama `npm login`, nao usa credenciais locais
- Nao roda `npm publish` localmente em **nenhuma** circunstancia
- Nao usa `--force` em git push
- Nao desfaz commits/tags automaticamente em caso de erro pos-`npm version`
