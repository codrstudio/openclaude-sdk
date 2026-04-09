# PRP-037 — Package & Documentation

## Objetivo

Corrigir incompatibilidade da peerDependency de Zod e documentar uso de MCP servers externos no README.

Referencia: specs S-048 (D-056), S-056 (D-064).

## Execution Mode

`implementar`

## Contexto

### Zod peerDep (S-048)

`package.json` tem `devDependencies: { "zod": "^4.3.6" }` (Zod v4) mas `peerDependencies: { "zod": ">=3.0.0" }`. O TypeScript compila contra Zod v4 — as interfaces `z.ZodRawShape` e `z.ZodObject<Schema>` mudaram entre v3 e v4. Usuarios com Zod v3 instalado enfrentam incompatibilidades de tipo ao usar `tool()` sem nenhum aviso do package manager (porque `>=3.0.0` aceita v3).

### README MCP externos (S-056)

O README tem secao "MCP Tool Factories" (servidores inline) com exemplos detalhados, mas nao tem nenhum exemplo de MCP servers externos. O campo `mcpServers` aparece na tabela de `Options` mas sem demonstracao pratica de stdio, SSE ou HTTP. Usuarios que querem integrar servidores MCP como Brave Search, databases ou APIs autenticadas nao tem referencia.

## Especificacao

### Feature F-086 — Restringir peerDep Zod para >=4.0.0

**1. Alterar `package.json` (linha 49):**

Estado atual:
```json
"peerDependencies": {
  "@modelcontextprotocol/sdk": ">=1.0.0",
  "zod": ">=3.0.0"
}
```

Novo:
```json
"peerDependencies": {
  "@modelcontextprotocol/sdk": ">=1.0.0",
  "zod": ">=4.0.0"
}
```

**2. Nenhuma outra alteracao necessaria.**

- `devDependencies.zod` permanece `^4.3.6`
- Nenhum codigo-fonte muda
- Typecheck e build devem continuar passando

### Feature F-087 — Secao External MCP Servers no README

**1. Inserir nova secao "External MCP Servers" no `README.md`, apos a secao "MCP Tool Factories" e antes da proxima secao.**

**2. Conteudo obrigatorio:**

#### Introducao

Uma frase: alem de MCP tool factories (inline), o SDK suporta conexao a servidores MCP externos via stdio, SSE e HTTP.

#### Exemplo stdio

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Search for TypeScript best practices",
  options: {
    mcpServers: {
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/brave-search-mcp"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
    },
  },
})
```

#### Exemplo SSE com headers

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "List recent deployments",
  options: {
    mcpServers: {
      "deploy-api": {
        type: "sse",
        url: "https://mcp.example.com/sse",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      },
    },
  },
})
```

#### Exemplo HTTP com header

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Query the database",
  options: {
    mcpServers: {
      "db-server": {
        type: "http",
        url: "https://mcp.example.com/mcp",
        headers: {
          "X-API-Key": process.env.DB_API_KEY!,
        },
      },
    },
  },
})
```

#### Exemplo multiplos servers combinados

```typescript
import { query, tool, createSdkMcpServer } from "openclaude-sdk"
import { z } from "zod"

// Inline SDK server
const myTools = await createSdkMcpServer({
  name: "my-tools",
  tools: [
    tool("greet", "Greet a user", { name: z.string() }, async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    })),
  ],
})

const q = query({
  prompt: "Search for news and greet the user",
  options: {
    mcpServers: {
      // External stdio server
      "brave-search": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic-ai/brave-search-mcp"],
        env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY! },
      },
      // Inline SDK server
      "my-tools": myTools,
    },
  },
})
```

#### Tabela de tipos de servidor

| Tipo | Interface | Campos | Uso |
|------|-----------|--------|-----|
| `stdio` | `McpStdioServerConfig` | `command`, `args?`, `env?` | Servidores locais via stdin/stdout |
| `sse` | `McpSSEServerConfig` | `url`, `headers?` | Servidores remotos via Server-Sent Events |
| `http` | `McpHttpServerConfig` | `url`, `headers?` | Servidores remotos via HTTP |
| `sdk` | `McpSdkServerConfig` | `name`, `instance` | Servidores inline (via `createSdkMcpServer()`) |

#### Nota sobre env em stdio

Explicar que variaveis em `env` do stdio server sao propagadas automaticamente ao processo filho. Variaveis de ambiente do processo pai (`process.env`) tambem estao disponiveis — `env` serve para adicionar ou sobrescrever.

**3. Regras:**

- Texto em portugues, codigo em ingles
- Todos os exemplos devem ser compilaveis (imports presentes, tipos corretos)
- NAO remover ou reorganizar secoes existentes do README
- Manter consistencia com o estilo das secoes existentes

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Usuario com Zod v3 instala o SDK | `npm install` sem warning | `npm install` emite peer dep warning |
| Usuario com Zod v4 instala o SDK | Sem warning | Sem warning (identico) |
| Usuario busca exemplo de MCP stdio | Nao encontra no README | Secao dedicada com exemplo |
| Usuario busca exemplo de MCP com auth header | Nao encontra no README | Exemplos SSE e HTTP com headers |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-086 | fixZodPeerDep | Alterar `peerDependencies.zod` de `>=3.0.0` para `>=4.0.0` em `package.json` |
| F-087 | readmeExternalMcpServers | Nova secao "External MCP Servers" no README com exemplos de stdio, SSE, HTTP, combinados, e tabela de tipos |

## Limites

- NAO alterar codigo em `src/` — F-086 e apenas `package.json`, F-087 e apenas `README.md`
- NAO remover ou reorganizar secoes existentes do README
- NAO adicionar exemplos que dependam de features nao implementadas (ex: headers so devem ser mostrados se PRP-034 F-080 for implementado — caso contrario, mencionar que headers serao transmitidos em versao futura)
- NAO alterar `devDependencies` — apenas `peerDependencies`

## Dependencias

F-087 (exemplos de headers) depende de PRP-034 (F-080) para que os headers sejam efetivamente transmitidos. F-086 nao tem dependencias.
