# openclaude-sdk - Documentar Uso de MCP Servers Externos no README

Adicionar secao com exemplos praticos de MCP servers externos (stdio, SSE, HTTP) ao README.md.

---

## Objetivo

Resolver D-064 (score 5): o README tem secao detalhada de "MCP Tool Factories" (servidores inline via `tool()` e `createSdkMcpServer()`) mas nao ha exemplos de MCP servers externos. O campo `mcpServers` aparece na tabela de Options mas sem exemplo pratico. Usuarios que querem integrar servidores MCP externos (ex: Brave Search, databases) nao tem referencia.

---

## Estado Atual

**Arquivo**: `README.md`

Secoes existentes:
- "MCP Tool Factories" — cobre `tool()` e `createSdkMcpServer()` (servidores inline)
- Tabela de Options — lista `mcpServers` com tipo mas sem exemplo

Secao ausente: exemplos de MCP servers stdio, SSE e HTTP.

---

## Implementacao

### 1. Adicionar secao "External MCP Servers" ao README

**Arquivo**: `README.md`, inserir apos a secao "MCP Tool Factories"

Conteudo da secao:

```markdown
### External MCP Servers

Configure external MCP servers via the `mcpServers` option. Three transport types are supported:

#### stdio

```typescript
const q = query({
  prompt: "Search for TypeScript best practices",
  options: {
    mcpServers: {
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-server-brave-search"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
    },
  },
})
```

#### SSE

```typescript
const q = query({
  prompt: "Query the database",
  options: {
    mcpServers: {
      "my-db": {
        type: "sse",
        url: "http://localhost:3001/sse",
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  },
})
```

#### HTTP (Streamable)

```typescript
const q = query({
  prompt: "Fetch latest metrics",
  options: {
    mcpServers: {
      metrics: {
        type: "http",
        url: "https://mcp.internal.company.com/metrics",
        headers: { "X-API-Key": apiKey },
      },
    },
  },
})
```

Multiple servers can be combined in a single query:

```typescript
const q = query({
  prompt: "Search the web and save results to the database",
  options: {
    mcpServers: {
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-server-brave-search"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
      "my-db": {
        type: "sse",
        url: "http://localhost:3001/sse",
      },
    },
  },
})
```
```

---

## Criterios de Aceite

- [ ] Secao "External MCP Servers" presente no README, apos "MCP Tool Factories"
- [ ] Exemplos cobrem os tres transportes: stdio, SSE, HTTP
- [ ] Exemplo de combinacao de multiplos servers
- [ ] Exemplos mostram uso de `env` (stdio) e `headers` (SSE/HTTP)
- [ ] Codigo dos exemplos compila (tipos corretos)

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `README.md` — External MCP Servers | S-056 |
| `Options.mcpServers` | S-056 |
| Discovery | D-064 |
