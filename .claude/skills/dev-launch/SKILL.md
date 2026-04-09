---
name: dev-launch
description: Levantar o app durante desenvolvimento — copia .env dos artefatos, sobe infra Docker, inicia dev server. Use quando precisar rodar o app para testar, validar ou fazer smoke test.
---

# Dev Launch — Levantar o App

Protocolo para levantar o app do projeto durante desenvolvimento. Siga na ordem.

## Fase 1 — Estudo

Antes de qualquer acao, entenda como o projeto funciona:

1. Leia `package.json` na raiz (e em subdiretorios se for monorepo)
   - Identifique scripts: `dev`, `start`, `build`, `platform:up`, `docker:up`, `compose:up`
   - Identifique se precisa `npm install` (node_modules existe?)
2. Procure arquivos de infraestrutura:
   - `docker-compose.yml` / `docker-compose.yaml` / `compose.yml` / `compose.yaml`
   - `docker-compose.platform.yml` (infra separada)
   - `.env` / `.env.example` / `.env.local`
3. Identifique a porta do dev server (vite.config, next.config, scripts do package.json)

**Registre mentalmente** antes de prosseguir:
- Comando para subir infra (containers Docker)
- Comando para rodar o dev server
- Porta onde o app vai estar disponivel

## Fase 2 — Ambiente (.env)

4. Se existir `.env` nos artefatos do projeto (`{project}/.env`), copie para a raiz do projeto:
   ```bash
   cp "{project}/.env" .env
   ```
   Isso **sobrepoe** qualquer `.env` existente — o artefato e a fonte da verdade.

5. Se NAO existir artefato `.env` mas existir `.env.example` no projeto:
   ```bash
   cp .env.example .env
   ```

6. Se o projeto usa dotenvx (`.env.development` encriptado):
   ```bash
   npm run secrets:decrypt 2>/dev/null || true
   ```

## Fase 3 — Dependencias

7. Instale dependencias se necessario:
   ```bash
   npm install
   ```

## Fase 4 — Infra (Docker)

8. Se o projeto usa containers Docker para infraestrutura (postgres, redis, etc.):
   - **Prefira scripts do package.json** (nesta ordem):
     1. `npm run platform:up` — sobe somente infra (ideal para dev)
     2. `npm run docker:up` — alternativa
     3. `npm run compose:up` — alternativa
   - Se nenhum script existir, use diretamente:
     ```bash
     docker compose up -d
     ```
   - Se existir `docker-compose.platform.yml` sem script:
     ```bash
     docker compose -f docker-compose.platform.yml up -d
     ```
9. Aguarde containers healthy:
   ```bash
   docker compose ps
   ```

## Fase 5 — Dev Server

10. Rode o dev server em background:
    ```bash
    npm run dev &
    DEV_PID=$!
    echo "Dev server PID: $DEV_PID"
    ```
    **ANOTE O PID** — voce vai precisar dele para cleanup.

11. Aguarde o app estar pronto (timeout 60s):
    ```bash
    for i in $(seq 1 60); do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:{porta} 2>/dev/null)
      [ "$STATUS" = "200" ] && echo "App ready!" && break
      sleep 1
    done
    ```

## Fase 6 — Verificacao

12. Confirme que o app responde:
    ```bash
    curl -s -o /dev/null -w "%{http_code}" http://localhost:{porta}
    ```
    Deve retornar `200`. Se nao, investigue logs do dev server.

## Cleanup

Quando terminar de usar o app:

13. Mate o dev server pelo PID:
    ```bash
    kill $DEV_PID 2>/dev/null
    ```
14. **Containers Docker devem continuar rodando** — NAO derrube a infra.

## Regras

- **Prefira scripts do package.json** — nao invente comandos se o projeto ja tem scripts prontos
- **Estude antes de agir** — cada projeto e diferente, nao assuma nada
- **NAO mate processos pelo nome** (ex: `taskkill /IM node.exe`) — sempre pelo PID
- **NAO deixe processos orfaos** — mate tudo que voce subiu ao finalizar
- **O artefato .env do projeto (`{project}/.env`) e a fonte da verdade** — sempre copie por cima
