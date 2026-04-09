# PRP-023 — Query Config & Introspection Methods

## Objetivo

Implementar 3 metodos de configuracao mid-session (`setModel`, `setPermissionMode`, `setMaxThinkingTokens`) e 6 metodos de introspeccao (`initializationResult`, `supportedCommands`, `supportedModels`, `supportedAgents`, `mcpServerStatus`, `accountInfo`) no objeto `Query`, incluindo a infraestrutura de request/response via stdin.

Referencia: specs S-029 (D-041) e S-030 (D-042).

## Execution Mode

`implementar`

## Contexto

O `Query` retornado por `query()` expoe apenas `interrupt()`, `close()` e `respondToPermission()`. Faltam metodos para ajustar configuracao mid-session e para consultar estado interno da sessao.

Os metodos de configuracao sao fire-and-forget (enviam JSON via stdin, sem resposta). Os metodos de introspeccao requerem correlacao request/response com `requestId`/`responseId` e interceptacao no stream.

`respondToPermission()` ja demonstra o padrao de comunicacao via `writeStdin()` com JSON + `\n`.

## Especificacao

### Feature F-053 — Metodos de configuracao mid-session

**1. Atualizar interface `Query`** em `src/query.ts`:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes ...
  /** Troca o modelo durante a sessao */
  setModel(model?: string): void
  /** Muda o modo de permissao durante a sessao */
  setPermissionMode(mode: PermissionMode): void
  /** Ajusta o budget de thinking tokens */
  setMaxThinkingTokens(tokens: number | null): void
}
```

**2. Implementar no bloco `Object.assign(stream, { ... })`**:

```typescript
setModel(model?: string): void {
  const payload = JSON.stringify({ type: "set_model", model: model ?? null })
  writeStdin(payload + "\n")
},

setPermissionMode(mode: PermissionMode): void {
  const payload = JSON.stringify({ type: "set_permission_mode", permissionMode: mode })
  writeStdin(payload + "\n")
},

setMaxThinkingTokens(tokens: number | null): void {
  const payload = JSON.stringify({ type: "set_max_thinking_tokens", maxThinkingTokens: tokens })
  writeStdin(payload + "\n")
},
```

Todos sao fire-and-forget — efeito aplicado ao proximo turno do agente.

**3. Import de `PermissionMode`** — verificar se ja esta importado em `query.ts`. Se nao, adicionar:

```typescript
import type { SDKMessage, SDKSystemMessage, PermissionMode } from "./types/messages.js"
```

### Feature F-054 — Infraestrutura de request/response e stream wrapper

Pre-requisito dos metodos de introspeccao. Introduz o mecanismo de correlacao request/response.

**1. Adicionar `pendingRequests` map e `nextRequestId()`** dentro do closure de `query()`:

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

**2. Implementar `sendControlRequest()`** — envia request e aguarda response com timeout:

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

**3. Implementar stream wrapper** — intercepta `control_response` antes de propagar ao consumidor:

```typescript
async function* wrapStream(
  source: AsyncGenerator<SDKMessage>,
  pending: Map<string, { resolve: (data: unknown) => void }>,
): AsyncGenerator<SDKMessage, void> {
  for await (const msg of source) {
    const obj = msg as Record<string, unknown>
    if (obj.type === "control_response" && typeof obj.responseId === "string") {
      const entry = pending.get(obj.responseId)
      if (entry) {
        pending.delete(obj.responseId)
        entry.resolve(obj.data)
      }
      continue
    }
    yield msg
  }
}
```

**4. Aplicar wrapper ao stream** ANTES do `Object.assign` — o stream base de `spawnAndStream()` e wrappado, e o resultado decorado e o `Query`.

### Feature F-055 — Metodos de introspeccao e tipos

**1. Criar `src/types/query.ts`** com os tipos de introspeccao:

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

**2. Atualizar interface `Query`** com os 6 metodos:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  // ... existentes + F-053 ...
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

**3. Implementar no bloco `Object.assign`**:

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

**4. Exportar tipos em `src/index.ts`**:

```typescript
export type {
  SlashCommand,
  ModelInfo,
  AgentInfo,
  McpServerStatusInfo,
  AccountInfo,
  InitializationResult,
} from "./types/query.js"
```

### Investigacao necessaria

Antes de implementar F-054/F-055, o coder agent deve verificar no source do OpenClaude CLI:

1. O formato exato dos comandos de controle (nomes dos tipos)
2. Se `requestId`/`responseId` e o mecanismo correto de correlacao
3. Se ha timeout default no CLI para responder

Se o CLI nao suportar o protocolo request/response, a alternativa e capturar mensagens `system` especificas do stream (abordagem passiva).

### Comportamento por cenario

| Cenario | Comportamento |
|---------|--------------|
| `setModel("opus")` durante query ativa | Modelo muda para proximo turno |
| `setModel()` sem argumento | Reseta para modelo default |
| `setPermissionMode("plan")` | Proxima tool use pedira confirmacao |
| `setMaxThinkingTokens(8192)` | Budget de thinking ajustado |
| `setMaxThinkingTokens(null)` | Thinking desabilitado |
| Metodo config chamado apos `close()` | `writeStdin` lanca erro (guard `stdinClosed`) |
| `supportedModels()` com resposta | Resolve Promise com `ModelInfo[]` |
| Introspeccao sem resposta em 10s | Rejeita Promise com timeout error |
| `control_response` no stream | Interceptada, nao propagada ao consumidor |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-053 | queryConfigMethods | `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` — fire-and-forget via stdin JSON |
| F-054 | controlRequestInfra | `pendingRequests` map, `nextRequestId()`, `sendControlRequest()`, stream wrapper para `control_response` |
| F-055 | queryIntrospectionMethods | 6 metodos de introspeccao + tipos em `src/types/query.ts` + exports |

## Limites

- NAO alterar `interrupt()` — continua usando SIGINT
- NAO alterar `respondToPermission()` — ja funciona
- NAO alterar `spawnAndStream()` — o wrapper opera sobre o stream retornado
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO exportar `sendControlRequest()`, `pendingRequests` ou `nextRequestId()` — sao internals do closure de `query()`

## Dependencias

Nenhuma dependencia de outros PRPs. PRP-024 depende deste PRP (reutiliza infraestrutura de F-054).
