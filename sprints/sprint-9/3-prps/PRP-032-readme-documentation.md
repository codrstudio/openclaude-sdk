# PRP-032 — README Documentation

## Objetivo

Documentar no README.md quatro areas implementadas mas nao documentadas: V2 Session API, Query control methods, MCP Tool Factories, e Query introspection/operation methods.

Referencia: specs S-043 (D-046), S-044 (D-047), S-045 (D-048), S-046 (D-049).

## Execution Mode

`implementar`

## Contexto

Sprints 7 e 8 implementaram funcionalidades significativas que nao foram documentadas no README:

| Funcionalidade | Implementada em | Feature IDs |
|----------------|-----------------|-------------|
| V2 Session API (`createSession`, `resumeSession`, `prompt`) | sprint-7 | F-059, F-060, F-061 |
| Query control methods (`setModel`, `setPermissionMode`, `setMaxThinkingTokens`) | sprint-7 | F-053 |
| Query introspection methods (6 metodos) | sprint-7 | F-055 |
| Query operation methods (6 metodos) | sprint-7 | F-056 |
| MCP Tool Factories (`tool`, `createSdkMcpServer`) | sprint-7 | F-039, F-040 |

O README e o principal ponto de entrada para usuarios. Funcionalidades nao documentadas sao efetivamente invisiveis.

**Nota**: a documentacao de MCP Tool Factories (F-074) deve refletir a API pos-PRP-030/031 (`createSdkMcpServer()` async, transporte automatico).

## Especificacao

### Feature F-072 — Secao V2 Session API no README

**1. Inserir nova secao "V2 Session API"** no `README.md`, apos a secao "Session Management" e antes de "Plan Mode".

**2. Conteudo obrigatorio:**

#### Introducao

Uma frase: a V2 Session API e o padrao recomendado para conversas multi-turn, substituindo o gerenciamento manual de `sessionId`.

#### `createSession(opts?)`

Assinatura completa:
```typescript
function createSession(opts?: CreateSessionOptions): SDKSession

interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string  // auto-gerado se omitido
}
```

#### Tabela da interface `SDKSession`

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `send(prompt, options?)` | `Query` | Envia mensagem e retorna stream |
| `collect(prompt, options?)` | `Promise<{ messages, result, costUsd, durationMs }>` | Envia e coleta resultado completo |
| `close()` | `Promise<void>` | Fecha a sessao e mata query ativa |
| `[Symbol.asyncDispose]()` | `Promise<void>` | Suporte a `await using` |

#### Exemplo multi-turn com streaming

```typescript
import { createSession } from "openclaude-sdk"

await using session = createSession({ model: "sonnet" })

// Turno 1 — streaming
for await (const msg of session.send("Create a hello.ts file")) {
  if (msg.type === "assistant") {
    console.log(msg.message.content)
  }
}

// Turno 2 — coleta completa
const result = await session.collect("Now add error handling")
console.log(result.result)
```

#### `resumeSession(sessionId, opts?)`

Assinatura e exemplo curto de retomada de sessao existente.

#### `prompt(text, opts?)` — one-shot

Assinatura e exemplo de uso simples.

#### Nota sobre `await using`

Explicar que `SDKSession` implementa `AsyncDisposable` — `await using` garante cleanup automatico. Requer TypeScript >= 5.2 com `target: "ES2022"`.

#### Comparacao V1 vs V2

| Aspecto | V1 (`query` + `continueSession`) | V2 (`createSession`) |
|---------|----------------------------------|----------------------|
| Gerenciamento de sessionId | Manual | Automatico |
| Multi-turn | `continueSession()` a cada turno | `session.send()` encadeia |
| Cleanup | Manual (`q.close()`) | `await using` |
| One-shot | `query()` + `collectMessages()` | `prompt()` |

#### Tipos exportados

Mencionar exports: `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions`.

### Feature F-073 — Query Control Methods no README

**1. Atualizar tabela do objeto `Query`** no README com 3 metodos de controle:

| Metodo | Descricao |
|--------|-----------|
| `setModel(model?: string)` | Troca o modelo para o proximo turno. Sem argumento reseta para default |
| `setPermissionMode(mode)` | Muda o modo de permissao dinamicamente |
| `setMaxThinkingTokens(tokens: number \| null)` | Ajusta budget de thinking. `null` desabilita |

**2. Adicionar exemplo de uso mid-session:**

```typescript
const q = query({ prompt: "Analyze this codebase" })

// Apos primeiros resultados, trocar para modelo mais capaz
q.setModel("opus")

for await (const msg of q) {
  // ...
}
```

**3. Nota**: todos sao fire-and-forget — efeito aplicado ao proximo turno do agente.

### Feature F-074 — Secao MCP Tool Factories no README

**1. Nova secao "MCP Tool Factories"** apos "MCP Servers".

**2. Assinatura de `tool()`:**

```typescript
function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>
```

**3. Assinatura de `createSdkMcpServer()` — ASYNC (pos PRP-030):**

```typescript
async function createSdkMcpServer(options: {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
}): Promise<McpSdkServerConfig>
```

**4. Tabela dos tipos exportados:**

| Tipo | Descricao |
|------|-----------|
| `ToolAnnotations` | Metadados de tool (`readOnly`, `destructive`, `idempotent`, `openWorld`) |
| `CallToolResult` | Resultado de handler (`content[]`, `isError?`) |
| `SdkMcpToolDefinition<Schema>` | Definicao completa de tool com schema Zod |

**5. Exemplo end-to-end:**

```typescript
import { tool, createSdkMcpServer, query } from "openclaude-sdk"
import { z } from "zod"

const weatherTool = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text", text: `Weather in ${city}: 22C, sunny` }],
  }),
)

const server = await createSdkMcpServer({
  name: "my-tools",
  tools: [weatherTool],
})

const q = query({
  prompt: "What's the weather in London?",
  options: { mcpServers: { "my-tools": server } },
})
```

**6. Nota sobre peerDependencies:** `zod` e `@modelcontextprotocol/sdk` sao opcionais — so necessarias para quem usa MCP Tool Factories.

### Feature F-075 — Query Introspection & Operation Methods no README

**1. Expandir tabela do Query** com duas sub-secoes:

#### Introspection Methods

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `initializationResult()` | `Promise<InitializationResult>` | Resultado da inicializacao (tools, agents, MCP) |
| `supportedCommands()` | `Promise<SlashCommand[]>` | Slash commands disponiveis |
| `supportedModels()` | `Promise<ModelInfo[]>` | Modelos disponiveis |
| `supportedAgents()` | `Promise<AgentInfo[]>` | Agentes configurados |
| `mcpServerStatus()` | `Promise<McpServerStatusInfo[]>` | Status dos MCP servers |
| `accountInfo()` | `Promise<AccountInfo>` | Informacoes da conta |

#### Operation Methods

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `reconnectMcpServer(name)` | `void` | Reconecta MCP server desconectado |
| `toggleMcpServer(name, enabled)` | `void` | Habilita/desabilita MCP server |
| `stopTask(taskId)` | `void` | Para uma task em execucao |
| `rewindFiles(msgId, opts?)` | `void` | Reverte arquivos ao estado de uma mensagem |
| `setMcpServers(servers)` | `Promise<void>` | Reconfigura MCP servers mid-session |
| `streamInput(stream)` | `void` | Envia stream de input ao agente |

**2. Exemplo de uso para `mcpServerStatus()`:**

```typescript
const q = query({ prompt: "Hello" })

// Consumir primeira mensagem para inicializar
const first = await q.next()

const servers = await q.mcpServerStatus()
for (const s of servers) {
  console.log(`${s.name}: ${s.status}`)
  if (s.error) console.error(`  Error: ${s.error}`)
}
```

**3. Mencionar tipos exportados:** `SlashCommand`, `ModelInfo`, `AgentInfo`, `McpServerStatusInfo`, `AccountInfo`, `InitializationResult`.

### Regras gerais para todas as features

- Texto em portugues, codigo em ingles
- Exemplos de codigo devem ser compilaveis (imports presentes, tipos corretos)
- NAO remover ou reorganizar secoes existentes do README (apenas inserir novas)
- Manter consistencia com o estilo das secoes existentes

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-072 | readmeV2SessionApi | Secao "V2 Session API" com `createSession()`, `resumeSession()`, `prompt()`, tabela `SDKSession`, exemplos, `await using`, comparacao V1 vs V2 |
| F-073 | readmeQueryControlMethods | 3 metodos de controle na tabela do Query com exemplo mid-session |
| F-074 | readmeMcpToolFactories | Secao "MCP Tool Factories" com `tool()`, `createSdkMcpServer()` (async), exemplo end-to-end, tipos exportados |
| F-075 | readmeQueryOperations | 12 metodos (6 introspection + 6 operation) na tabela do Query com exemplo `mcpServerStatus()` |

## Limites

- NAO alterar codigo em `src/` — este PRP e exclusivamente de documentacao
- NAO deprecar APIs existentes no README — V1 e V2 coexistem
- NAO adicionar exemplos que dependam de features nao implementadas
- NAO remover ou reorganizar secoes existentes do README
- NAO documentar `startSdkServerTransport()` — e internal (lifecycle e automatico em `query()`)

## Dependencias

F-074 (MCP Tool Factories docs) depende de PRP-030 e PRP-031 estarem implementados para documentar a API corrigida. As demais features (F-072, F-073, F-075) nao tem dependencias.
