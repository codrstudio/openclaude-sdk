# openclaude-sdk - Metodos de Introspeccao no Query

Implementar 6 metodos de introspeccao no `Query` para debugging e construcao de UIs dinamicas.

---

## Objetivo

Resolver D-042 (score 5): faltam metodos que permitem consultar o estado interno da sessao em andamento — modelos disponiveis, MCP servers conectados, agentes configurados, etc. Necessarios para debugging e para UIs que exibem capacidades dinamicamente.

| Metodo | Caso de uso |
|--------|-------------|
| `initializationResult()` | Obter resultado de init (tools, agents, MCP disponivel) |
| `supportedCommands()` | Listar slash commands disponiveis |
| `supportedModels()` | Listar modelos disponiveis para `setModel()` |
| `supportedAgents()` | Listar agentes configurados |
| `mcpServerStatus()` | Diagnostico de MCP servers (conectado, erro, pendente) |
| `accountInfo()` | Info da conta (plano, limites) |

Referencia: `backlog/07-query-methods/TASK.md`.

---

## Estado Atual

Nenhum metodo de introspeccao existe no `Query`. A unica forma de obter essas informacoes e parsear mensagens do stream manualmente.

---

## Tipos Novos

Adicionar em `src/types/query.ts` (novo arquivo):

```typescript
export interface SlashCommand {
  name: string
  description?: string
}

export interface ModelInfo {
  id: string
  name?: string
  provider?: string
}

export interface AgentInfo {
  name: string
  description: string
  model?: string
}

export interface McpServerStatusInfo {
  name: string
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled"
  serverInfo?: { name: string; version: string }
  error?: string
  tools?: Array<{ name: string; description?: string }>
}

export interface AccountInfo {
  email?: string
  plan?: string
  hasApiKey?: boolean
}

export interface InitializationResult {
  tools?: string[]
  agents?: AgentInfo[]
  mcpServers?: McpServerStatusInfo[]
  model?: string
  permissionMode?: string
}
```

---

## Protocolo de Controle via stdin

Diferente dos metodos de configuracao (fire-and-forget), os metodos de introspeccao **requerem resposta**. O padrao e:

1. Enviar comando com `requestId` unico via stdin
2. Aguardar mensagem no stream com `responseId` correspondente

```json
// Request (stdin)
{ "type": "get_supported_models", "requestId": "req_abc123" }

// Response (stdout, no stream de mensagens)
{ "type": "control_response", "responseId": "req_abc123", "data": [...] }
```

### Mecanismo de correlacao request/response

Implementar um `PendingRequests` map interno ao `query()`:

```typescript
const pendingRequests = new Map<string, {
  resolve: (data: unknown) => void
  reject: (error: Error) => void
}>()

let requestCounter = 0
function nextRequestId(): string {
  return `req_${++requestCounter}_${Date.now()}`
}
```

No stream, interceptar mensagens `type: "control_response"` e resolver a Promise correspondente:

```typescript
// Dentro do async generator wrapper
if (msg.type === "control_response" && msg.responseId) {
  const pending = pendingRequests.get(msg.responseId)
  if (pending) {
    pendingRequests.delete(msg.responseId)
    pending.resolve(msg.data)
  }
  continue // nao propagar para o consumidor
}
```

### Comandos de introspeccao

| Metodo | Comando stdin | Campo de resposta |
|--------|--------------|-------------------|
| `initializationResult()` | `{ "type": "get_initialization_result" }` | `InitializationResult` |
| `supportedCommands()` | `{ "type": "get_supported_commands" }` | `SlashCommand[]` |
| `supportedModels()` | `{ "type": "get_supported_models" }` | `ModelInfo[]` |
| `supportedAgents()` | `{ "type": "get_supported_agents" }` | `AgentInfo[]` |
| `mcpServerStatus()` | `{ "type": "get_mcp_server_status" }` | `McpServerStatusInfo[]` |
| `accountInfo()` | `{ "type": "get_account_info" }` | `AccountInfo` |

---

## Implementacao

### 1. Atualizar interface `Query`

Adicionar os 6 metodos a interface em `src/query.ts`:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes ...
  /** Resultado da inicializacao (tools, agents, MCP) */
  initializationResult(): Promise<InitializationResult>
  /** Slash commands disponiveis */
  supportedCommands(): Promise<SlashCommand[]>
  /** Modelos disponiveis */
  supportedModels(): Promise<ModelInfo[]>
  /** Agentes configurados */
  supportedAgents(): Promise<AgentInfo[]>
  /** Status dos MCP servers */
  mcpServerStatus(): Promise<McpServerStatusInfo[]>
  /** Info da conta */
  accountInfo(): Promise<AccountInfo>
}
```

### 2. Helper `sendControlRequest()`

Funcao interna ao closure de `query()` para enviar request e aguardar response:

```typescript
function sendControlRequest<T>(commandType: string): Promise<T> {
  const requestId = nextRequestId()
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Control request '${commandType}' timed out after 10s`))
    }, 10_000)

    pendingRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timeout)
        resolve(data as T)
      },
      reject: (err) => {
        clearTimeout(timeout)
        reject(err)
      },
    })

    writeStdin(JSON.stringify({ type: commandType, requestId }) + "\n")
  })
}
```

### 3. Implementar os metodos

No bloco `Object.assign(stream, { ... })`:

```typescript
initializationResult(): Promise<InitializationResult> {
  return sendControlRequest("get_initialization_result")
},
supportedCommands(): Promise<SlashCommand[]> {
  return sendControlRequest("get_supported_commands")
},
supportedModels(): Promise<ModelInfo[]> {
  return sendControlRequest("get_supported_models")
},
supportedAgents(): Promise<AgentInfo[]> {
  return sendControlRequest("get_supported_agents")
},
mcpServerStatus(): Promise<McpServerStatusInfo[]> {
  return sendControlRequest("get_mcp_server_status")
},
accountInfo(): Promise<AccountInfo> {
  return sendControlRequest("get_account_info")
},
```

### 4. Stream wrapper para interceptar control_response

O `spawnAndStream()` retorna um `AsyncGenerator`. Precisamos wrappa-lo para interceptar `control_response` antes de propagar ao consumidor. Isso pode ser feito com um generator wrapper:

```typescript
async function* wrapStream(
  source: AsyncGenerator<SDKMessage>,
  pendingRequests: Map<string, { resolve: (data: unknown) => void }>,
): AsyncGenerator<SDKMessage, void> {
  for await (const msg of source) {
    const obj = msg as Record<string, unknown>
    if (obj.type === "control_response" && typeof obj.responseId === "string") {
      const pending = pendingRequests.get(obj.responseId)
      if (pending) {
        pendingRequests.delete(obj.responseId)
        pending.resolve(obj.data)
      }
      continue
    }
    yield msg
  }
}
```

**Nota**: Esta abordagem requer que o wrapper seja aplicado ao stream ANTES de decorar com `Object.assign`. O stream base de `spawnAndStream()` e wrappado, e o resultado decorado e o `Query`.

---

## Investigacao Necessaria

Antes de implementar, o coder agent deve verificar no source do OpenClaude CLI:

1. O formato exato dos comandos de controle (nomes dos tipos)
2. Se `requestId`/`responseId` e o mecanismo correto de correlacao
3. Se ha timeout default no CLI para responder

Se o CLI nao suportar o protocolo request/response, a alternativa e capturar mensagens `system` especificas do stream que contenham as informacoes (abordagem passiva em vez de ativa).

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/query.ts` | Novo — tipos de introspeccao |
| `src/query.ts` | Adicionar 6 metodos a interface `Query`, `sendControlRequest()`, stream wrapper, `pendingRequests` map |
| `src/index.ts` | Exportar novos tipos |

---

## Criterios de Aceite

- [ ] 6 metodos de introspeccao adicionados a interface `Query`
- [ ] Cada metodo retorna `Promise<T>` com tipo especifico
- [ ] Mecanismo de correlacao request/response implementado (ou alternativa documentada se CLI nao suportar)
- [ ] Timeout de 10s para requests sem resposta
- [ ] Mensagens `control_response` interceptadas e nao propagadas ao consumidor
- [ ] Tipos `SlashCommand`, `ModelInfo`, `AgentInfo`, `McpServerStatusInfo`, `AccountInfo`, `InitializationResult` exportados
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `initializationResult()` | S-030 |
| `supportedCommands()` | S-030 |
| `supportedModels()` | S-030 |
| `supportedAgents()` | S-030 |
| `mcpServerStatus()` | S-030 |
| `accountInfo()` | S-030 |
| Stream wrapper para control_response | S-030 |
| Discovery | D-042 |
| Referencia | `backlog/07-query-methods/TASK.md` |
