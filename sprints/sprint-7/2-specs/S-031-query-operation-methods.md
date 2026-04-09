# openclaude-sdk - Metodos de Operacao Avancada no Query

Implementar 6 metodos de operacao avancada no `Query` para controle de sessoes em andamento.

---

## Objetivo

Resolver D-043 (score 5): faltam metodos de operacao que permitem controle avancado de sessoes — reverter arquivos, reconectar MCP servers, enviar input streaming, parar tasks. Necessarios para automacoes complexas e paridade com o SDK oficial.

| Metodo | Caso de uso |
|--------|-------------|
| `rewindFiles(userMessageId, opts?)` | Reverter arquivos a um ponto anterior (undo de alteracoes do agente) |
| `reconnectMcpServer(serverName)` | Reconectar MCP server que perdeu conexao |
| `toggleMcpServer(serverName, enabled)` | Habilitar/desabilitar MCP server sem reconectar |
| `setMcpServers(servers)` | Reconfigurar conjunto de MCP servers mid-session |
| `streamInput(stream)` | Enviar stream assincrono de input ao agente |
| `stopTask(taskId)` | Parar task especifica em execucao |

Referencia: `backlog/07-query-methods/TASK.md`.

---

## Estado Atual

Nenhum metodo de operacao avancada existe no `Query`. Dependencia: S-030 introduz o mecanismo de request/response via `sendControlRequest()` e o stream wrapper — S-031 reutiliza essa infraestrutura.

---

## Tipos Novos

Adicionar ao `src/types/query.ts` (criado em S-030):

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

---

## Implementacao

### 1. Atualizar interface `Query`

Adicionar os 6 metodos em `src/query.ts`:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes (S-029, S-030) ...
  /** Reverte arquivos alterados pelo agente a um ponto anterior */
  rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult>
  /** Reconecta um MCP server */
  reconnectMcpServer(serverName: string): void
  /** Habilita/desabilita um MCP server */
  toggleMcpServer(serverName: string, enabled: boolean): void
  /** Reconfigura MCP servers mid-session */
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>
  /** Envia stream assincrono de input */
  streamInput(stream: AsyncIterable<string>): Promise<void>
  /** Para uma task especifica */
  stopTask(taskId: string): void
}
```

### 2. Implementar os metodos

#### Metodos fire-and-forget (sem resposta)

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

#### Metodos com resposta (via sendControlRequest de S-030)

```typescript
rewindFiles(userMessageId: string, opts?: { dryRun?: boolean }): Promise<RewindFilesResult> {
  const requestId = nextRequestId()
  return new Promise<RewindFilesResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error("rewindFiles timed out after 30s"))
    }, 30_000)  // timeout maior — operacao de filesystem

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

**Nota**: `rewindFiles` e `setMcpServers` usam timeout de 30s (mais longo que os 10s de introspeccao) porque envolvem operacoes de I/O.

#### `streamInput()` — caso especial

`streamInput()` consome um `AsyncIterable<string>` e envia cada item como mensagem stdin sequencialmente:

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

**Nota**: Este metodo e bloqueante — consome o iterable inteiro antes de resolver. O chamador pode usar um `ReadableStream` ou generator para controlar o ritmo.

---

## Dependencia de S-030

S-031 depende da infraestrutura introduzida em S-030:

| Componente de S-030 | Uso em S-031 |
|---------------------|-------------|
| `pendingRequests` Map | `rewindFiles()` e `setMcpServers()` registram promises |
| `nextRequestId()` | Gera IDs unicos para requests |
| Stream wrapper | Intercepta `control_response` para requests de S-031 |

Se S-031 for implementado sem S-030, o coder deve criar essa infraestrutura primeiro.

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/query.ts` | Adicionar `RewindFilesResult`, `McpSetServersResult` |
| `src/query.ts` | Adicionar 6 metodos a interface `Query` e implementacao |
| `src/index.ts` | Exportar novos tipos |

---

## Criterios de Aceite

- [ ] `rewindFiles()` envia request com `userMessageId` e `dryRun`, retorna `RewindFilesResult`
- [ ] `reconnectMcpServer()` envia comando fire-and-forget
- [ ] `toggleMcpServer()` envia comando fire-and-forget com `enabled` boolean
- [ ] `setMcpServers()` envia request com mapa de servers, retorna `McpSetServersResult`
- [ ] `streamInput()` consome `AsyncIterable` e envia cada chunk via stdin, sinaliza fim
- [ ] `stopTask()` envia comando fire-and-forget com `taskId`
- [ ] Timeout de 30s para `rewindFiles()` e `setMcpServers()`
- [ ] Reutiliza `pendingRequests` e `nextRequestId()` de S-030
- [ ] Tipos `RewindFilesResult` e `McpSetServersResult` exportados
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `rewindFiles()` | S-031 |
| `reconnectMcpServer()` | S-031 |
| `toggleMcpServer()` | S-031 |
| `setMcpServers()` | S-031 |
| `streamInput()` | S-031 |
| `stopTask()` | S-031 |
| Discovery | D-043 |
| Dependencia | S-030 (infraestrutura request/response) |
| Referencia | `backlog/07-query-methods/TASK.md` |
