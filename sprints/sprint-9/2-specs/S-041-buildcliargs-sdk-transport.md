# openclaude-sdk - Fix buildCliArgs() para SDK Servers com Transporte Local

Remover throw para `type: "sdk"` em `buildCliArgs()` e implementar transporte HTTP local para conectar McpServer in-process ao CLI.

---

## Objetivo

Resolver D-051 (score 9): `buildCliArgs()` em `src/process.ts:147-150` lanca erro para `type: "sdk"`, tornando `createSdkMcpServer()` completamente inutilizavel. Qualquer query com um SDK server falha antes mesmo de spawnar o processo.

| # | Problema | Consequencia |
|---|----------|-------------|
| 1 | `throw new Error()` para `type: "sdk"` | `createSdkMcpServer()` e inutilizavel — query nao executa |
| 2 | Sem transporte entre McpServer e CLI | Mesmo sem throw, o CLI nao teria como se comunicar com o server in-process |

**Estrategia**: iniciar o McpServer com `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk` em porta aleatoria local, e passar `--mcp-server-sse <name>:http://localhost:<port>/mcp` ao CLI.

---

## Estado Atual

**Arquivo**: `src/process.ts`, linhas 145-161

```typescript
if (options.mcpServers) {
  for (const [name, config] of Object.entries(options.mcpServers)) {
    if (config.type === "sdk") {
      throw new Error(
        `MCP server "${name}" has type "sdk" which requires in-process transport (not yet supported). ` +
          `Use stdio, sse, or http transport instead.`,
      )
    } else if (!config.type || config.type === "stdio") {
      // ...
```

O throw bloqueia qualquer uso de SDK servers.

---

## Implementacao

### 1. Separar SDK servers de CLI args

`buildCliArgs()` deve ser uma funcao pura (sem side effects). Ela nao deve iniciar servers. Em vez disso, a responsabilidade de iniciar o transporte fica em `query()` (ver S-042).

**Mudanca em `buildCliArgs()`**: quando `config.type === "sdk"`, nao lancar erro. Em vez disso, assumir que o server ja foi iniciado (pelo lifecycle manager de S-042) e que `config` contem uma porta atribuida.

### 2. Adicionar campo `_localPort` ao McpSdkServerConfig (interno)

**Arquivo**: `src/types/options.ts`

Adicionar campo opcional interno para comunicacao entre lifecycle manager e buildCliArgs:

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  name: string
  instance: unknown
  /** @internal — populado pelo lifecycle manager antes de buildCliArgs() */
  _localPort?: number
}
```

### 3. Atualizar buildCliArgs() para gerar flag SSE

**Arquivo**: `src/process.ts`

**Antes:**

```typescript
if (config.type === "sdk") {
  throw new Error(
    `MCP server "${name}" has type "sdk" which requires in-process transport (not yet supported). ` +
      `Use stdio, sse, or http transport instead.`,
  )
}
```

**Depois:**

```typescript
if (config.type === "sdk") {
  const sdkConfig = config as McpSdkServerConfig
  if (!sdkConfig._localPort) {
    throw new Error(
      `MCP server "${name}" has type "sdk" but no local transport was started. ` +
        `Ensure the server was started via the lifecycle manager before building CLI args.`,
    )
  }
  args.push("--mcp-server-sse", `${name}:http://localhost:${sdkConfig._localPort}/mcp`)
}
```

### 4. Funcao utilitaria: startSdkServerTransport()

**Arquivo**: `src/mcp.ts` (adicionar)

```typescript
export async function startSdkServerTransport(
  config: McpSdkServerConfig,
): Promise<{ port: number; close: () => Promise<void> }>
```

Implementacao:

1. Importar `StreamableHTTPServerTransport` de `@modelcontextprotocol/sdk/server/streamableHttp.js`
2. Criar HTTP server Node.js (`http.createServer`) na porta 0 (atribuicao aleatoria pelo OS)
3. Conectar o `McpServer` (`config.instance`) ao transport via `server.connect(transport)`
4. Retornar a porta atribuida e uma funcao `close()` que encerra o HTTP server e desconecta o transport

```typescript
import http from "node:http"

export async function startSdkServerTransport(
  config: McpSdkServerConfig,
): Promise<{ port: number; close: () => Promise<void> }> {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  )

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/mcp") {
      await transport.handleRequest(req, res)
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve())
  })

  const addr = httpServer.address()
  const port = typeof addr === "object" && addr ? addr.port : 0

  const mcpServer = config.instance as { connect: (t: unknown) => Promise<void> }
  await mcpServer.connect(transport)

  return {
    port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
```

**Nota**: a assinatura exata de `StreamableHTTPServerTransport` e `handleRequest` deve ser verificada contra a versao do `@modelcontextprotocol/sdk` em uso. A implementacao acima e baseada na API v1.x documentada. Se `StreamableHTTPServerTransport` nao estiver disponivel, usar `SSEServerTransport` como fallback.

### 5. Exportar em `src/index.ts`

```typescript
export { startSdkServerTransport } from "./mcp.js"
```

---

## Fluxo Completo

```
1. Usuario cria server:     const server = await createSdkMcpServer({ name: "x", tools: [...] })
2. Lifecycle manager (S-042) inicia transporte:  const { port, close } = await startSdkServerTransport(server)
3. Lifecycle manager seta:   server._localPort = port
4. buildCliArgs() gera:      --mcp-server-sse x:http://localhost:PORT/mcp
5. CLI conecta ao server via HTTP local
6. Apos query terminar:      await close()
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/options.ts` | Adicionar `_localPort?: number` a `McpSdkServerConfig` |
| `src/process.ts` | Substituir throw por geracao de flag `--mcp-server-sse` usando `_localPort` |
| `src/mcp.ts` | Adicionar `startSdkServerTransport()` |
| `src/index.ts` | Exportar `startSdkServerTransport` |

---

## Criterios de Aceite

- [ ] `buildCliArgs()` nao lanca erro para `type: "sdk"` quando `_localPort` esta presente
- [ ] `buildCliArgs()` gera `--mcp-server-sse <name>:http://localhost:<port>/mcp` para SDK servers
- [ ] `buildCliArgs()` lanca erro explicito quando `_localPort` esta ausente (server nao foi iniciado)
- [ ] `startSdkServerTransport()` inicia HTTP server em porta aleatoria e conecta o McpServer
- [ ] `startSdkServerTransport()` retorna `{ port, close }` para lifecycle management
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` SDK server handling | S-041 |
| `startSdkServerTransport()` | S-041 |
| `McpSdkServerConfig._localPort` | S-041 |
| Discovery | D-051 |
| Pre-requisitos | S-038 (name), S-039 (async), S-040 (tool signature) |
| Dependente | S-042 (lifecycle management) |
