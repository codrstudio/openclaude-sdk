# openclaude-sdk - Transmitir Headers de MCP Servers Externos ao CLI

Passar campo `headers` de `McpSSEServerConfig` e `McpHttpServerConfig` como argumento CLI.

---

## Objetivo

Resolver D-063 (score 5): as interfaces `McpSSEServerConfig` e `McpHttpServerConfig` tem campo `headers?: Record<string, string>` mas `buildCliArgs()` gera apenas `--mcp-server-sse name:URL`, sem transmitir os headers. Servidores MCP que requerem autenticacao via header (ex: `Authorization: Bearer <token>`) ficam inacessiveis.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Headers ignorados | MCP servers com auth falham sem mensagem clara |
| 2 | Sem workaround | Nao ha como passar headers via `extraArgs` |

---

## Estado Atual

**Arquivo**: `src/process.ts`, linhas 159-162

```typescript
} else if (config.type === "sse" || config.type === "http") {
  const remote = config as McpSSEServerConfig | McpHttpServerConfig
  args.push("--mcp-server-sse", `${name}:${remote.url}`)
}
```

Headers existem no tipo mas nao sao transmitidos.

---

## Implementacao

**Arquivo**: `src/process.ts`, substituir bloco SSE/HTTP (linhas 159-162)

**Antes:**

```typescript
} else if (config.type === "sse" || config.type === "http") {
  const remote = config as McpSSEServerConfig | McpHttpServerConfig
  args.push("--mcp-server-sse", `${name}:${remote.url}`)
}
```

**Depois:**

```typescript
} else if (config.type === "sse" || config.type === "http") {
  const remote = config as McpSSEServerConfig | McpHttpServerConfig
  args.push("--mcp-server-sse", `${name}:${remote.url}`)
  if (remote.headers) {
    for (const [headerName, headerValue] of Object.entries(remote.headers)) {
      args.push("--mcp-server-header", `${name}:${headerName}:${headerValue}`)
    }
  }
}
```

O formato `--mcp-server-header name:Header-Name:value` segue o padrao do CLI onde o primeiro segmento identifica o server e o restante e o par header:value.

**Nota**: verificar a flag exata do OpenClaude CLI para headers de MCP servers. Se o CLI usar formato diferente (ex: `--mcp-header`), ajustar o nome da flag. O implementador deve confirmar consultando `openclaude --help` ou o codigo fonte do CLI.

---

## Criterios de Aceite

- [ ] `headers: { "Authorization": "Bearer token" }` gera flag de header correspondente
- [ ] Multiplos headers geram multiplas flags
- [ ] Sem headers: comportamento identico ao atual
- [ ] Headers sao associados ao server correto pelo nome
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` — MCP SSE/HTTP | S-055 |
| `McpSSEServerConfig.headers` | S-055 |
| `McpHttpServerConfig.headers` | S-055 |
| Discovery | D-063 |
