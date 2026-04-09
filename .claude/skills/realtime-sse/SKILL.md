---
name: realtime-sse
description: Arquitetura de realtime via SSE com canais tematicos. Use quando implementar comunicacao server-to-client em tempo real. PROIBIDO polling e WebSocket.
---

# Realtime — SSE com Canais Tematicos

## Escolha arquitetural

**SSE (Server-Sent Events)** como unico mecanismo de realtime. Sem WebSocket, sem polling.

## Por que SSE

- HTTP nativo — funciona com proxies, CDNs, Caddy sem config extra
- Reconexao automatica built-in no browser (`EventSource`)
- Unidirecional (server->client) — acoes do cliente vao por REST normal
- Sem estado bidirecional pra gerenciar (menos complexidade no backbone)
- Funciona atras de Caddy/reverse proxy sem upgrade de protocolo

## Por que nao WebSocket

- Requer upgrade de protocolo (complica proxy, load balancer, Caddy)
- Estado bidirecional que precisa ser gerenciado (heartbeat, reconexao manual)
- Overhead de implementacao sem beneficio real — nossos apps nao precisam de comunicacao bidirecional em tempo real (acoes vao por REST)

## Por que nao polling

- **PROIBIDO** — desperdicao de recursos e trafego de rede (custo por trafego)
- Latencia (intervalo entre polls)
- Escala mal (N clientes x M polls/segundo)

## Canais tematicos concentrados

Em vez de um canal por entidade/recurso (explosion de canais), usamos **poucos canais tematicos amplos**:

```
/backbone/events/notifications    <- alertas, toasts, mensagens do sistema
/backbone/events/data             <- mudancas em entidades (CRUD events)
/backbone/events/agents           <- status de agentes, progresso de tarefas
/backbone/events/chat             <- mensagens de conversacao (whatsapp, etc.)
```

Cada evento dentro do canal carrega um `type` e `scope` pra filtrar no client:

```json
{
  "type": "entity.updated",
  "scope": "deliveries",
  "id": "uuid",
  "payload": { ... }
}
```

O client filtra por `type`/`scope` no handler — nao precisa assinar/desassinar canais individuais.

## Poucos canais, muitos tipos

A vantagem de concentrar:
- Uma conexao SSE por canal (3-4 conexoes no maximo por tab)
- Servidor mantem poucos streams
- Filtragem e barata no client (JS puro)
- Adicionar novo tipo de evento = zero infra, so backend emite + frontend filtra

## Integracao com o scaffold

- Backbone (Hono) expoe rotas `/backbone/events/*`
- Hub (Vite SPA) conecta nos canais relevantes no mount
- Caddy roteia `/backbone/events/*` -> backbone
- .env nao precisa de porta extra — SSE roda na mesma porta do backbone
