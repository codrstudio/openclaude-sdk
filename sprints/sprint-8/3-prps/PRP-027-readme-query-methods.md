# PRP-027 — README: Query Control, Introspection e Operation Methods

## Objetivo

Expandir a tabela de metodos do `Query` no README para incluir control methods (mid-session), introspection methods e operation methods avancados, com exemplos e notas sobre o protocolo de comunicacao.

Referencia: specs S-034 (D-047) e S-036 (D-049).

## Execution Mode

`implementar`

## Contexto

A tabela atual do `Query` no README lista apenas 3 metodos: `interrupt()`, `close()`, `respondToPermission()`. No sprint-7 foram implementados 12 metodos adicionais em `src/query.ts`:

- 3 control methods: `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` — fire-and-forget via stdin
- 6 introspection methods: `initializationResult()`, `supportedCommands()`, `supportedModels()`, `supportedAgents()`, `mcpServerStatus()`, `accountInfo()` — request/response com timeout 10s
- 2 request/response operations: `rewindFiles()`, `setMcpServers()` — timeout 30s
- 3 fire-and-forget operations: `reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()`
- 1 stream operation: `streamInput()` — AsyncIterable → stdin

Nenhum desses metodos aparece no README.

## Especificacao

### Feature F-063 — Query Control e Introspection no README

**1. Substituir a tabela atual de metodos do `Query`** por tabela organizada em categorias.

**2. Categorias e metodos:**

#### Core Methods (existentes)

| Metodo | Descricao |
|--------|-----------|
| `interrupt(): Promise<void>` | Interrompe a query graciosamente (SIGINT) |
| `close(): Promise<void>` | Fecha a query e mata o processo (shutdown de 3 estagios) |
| `respondToPermission(response): void` | Responde a solicitacao de permissao de ferramenta (plan mode) |

#### Control Methods (fire-and-forget)

| Metodo | Descricao |
|--------|-----------|
| `setModel(model?: string): void` | Define o modelo mid-session. `undefined` reseta ao default |
| `setPermissionMode(mode): void` | Altera o modo de permissao mid-session (`"default"`, `"plan"`, `"bypassPermissions"`, `"dontAsk"`) |
| `setMaxThinkingTokens(tokens): void` | Define max thinking tokens mid-session. `null` para desabilitar |

#### Introspection Methods (request/response, timeout 10s)

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `initializationResult()` | `Promise<InitializationResult>` | Resultado da inicializacao (tools, agents, MCP) |
| `supportedCommands()` | `Promise<SlashCommand[]>` | Slash commands disponiveis |
| `supportedModels()` | `Promise<ModelInfo[]>` | Modelos disponiveis |
| `supportedAgents()` | `Promise<AgentInfo[]>` | Agentes configurados |
| `mcpServerStatus()` | `Promise<McpServerStatusInfo[]>` | Status dos MCP servers conectados |
| `accountInfo()` | `Promise<AccountInfo>` | Informacoes da conta |

**3. Exemplo de uso mid-session:**

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Analyze this codebase",
  options: { permissionMode: "plan" },
})

// Mudar modelo mid-session
q.setModel("claude-sonnet-4-6")

// Checar modelos disponiveis
const models = await q.supportedModels()
console.log("Available models:", models.map(m => m.id))

// Verificar status de MCP servers
const mcpStatus = await q.mcpServerStatus()
for (const server of mcpStatus) {
  console.log(`${server.name}: ${server.status}`)
}

for await (const msg of q) {
  // ...
}
```

**4. Nota sobre protocolo de controle:**

- Control methods (set*) sao fire-and-forget: enviam comando via stdin e nao aguardam resposta
- Introspection methods sao request/response: enviam comando e aguardam resposta via stdout (timeout 10s)
- Introspection methods so funcionam enquanto o agent esta ativo (durante iteracao do stream)

**5. Tipos de introspection exportados:**

```typescript
import type {
  InitializationResult,
  SlashCommand,
  ModelInfo,
  AgentInfo,
  McpServerStatusInfo,
  AccountInfo,
} from "openclaude-sdk"
```

### Feature F-064 — Query Operation Methods no README

**1. Adicionar categoria "Operation Methods"** na tabela do Query, apos "Introspection Methods".

**2. Dividir em tres sub-categorias:**

#### Request/Response Operations (timeout 30s)

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `rewindFiles(userMessageId, opts?)` | `Promise<RewindFilesResult>` | Reverte arquivos alterados pelo agente a um ponto anterior. `opts.dryRun` para preview |
| `setMcpServers(servers)` | `Promise<McpSetServersResult>` | Reconfigura MCP servers mid-session |

#### Fire-and-Forget Operations

| Metodo | Descricao |
|--------|-----------|
| `reconnectMcpServer(serverName)` | Reconecta um MCP server desconectado |
| `toggleMcpServer(serverName, enabled)` | Habilita/desabilita um MCP server |
| `stopTask(taskId)` | Para uma task especifica do agente |

#### Stream Operations

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `streamInput(stream)` | `Promise<void>` | Envia texto chunk a chunk via stdin. Bloqueante ate consumir o iterable inteiro |

**3. Exemplo de `rewindFiles()`:**

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Refactor the auth module",
  options: { permissionMode: "plan" },
})

let lastUserMessageId: string | null = null

for await (const msg of q) {
  if (msg.type === "user") {
    lastUserMessageId = msg.uuid
  }

  // Se algo der errado, reverter
  if (shouldRevert && lastUserMessageId) {
    const preview = await q.rewindFiles(lastUserMessageId, { dryRun: true })
    console.log("Files to revert:", preview)

    await q.rewindFiles(lastUserMessageId)
    break
  }
}
```

**4. Exemplo de `streamInput()`:**

```typescript
import { query } from "openclaude-sdk"

const q = query({ prompt: "Process the following data:" })

// Enviar dados em chunks (ex: leitura de arquivo grande)
async function* generateChunks() {
  yield "First chunk of data\n"
  yield "Second chunk of data\n"
  yield "Final chunk\n"
}

await q.streamInput(generateChunks())

for await (const msg of q) {
  // ...
}
```

**5. Tipos exportados:**

```typescript
import type {
  RewindFilesResult,
  McpSetServersResult,
} from "openclaude-sdk"
```

**6. Nota sobre timeouts:** Request/response operations usam timeout de 30s (maior que introspection) por envolverem operacoes de filesystem ou rede.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-063 | readmeQueryControlIntrospection | Expandir tabela do Query com control methods e introspection methods, exemplo mid-session, nota sobre protocolo, tipos exportados |
| F-064 | readmeQueryOperations | Adicionar operation methods (request/response, fire-and-forget, stream) com exemplos de `rewindFiles()` e `streamInput()`, tipos exportados |

## Limites

- NAO alterar codigo em `src/` — este PRP e exclusivamente de documentacao
- NAO remover metodos existentes da tabela (`interrupt`, `close`, `respondToPermission`)
- NAO adicionar exemplos que dependam de features nao implementadas
- NAO documentar metodos internos nao exportados

## Dependencias

Nenhuma dependencia de outros PRPs.
