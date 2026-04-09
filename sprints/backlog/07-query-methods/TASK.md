# Query Methods — Controle mid-session

Implementar os 12 metodos faltantes no objeto `Query` para paridade com o Claude Code SDK.

---

## Contexto

O `Query` retornado por `query()` hoje expoe apenas `interrupt()`, `close()` e `respondToPermission()`. O Claude Code SDK expoe 15+ metodos que permitem controle dinamico da sessao em andamento: trocar modelo, ajustar thinking, introspectar MCP servers, etc.

Esses metodos comunicam com o subprocess via stdin JSON (protocolo de controle do CLI).

---

## Metodos a implementar

### Configuracao mid-session

| Metodo | Assinatura | Descricao |
|--------|-----------|-----------|
| `setPermissionMode` | `(mode: PermissionMode) => Promise<void>` | Muda modo de permissao durante a sessao |
| `setModel` | `(model?: string) => Promise<void>` | Troca modelo durante a sessao |
| `setMaxThinkingTokens` | `(tokens: number \| null) => Promise<void>` | Ajusta budget de thinking |

### Introspeccao

| Metodo | Assinatura | Descricao |
|--------|-----------|-----------|
| `initializationResult` | `() => Promise<SDKControlInitializeResponse>` | Resultado de init (tools, agents, MCP) |
| `supportedCommands` | `() => Promise<SlashCommand[]>` | Slash commands disponiveis |
| `supportedModels` | `() => Promise<ModelInfo[]>` | Modelos disponiveis |
| `supportedAgents` | `() => Promise<AgentInfo[]>` | Agentes configurados |
| `mcpServerStatus` | `() => Promise<McpServerStatus[]>` | Status dos MCP servers |
| `accountInfo` | `() => Promise<AccountInfo>` | Info da conta |

### Operacoes

| Metodo | Assinatura | Descricao |
|--------|-----------|-----------|
| `rewindFiles` | `(userMessageId: string, opts?: { dryRun?: boolean }) => Promise<RewindFilesResult>` | Reverte arquivos a um ponto |
| `reconnectMcpServer` | `(serverName: string) => Promise<void>` | Reconecta MCP server |
| `toggleMcpServer` | `(serverName: string, enabled: boolean) => Promise<void>` | Habilita/desabilita MCP server |
| `setMcpServers` | `(servers: Record<string, McpServerConfig>) => Promise<McpSetServersResult>` | Reconfigura MCP servers |
| `streamInput` | `(stream: AsyncIterable<SDKUserMessage>) => Promise<void>` | Envia stream de input assincrono |
| `stopTask` | `(taskId: string) => Promise<void>` | Para task especifica |

---

## Tipos novos necessarios

```typescript
interface SlashCommand {
  name: string
  description?: string
}

interface ModelInfo {
  id: string
  name?: string
  provider?: string
}

interface AgentInfo {
  name: string
  description: string
  model?: string
}

interface McpServerStatus {
  name: string
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled"
  serverInfo?: { name: string; version: string }
  error?: string
  tools?: Array<{ name: string; description?: string }>
}

interface AccountInfo {
  // Estrutura a investigar no CLI
}

interface SDKControlInitializeResponse {
  // Estrutura a investigar no CLI
}

interface McpSetServersResult {
  // Estrutura a investigar no CLI
}

interface RewindFilesResult {
  // Estrutura a investigar no CLI
}
```

---

## Implementacao

### Protocolo de controle via stdin

O CLI aceita comandos JSON via stdin enquanto esta rodando. Cada metodo envia um comando e aguarda a resposta no stream stdout.

Padrao esperado:

```typescript
// Em query.ts, adicionar ao Query:
async setModel(model?: string): Promise<void> {
  this.writeStdin(JSON.stringify({
    type: "control",
    command: "set_model",
    model,
  }) + "\n")
  // Aguardar confirmacao no stream (ou fire-and-forget)
}
```

### Investigacao necessaria

Antes de implementar, investigar no source do OpenClaude CLI:

1. Qual o formato exato dos comandos de controle via stdin?
2. Quais comandos retornam resposta e quais sao fire-and-forget?
3. Como correlacionar request/response (ID de mensagem)?

---

## Prioridade

**Alta** — Esses metodos sao o maior gap funcional entre OpenClaude SDK e Claude Code SDK. Sem eles, usuarios nao conseguem controle dinamico de sessoes.

---

## Criterios de aceite

- [ ] Todos os 15 metodos expostos no objeto `Query`
- [ ] Tipos exportados em `src/types/`
- [ ] `writeStdin` ja existe em `spawnAndStream` — reutilizar
- [ ] Typecheck passa
- [ ] Build passa

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Gap analysis | `.tmp/REPORT-1.md` |
| Claude Code SDK docs | `platform.claude.com/docs/en/agent-sdk/typescript-v2-preview` |
