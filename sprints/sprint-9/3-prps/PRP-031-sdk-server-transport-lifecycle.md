# PRP-031 — SDK Server Transport & Lifecycle

## Objetivo

Implementar transporte HTTP local para MCP servers in-process e lifecycle automatico (start/stop) dentro de `query()`, tornando `createSdkMcpServer()` funcional end-to-end.

Referencia: specs S-041 (D-051), S-042 (D-055).

## Execution Mode

`implementar`

## Contexto

Apos PRP-030, `createSdkMcpServer()` cria um `McpServer` valido, mas `buildCliArgs()` em `src/process.ts:147` lanca erro para `type: "sdk"` — o CLI nao recebe o MCP server. Falta:

1. Um transporte HTTP local que exponha o `McpServer` numa porta para o CLI conectar
2. Logica em `buildCliArgs()` para gerar `--mcp-server-sse <name>:http://localhost:<port>/mcp`
3. Lifecycle automatico em `query()`: iniciar servers antes do spawn, encerrar apos query terminar

O fluxo completo:
```
createSdkMcpServer() → startSdkServerTransport() → _localPort atribuida → 
buildCliArgs() gera --mcp-server-sse → CLI conecta via HTTP → query termina → stopSdkServers()
```

## Especificacao

### Feature F-070 — Transporte HTTP local e `buildCliArgs()`

**1. Adicionar campo opcional `_localPort` a `McpSdkServerConfig` em `src/types/options.ts`:**

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  name: string
  instance: unknown
  /** @internal — Porta local atribuida pelo lifecycle manager */
  _localPort?: number
}
```

Campo interno, nao documentado na API publica. Usado para comunicacao entre lifecycle manager e `buildCliArgs()`.

**2. Criar funcao `startSdkServerTransport()` em `src/mcp.ts`:**

```typescript
export async function startSdkServerTransport(
  config: McpSdkServerConfig,
): Promise<{ port: number; close: () => Promise<void> }>
```

Implementacao:
- Importar `StreamableHTTPServerTransport` de `@modelcontextprotocol/sdk/server/streamableHttp.js` via `await import()`
- Criar instancia de `StreamableHTTPServerTransport`
- Criar HTTP server Node.js (`http.createServer`) que roteia requests para o transport
- Bind em porta 0 (OS atribui porta aleatoria)
- Conectar o `McpServer` (extraido de `config.instance`) ao transport via `server.connect(transport)`
- Retornar `{ port: server.address().port, close: async () => { ... } }`
- A funcao `close()` deve: fechar o transport, fechar o HTTP server, aguardar connections drenarem

**3. Atualizar `buildCliArgs()` em `src/process.ts`:**

Substituir o bloco de throw (linhas 147-151):

Estado atual:
```typescript
if (config.type === "sdk") {
  throw new Error(
    "SDK MCP servers cannot be passed as CLI arguments. Use startSdkServerTransport() to start a local transport first.",
  )
}
```

Novo:
```typescript
if (config.type === "sdk") {
  if (config._localPort == null) {
    throw new Error(
      `SDK MCP server "${config.name}" has no local transport. Call startSdkServerTransport() before spawning the CLI.`,
    )
  }
  args.push("--mcp-server-sse", `${config.name}:http://localhost:${config._localPort}/mcp`)
  continue
}
```

Quando `_localPort` esta presente, gera flag SSE apontando para o transporte local. Quando ausente, lanca erro explicito (guard contra uso incorreto).

**4. Exportar `startSdkServerTransport` em `src/index.ts`.**

### Feature F-071 — Lifecycle automatico em `query()`

**1. Funcao auxiliar `startSdkServers()` em `src/query.ts`:**

```typescript
import { startSdkServerTransport } from "./mcp.js"

interface RunningServer {
  name: string
  close: () => Promise<void>
}

async function startSdkServers(
  mcpServers: Record<string, McpServerConfig>,
): Promise<RunningServer[]> {
  const running: RunningServer[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.type !== "sdk") continue

    const { port, close } = await startSdkServerTransport(config)
    config._localPort = port
    running.push({ name, close })
  }

  return running
}
```

Para cada server SDK:
- Chama `startSdkServerTransport()` para iniciar HTTP server local
- Atribui `_localPort` ao config (mutacao intencional — sera lido por `buildCliArgs()`)
- Armazena referencia para cleanup

**2. Funcao auxiliar `stopSdkServers()` em `src/query.ts`:**

```typescript
async function stopSdkServers(servers: RunningServer[]): Promise<void> {
  const results = await Promise.allSettled(
    servers.map((s) => s.close()),
  )
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[openclaude-sdk] Failed to stop SDK server:", result.reason)
    }
  }
}
```

Usa `Promise.allSettled` para garantir que todos os servers sao encerrados mesmo se algum falhar. Erros sao logados mas nao propagados.

**3. Integrar no `query()` — abordagem lazy lifecycle:**

A assinatura publica de `query()` DEVE continuar sincrona (retorna `Query`, nao `Promise<Query>`). O lifecycle executa dentro do async generator.

Reestruturar internals de `query()`:
- Extrair refs mutaveis para `writeStdin` e `closeProc` (permitem acesso antes do spawn)
- Criar async generator wrapper que:
  1. Inicia SDK servers (`startSdkServers()`) no primeiro `next()` do generator
  2. Spawna o processo CLI normalmente
  3. Propaga mensagens do stream
  4. No `finally`, encerra SDK servers (`stopSdkServers()`)
- `close()` do Query deve tambem garantir cleanup dos SDK servers

Pseudocodigo:
```typescript
function query(params: QueryParams): Query {
  let runningServers: RunningServer[] = []
  let writeStdinRef: ((data: string) => void) | null = null
  let closeProcRef: (() => Promise<void>) | null = null

  async function* lifecycleGenerator(): AsyncGenerator<SDKMessage, void> {
    try {
      // Start SDK servers before spawn
      if (params.options?.mcpServers) {
        runningServers = await startSdkServers(params.options.mcpServers)
      }

      // Spawn CLI process (existing logic)
      const innerStream = spawnAndStream(/* ... */)
      writeStdinRef = innerStream.writeStdin
      closeProcRef = innerStream.close

      // Propagate messages
      yield* innerStream

    } finally {
      await stopSdkServers(runningServers)
    }
  }

  const stream = lifecycleGenerator()

  return Object.assign(stream, {
    close: async () => {
      if (closeProcRef) await closeProcRef()
      await stopSdkServers(runningServers)
    },
    // ... outros metodos usam writeStdinRef ...
  })
}
```

**Decisao de design**: mutacao de `config._localPort` e intencional — o lifecycle manager "prepara" os configs antes de `buildCliArgs()` consumir. Alternativa seria retornar novos configs, mas aumentaria complexidade sem beneficio.

### Comportamento por cenario

| Cenario | Comportamento |
|---------|--------------|
| `query()` com SDK servers em `mcpServers` | Servers iniciados automaticamente antes do spawn |
| `query()` sem SDK servers | Nenhum overhead — lifecycle nao executa |
| Query completa normalmente | SDK servers encerrados no `finally` |
| Query falha com erro | SDK servers encerrados no `finally` |
| `close()` chamado mid-stream | SDK servers encerrados apos processo morrer |
| `close()` chamado antes de consumir stream | SDK servers iniciados e encerrados (lazy init no primeiro `next()`) |
| Erro ao iniciar SDK server | Erro propagado ao consumidor, servers ja iniciados sao encerrados |
| Erro ao encerrar SDK server | Logado via `console.error`, nao propagado |
| `buildCliArgs()` com `_localPort` presente | Gera `--mcp-server-sse name:http://localhost:PORT/mcp` |
| `buildCliArgs()` com `_localPort` ausente | Lanca erro explicito |
| Multiplos SDK servers | Cada um recebe porta aleatoria independente |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-070 | sdkServerTransport | `startSdkServerTransport()` com HTTP server local + `buildCliArgs()` gera `--mcp-server-sse` para SDK servers |
| F-071 | sdkServerLifecycle | `startSdkServers()`/`stopSdkServers()` helpers + integracao lazy no `query()` com cleanup garantido |

## Limites

- NAO alterar a assinatura publica de `query()` — continua sincrono, retorna `Query`
- NAO alterar `tool()` ou `createSdkMcpServer()` — ja corrigidos em PRP-030
- NAO alterar tratamento de MCP servers tipo `stdio`, `sse`, `http` — apenas `sdk`
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO expor `startSdkServers()`, `stopSdkServers()` ou `RunningServer` — sao internals de `query()`
- NAO usar pooling de portas ou cache de servers — cada `query()` inicia/encerra seus proprios servers

## Dependencias

Depende de PRP-030 (F-067 `name`, F-068 async, F-069 tool signature). PRP-032 (docs) depende deste PRP para documentar a API corrigida.
