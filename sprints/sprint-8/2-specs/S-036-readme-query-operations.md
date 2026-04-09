# openclaude-sdk - Documentacao de Query Operation Methods Avancados no README

Adicionar referencia tabular dos metodos de operacao avancada do `Query` no README.

---

## Objetivo

Resolver D-049 (score 5): os metodos `rewindFiles()`, `setMcpServers()`, `reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()`, e `streamInput()` foram implementados no sprint-7 mas nao documentados. Sao uteis para automacoes avancadas.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `rewindFiles()` nao documentada | Reverter alteracoes do agente sem docs |
| 2 | `setMcpServers()` nao documentada | Reconfigurar MCP mid-session sem docs |
| 3 | `streamInput()` nao documentada | Enviar texto chunk a chunk sem docs |
| 4 | Fire-and-forget operations nao documentadas | `reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()` sem docs |

---

## Estado Atual

**Arquivo**: `README.md`

Nenhum dos metodos de operacao avancada aparece na tabela do `Query` nem em qualquer outra secao.

Implementacao em `src/query.ts`:
- `rewindFiles(userMessageId, opts?)` — linhas 240-260, request/response com timeout 30s
- `setMcpServers(servers)` — linhas 261-280, request/response com timeout 30s
- `reconnectMcpServer(serverName)` — linha 231, fire-and-forget
- `toggleMcpServer(serverName, enabled)` — linha 234, fire-and-forget
- `stopTask(taskId)` — linha 237, fire-and-forget
- `streamInput(stream)` — linhas 281-286, async iterable → stdin

---

## Implementacao

### 1. Adicionar categoria "Operation Methods" na tabela do Query

Inserir apos a categoria "Introspection Methods" (S-034). Dividir em duas sub-tabelas:

#### Request/Response Operations (com timeout 30s)

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

### 2. Exemplo de `rewindFiles()`

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

### 3. Exemplo de `streamInput()`

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

### 4. Tipos exportados

Mencionar tipos de retorno:

```typescript
import type {
  RewindFilesResult,
  McpSetServersResult,
} from "openclaude-sdk"
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `README.md` | Categoria "Operation Methods" na tabela do Query, exemplos de `rewindFiles()` e `streamInput()` |

---

## Criterios de Aceite

- [ ] Tabela de operation methods organizada em Request/Response, Fire-and-Forget, e Stream
- [ ] `rewindFiles()` documentada com assinatura, `dryRun` e exemplo
- [ ] `setMcpServers()` documentada com assinatura
- [ ] `reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()` documentadas
- [ ] `streamInput()` documentada com exemplo de AsyncIterable
- [ ] Tipos `RewindFilesResult`, `McpSetServersResult` mencionados como exportacoes
- [ ] Nota sobre timeouts (30s para request/response)
- [ ] Exemplos de codigo compilaveis
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Operation methods docs | S-036 |
| `rewindFiles()` docs | S-036 |
| `streamInput()` docs | S-036 |
| Discovery | D-049 |
| Implementacao | `src/query.ts` linhas 231-286 |
