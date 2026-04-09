# openclaude-sdk - Documentacao de Query Control e Introspection Methods no README

Atualizar a tabela de metodos do `Query` no README para incluir metodos de configuracao mid-session e introspection.

---

## Objetivo

Resolver D-047 (score 7): os metodos `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` (controle mid-session) e os metodos de introspection (`initializationResult()`, `supportedModels()`, `mcpServerStatus()`, etc.) foram implementados no sprint-7 mas nao documentados.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | Tabela do Query desatualizada | Apenas `interrupt()`, `close()`, `respondToPermission()` listados |
| 2 | Control methods ausentes | `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` sem docs |
| 3 | Introspection methods ausentes | 6 metodos de introspection invisiveis para usuarios |

---

## Estado Atual

**Arquivo**: `README.md`, secao "API Reference > `query(params)`"

A tabela atual do `Query`:

| Method | Description |
|--------|-------------|
| `interrupt(): Promise<void>` | Gracefully interrupt the running agent |
| `close(): void` | Immediately terminate the subprocess |
| `respondToPermission(response: PermissionResponse): void` | Respond to a tool permission request (plan mode) |

Faltam 9 metodos implementados em `src/query.ts` (linhas 44-72).

---

## Implementacao

### 1. Expandir tabela de metodos do `Query`

Substituir a tabela atual por uma tabela organizada em categorias:

#### Control Methods

| Metodo | Descricao |
|--------|-----------|
| `interrupt(): Promise<void>` | Interrompe a query graciosamente (SIGINT) |
| `close(): Promise<void>` | Fecha a query e mata o processo (shutdown de 3 estagios) |
| `respondToPermission(response): void` | Responde a solicitacao de permissao de ferramenta (plan mode) |
| `setModel(model?: string): void` | Define o modelo mid-session (fire-and-forget). `undefined` reseta ao default |
| `setPermissionMode(mode): void` | Altera o modo de permissao mid-session (`"default"`, `"plan"`, `"bypassPermissions"`, `"dontAsk"`) |
| `setMaxThinkingTokens(tokens): void` | Define max thinking tokens mid-session. `null` para desabilitar |

#### Introspection Methods

| Metodo | Retorno | Descricao |
|--------|---------|-----------|
| `initializationResult()` | `Promise<InitializationResult>` | Resultado da inicializacao (tools, agents, MCP) |
| `supportedCommands()` | `Promise<SlashCommand[]>` | Slash commands disponiveis |
| `supportedModels()` | `Promise<ModelInfo[]>` | Modelos disponiveis |
| `supportedAgents()` | `Promise<AgentInfo[]>` | Agentes configurados |
| `mcpServerStatus()` | `Promise<McpServerStatusInfo[]>` | Status dos MCP servers conectados |
| `accountInfo()` | `Promise<AccountInfo>` | Informacoes da conta |

### 2. Exemplo de uso mid-session

Adicionar exemplo apos a tabela:

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

### 3. Nota sobre protocolo de controle

Adicionar nota explicando que:
- Control methods (set*) sao fire-and-forget: enviam comando via stdin e nao aguardam resposta
- Introspection methods sao request/response: enviam comando e aguardam resposta via stdout (timeout 10s)
- Introspection methods so funcionam enquanto o agent esta ativo (durante iteracao do stream)

### 4. Tipos de introspection exportados

Mencionar que os tipos abaixo sao exportados de `openclaude-sdk`:

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

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `README.md` | Expandir tabela do Query, adicionar exemplo de control/introspection, nota sobre protocolo |

---

## Criterios de Aceite

- [ ] Tabela do `Query` expandida com todos os 15 metodos (3 existentes + 3 control + 6 introspection + 3 operation basicos)
- [ ] Metodos organizados por categoria (Control, Introspection)
- [ ] Exemplo de `setModel()` mid-session
- [ ] Exemplo de `supportedModels()` e `mcpServerStatus()`
- [ ] Nota sobre fire-and-forget vs request/response
- [ ] Tipos de introspection listados como exportacoes
- [ ] Exemplos de codigo compilaveis
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Tabela expandida do Query | S-034 |
| Control methods docs | S-034 |
| Introspection methods docs | S-034 |
| Discovery | D-047 |
| Implementacao | `src/query.ts` linhas 44-72, 204-230 |
