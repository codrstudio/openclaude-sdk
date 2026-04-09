# openclaude-sdk - Lifecycle Management de SDK MCP Servers em query()

Implementar start/stop automatico de MCP servers `type: "sdk"` no ciclo de vida da query.

---

## Objetivo

Resolver D-055 (score 8): se D-051 (transporte local) for implementado, e necessario iniciar os servers antes de spawnar o CLI e encerra-los apos a query terminar. Sem lifecycle correto, servers vazam portas abertas apos cada query.

| # | Gap | Consequencia |
|---|-----|--------------|
| 1 | Servers SDK nao sao iniciados antes do spawn | CLI nao consegue conectar ao MCP server |
| 2 | Servers SDK nao sao encerrados apos query | Portas abertas acumulam, memory leak, file descriptor leak |
| 3 | Erro durante query nao limpa servers | Crash parcial deixa processos orfaos |

---

## Estado Atual

**Arquivo**: `src/query.ts`, linhas 79-120

A funcao `query()` monta `resolvedOptions`, resolve executable, chama `buildCliArgs()` e `spawnAndStream()`. Nao ha nenhuma logica de lifecycle para servers SDK.

O `buildCliArgs()` (apos S-041) espera que `McpSdkServerConfig._localPort` esteja populado. Sem o lifecycle manager, esse campo e `undefined` e `buildCliArgs()` lanca erro.

---

## Implementacao

### 1. Funcao auxiliar: startSdkServers()

**Arquivo**: `src/query.ts` (funcao privada no modulo)

```typescript
import { startSdkServerTransport } from "./mcp.js"
import type { McpSdkServerConfig, McpServerConfig } from "./types/options.js"

interface RunningServer {
  name: string
  port: number
  close: () => Promise<void>
}

async function startSdkServers(
  mcpServers: Record<string, McpServerConfig>,
): Promise<RunningServer[]> {
  const running: RunningServer[] = []

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.type === "sdk") {
      const sdkConfig = config as McpSdkServerConfig
      const { port, close } = await startSdkServerTransport(sdkConfig)
      sdkConfig._localPort = port
      running.push({ name, port, close })
    }
  }

  return running
}
```

### 2. Funcao auxiliar: stopSdkServers()

```typescript
async function stopSdkServers(servers: RunningServer[]): Promise<void> {
  const results = await Promise.allSettled(
    servers.map((s) => s.close()),
  )
  for (const r of results) {
    if (r.status === "rejected") {
      // Log silencioso — nao propagar erro de cleanup
      console.error("[openclaude-sdk] Failed to stop SDK server:", r.reason)
    }
  }
}
```

### 3. Integrar no query()

**Arquivo**: `src/query.ts`, funcao `query()`

A integracao requer que `query()` se torne parcialmente async para iniciar os servers antes do spawn. Ha duas abordagens:

#### Abordagem A: query() sincrono, lifecycle lazy

Manter `query()` sincrono (retorna `Query` diretamente). O lifecycle executa dentro do async generator:

```typescript
export function query(params: { ... }): Query {
  // ... resolvedOptions ...

  async function* lifecycleStream(): AsyncGenerator<SDKMessage, void> {
    const sdkServers = resolvedOptions.mcpServers
      ? await startSdkServers(resolvedOptions.mcpServers)
      : []

    try {
      const { command, prependArgs } = resolveExecutable(resolvedOptions)
      const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
      // ... spawnAndStream, wrapStream ...
      yield* wrappedStream
    } finally {
      await stopSdkServers(sdkServers)
    }
  }

  // Decorar lifecycleStream() com metodos extras
  // ...
}
```

**Vantagem**: nao quebra a assinatura publica de `query()`.
**Desvantagem**: o start dos servers acontece no primeiro `next()` do generator, nao no momento do `query()`. Isso e aceitavel porque o caller precisa iterar para consumir mensagens.

#### Abordagem B: query() async (breaking change)

Tornar `query()` async e retornar `Promise<Query>`. **NAO recomendado** — quebra todos os consumidores existentes.

**Decisao**: usar **Abordagem A** (lifecycle lazy dentro do generator).

### 4. Garantir cleanup em close() e interrupt()

O `finally` do generator garante cleanup quando o stream e consumido ate o fim ou quando `return()` e chamado. Os metodos `close()` e `interrupt()` do Query chamam `closeProc()` / `abortController.abort()`, que encerram o spawn. O generator's `finally` block executa em seguida.

Para garantir que `close()` tambem aguarde o cleanup dos servers:

```typescript
async close(): Promise<void> {
  await closeProc()
  // O finally do generator ja cuida do stopSdkServers
}
```

### 5. Reestruturar query() internals

A reestruturacao move `spawnAndStream()` para dentro do async generator. Os metodos `writeStdin`, `closeProc` precisam ser acessiveis fora do generator. Usar refs mutaveis:

```typescript
let writeStdinRef: ((data: string) => void) | null = null
let closeProcRef: (() => Promise<void>) | null = null

async function* lifecycleStream(): AsyncGenerator<SDKMessage, void> {
  const sdkServers = resolvedOptions.mcpServers
    ? await startSdkServers(resolvedOptions.mcpServers)
    : []

  try {
    const { command, prependArgs } = resolveExecutable(resolvedOptions)
    const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
    const { stream, writeStdin, close } = spawnAndStream(command, args, prompt, { ... })
    writeStdinRef = writeStdin
    closeProcRef = close

    yield* wrapStream(stream, pendingRequests)
  } finally {
    await stopSdkServers(sdkServers)
  }
}
```

Os metodos do Query usam `writeStdinRef` e `closeProcRef` com guard:

```typescript
respondToPermission(response: PermissionResponse): void {
  if (!writeStdinRef) throw new Error("Query not started yet")
  // ...
  writeStdinRef(payload + "\n")
},
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/query.ts` | Adicionar `startSdkServers()`, `stopSdkServers()`, reestruturar `query()` com lifecycle generator |
| `src/mcp.ts` | Nenhuma (usa `startSdkServerTransport()` de S-041) |

---

## Criterios de Aceite

- [ ] SDK servers sao iniciados automaticamente antes do spawn do CLI
- [ ] SDK servers sao encerrados automaticamente apos query terminar (sucesso ou erro)
- [ ] `_localPort` e populado antes de `buildCliArgs()` ser chamado
- [ ] Assinatura publica de `query()` nao muda (continua sincrono, retorna `Query`)
- [ ] `close()` garante cleanup dos SDK servers
- [ ] Erros de cleanup sao logados mas nao propagados
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `startSdkServers()` | S-042 |
| `stopSdkServers()` | S-042 |
| Lifecycle generator em `query()` | S-042 |
| Discovery | D-055 |
| Pre-requisitos | S-038 (name), S-041 (transport) |
