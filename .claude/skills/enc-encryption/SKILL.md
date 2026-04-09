---
name: enc-encryption
description: Gestao de secrets via dotenvx com encriptacao per-environment. Use quando configurar secrets, .env encriptados, ou deploy que envolva variaveis sensiveis.
---

# Secrets — dotenvx (per-environment)

Arquivos `.env.{environment}` encriptados no repositorio via @dotenvx/dotenvx. O `.env` runtime e gitignored (plaintext).

## Arquitetura

```
No git (encriptados):   .env.development  .env.staging  .env.production
Em uso (gitignored):    .env
```

O `.env.{env}` **nunca** e decriptado no disco. O `--stdout` do dotenvx garante isso.

## Arquivos

| Arquivo | Commitado | Descricao |
|---|---|---|
| `.env.development` | sim | Secrets de dev (encriptado) |
| `.env.staging` | sim | Secrets de staging (encriptado) |
| `.env.production` | sim | Secrets de producao (encriptado) |
| `.env` | nao | Runtime (plaintext, gitignored) |
| `.env.example` | sim | Template com placeholders (sem secrets) |
| `.env.keys` | nao | Chave privada (gitignored) |

## Uso

```bash
npm run secrets:decrypt                  # .env.development -> .env
npm run secrets:decrypt -- staging       # .env.staging -> .env
npm run secrets:decrypt -- production    # .env.production -> .env

npm run secrets:encrypt                  # .env -> .env.development
npm run secrets:encrypt -- staging       # .env -> .env.staging
npm run secrets:encrypt -- production    # .env -> .env.production
```

Os scripts `dev:*` usam `dotenvx run -f .env.development` e decriptam em memoria — nao e necessario decriptar antes.

## Chave privada

Todos os ambientes usam a **mesma chave** (`DOTENV_PUBLIC_KEY` generico, sem sufixo).

### Resolucao (ordem de prioridade)

1. **`DOTENV_PRIVATE_KEY` env var** — servidor/CI.
2. **`.env.keys` arquivo** — conveniencia local.

### Primeiro setup

Obtenha a chave privada com um colega e:

```bash
# Arquivo local
echo "DOTENV_PRIVATE_KEY=<chave>" > .env.keys

# Ou env var (servidor/CI)
export DOTENV_PRIVATE_KEY=<chave>
```

Uma chave para tudo — development, staging, production.

## Deploy

```bash
git pull
npm run secrets:decrypt -- production    # .env.production -> .env (plaintext)
docker compose up -d                     # le .env normalmente
```

## Alterar um secret

```bash
npm run secrets:decrypt                  # .env.development -> .env
vim .env                                 # edite normalmente
npm run secrets:encrypt                  # .env -> .env.development (encriptado)
git add .env.development
git commit -m "chore: update secrets"
```

O encrypt preserva o keypair existente — a chave privada nao muda.

## Criar novo ambiente

```bash
vim .env                                 # ajustar valores para o novo ambiente
npm run secrets:encrypt -- staging       # cria .env.staging (reusa keypair compartilhado)
git add .env.staging
git commit -m "chore: add staging secrets"
```

## Notas

- dotenvx encripta valores inline — nomes de variaveis ficam visiveis no diff.
- `dotenvx run -f .env.development` decripta em memoria, nunca toca o disco.
- `secrets.sh` preserva a public key generica ao re-encriptar, mantendo o keypair compartilhado.
- `secrets.sh` limpa o header dotenvx do `.env` no decrypt (sem lixo no runtime).
