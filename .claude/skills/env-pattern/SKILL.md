---
name: env-pattern
description: Padrao de estruturacao do .env com camadas Docker defaults + DEV OVERRIDES. Use quando criar ou modificar arquivos .env e docker-compose.
---

# .env Guide

## Estrutura

O `.env` tem duas camadas:

1. **Defaults Docker** (topo do arquivo) — valores para quando tudo roda embarcado
   no Docker. Hosts usam `*.internal`, portas sao as internas dos containers.

2. **DEV OVERRIDES** (fundo do arquivo) — sobrescreve os defaults para dev local.
   Hosts viram `localhost`, portas viram as exportadas via dev-ports overlay.

A ultima definicao de uma variavel vence. Em dev, os overrides ficam ativos e
sobrescrevem os defaults. Em producao/staging, basta comentar a secao inteira
de DEV OVERRIDES.

## Modos de operacao

### Producao / Staging

- Comando: `npm run docker:*`
- Compose: `docker-compose.yml` (inclui `docker-compose.platform.yml`)
- Tudo embarcado no Docker — sources + infra
- Usa os defaults do topo: hosts `*.internal`, portas internas
- DEV OVERRIDES deve estar comentado

### Dev

- Comando: `npm run platform:*`
- Compose: `docker-compose.platform.yml` + `docker-compose.platform.dev-ports.yml`
- Somente infra sobe no Docker (postgres, redis, caddy)
- Sources (frontend, backend) rodam no host
- DEV OVERRIDES ativo: hosts = `localhost`, portas exportadas para o host

## Compose — separacao platform vs dev-ports

`docker-compose.platform.yml` define os services de infra **sem expor portas
para o host**. Containers se comunicam pela rede interna via aliases
(`postgres.internal`, `redis.internal`, `caddy.internal`).

`docker-compose.platform.dev-ports.yml` eh um overlay que **so adiciona
mapeamento de portas** para o host, permitindo acesso local com pgAdmin,
redis-cli, etc. Esse overlay eh usado automaticamente por `scripts/platform.mjs`.

Em producao, o overlay de dev-ports nao eh incluido — nenhuma porta de infra
eh exposta para fora da rede Docker.

## Variaveis compostas

Algumas variaveis sao montadas a partir de outras. Em dev, os overrides mudam
os componentes (HOST, PORT) e as variaveis compostas se recalculam automaticamente.
