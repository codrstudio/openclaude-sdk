# PRP-024 — Query Operation Methods

## Objetivo

Implementar 6 metodos de operacao avancada no `Query` para controle de sessoes em andamento: `rewindFiles()`, `reconnectMcpServer()`, `toggleMcpServer()`, `setMcpServers()`, `streamInput()`, `stopTask()`.

Referencia: spec S-031 (D-043).

## Execution Mode

`implementar`

## Contexto

Nenhum metodo de operacao avancada existe no `Query`. Estes metodos permitem controle avancado de sessoes — reverter arquivos, gerenciar MCP servers mid-session, enviar input streaming, parar tasks.

PRP-023 (F-054) introduz a infraestrutura de `pendingRequests`, `nextRequestId()`, `sendControlRequest()` e o stream wrapper para `control_response`. Este PRP reutiliza essa infraestrutura para os metodos que requerem resposta.

## Especificacao

### Feature F-056 — Metodos fire-and-forget

Tres metodos simples que enviam comando via stdin sem esperar resposta.

**1. Atualizar interface `Query`** em `src/query.ts`:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes ...
  /** Reconecta um MCP server */
  reconnectMcpServer(serverName: string): void
  /** Habilita/desabilita um MCP server */
  toggleMcpServer(serverName: string, enabled: boolean): void
  /** Para uma task especifica */
  stopTask(taskId: string): void
}
```

**2. Implementar no bloco `Object.assign`**:

```typescript
reconnectMcpServer(serverName: string): void {
  writeStdin(JSON.stringify({
    type: "reconnect_mcp_server",
    serverName,
  }) + "\n")
},

toggleMcpServer(serverName: string, enabled: boolean): void {
  writeStdin(JSON.stringify({
    type: "toggle_mcp_server",
    serverName,
    enabled,
  }) + "\n")
},

stopTask(taskId: string): void {
  writeStdin(JSON.stringify({
    type: "stop_task",
    taskId,
  }) + "\n")
},
```

### Feature F-057 — Metodos com request/response

Dois metodos que envolvem I/O e requerem resposta via `pendingRequests` de PRP-023.

**1. Adicionar tipos em `src/types/query.ts`** (criado em PRP-023):

```typescript
export interface RewindFilesResult {
  rewound: boolean
  filesReverted?: string[]
  error?: string
}

export interface McpSetServersResult {
  success: boolean
  servers?: McpServerStatusInfo[]
  error?: string
}
```

**2. Atualizar interface `Query`**:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes ...
  /** Reverte arquivos alterados pelo agente a um ponto anterior */
  rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult>
  /** Reconfigura MCP servers mid-session */
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>
}
```

**3. Implementar** — usam timeout de 30s (mais longo que os 10s de introspeccao) porque envolvem operacoes de I/O:

```typescript
rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult> {
  const requestId = nextRequestId()
  return new Promise<RewindFilesResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error("rewindFiles timed out after 30s"))
    }, 30_000)

    pendingRequests.set(requestId, {
      resolve: (data) => { clearTimeout(timeout); resolve(data as RewindFilesResult) },
      reject: (err) => { clearTimeout(timeout); reject(err) },
    })

    writeStdin(JSON.stringify({
      type: "rewind_files",
      requestId,
      userMessageId,
      dryRun: opts?.dryRun ?? false,
    }) + "\n")
  })
},

setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult> {
  const requestId = nextRequestId()
  return new Promise<McpSetServersResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error("setMcpServers timed out after 30s"))
    }, 30_000)

    pendingRequests.set(requestId, {
      resolve: (data) => { clearTimeout(timeout); resolve(data as McpSetServersResult) },
      reject: (err) => { clearTimeout(timeout); reject(err) },
    })

    writeStdin(JSON.stringify({
      type: "set_mcp_servers",
      requestId,
      servers,
    }) + "\n")
  })
},
```

**4. Exportar novos tipos em `src/index.ts`**:

```typescript
export type {
  RewindFilesResult,
  McpSetServersResult,
} from "./types/query.js"
```

### Feature F-058 — `streamInput()` (AsyncIterable consumer)

Metodo especial que consome um `AsyncIterable<string>` e envia cada item como mensagem stdin sequencialmente.

**1. Atualizar interface `Query`**:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes ...
  /** Envia stream assincrono de input */
  streamInput(stream: AsyncIterable<string>): Promise<void>
}
```

**2. Implementar**:

```typescript
async streamInput(inputStream: AsyncIterable<string>): Promise<void> {
  for await (const chunk of inputStream) {
    writeStdin(JSON.stringify({
      type: "stream_input",
      content: chunk,
    }) + "\n")
  }
  // Sinalizar fim do stream
  writeStdin(JSON.stringify({
    type: "stream_input_end",
  }) + "\n")
},
```

O metodo e bloqueante — consome o iterable inteiro antes de resolver. O chamador pode usar um `ReadableStream` ou generator para controlar o ritmo.

### Comportamento por cenario

| Cenario | Comportamento |
|---------|--------------|
| `reconnectMcpServer("my-server")` | Envia comando, sem resposta |
| `toggleMcpServer("my-server", false)` | Desabilita server, sem resposta |
| `stopTask("task-123")` | Para task, sem resposta |
| `rewindFiles(msgId)` | Envia request, aguarda resposta com `RewindFilesResult` |
| `rewindFiles(msgId, { dryRun: true })` | Lista arquivos que seriam revertidos sem reverter |
| `rewindFiles` sem resposta em 30s | Rejeita Promise com timeout error |
| `setMcpServers(servers)` | Reconfigura servers, aguarda resposta |
| `streamInput(asyncIterable)` | Envia cada chunk, sinaliza fim |
| Qualquer metodo apos `close()` | `writeStdin` lanca erro (guard `stdinClosed`) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-056 | operationFireAndForget | `reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()` — comandos fire-and-forget via stdin |
| F-057 | operationWithResponse | `rewindFiles()`, `setMcpServers()` — request/response com timeout 30s, tipos `RewindFilesResult`, `McpSetServersResult` |
| F-058 | streamInput | `streamInput(AsyncIterable<string>)` — consumer que envia chunks sequenciais + sinaliza fim |

## Limites

- NAO reimplementar a infraestrutura de `pendingRequests`/`sendControlRequest()` — reutilizar de PRP-023 (F-054)
- NAO alterar metodos existentes do `Query`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Depende de **PRP-023** (F-054) — infraestrutura de `pendingRequests`, `nextRequestId()` e stream wrapper. Se implementado sem PRP-023, o coder deve criar essa infraestrutura primeiro.
