# Brainstorming — openclaude-sdk (Sprint 7)

## Contexto

O TASK.md define o `openclaude-sdk` como um SDK TypeScript programático para o OpenClaude CLI. As waves 1–6 implementaram D-001 a D-037 (com exceção de D-027 e D-028, deliberadamente adiados por baixo impacto).

O sprint 6 concluiu com F-044, F-045 e F-046 todas em status `passing`, entregando o shutdown de 3 estágios em `close()` e `onAbort`, além do guard `stdinClosed` em `writeStdin()`.

Esta wave foca nos **quatro backlog items ainda não mapeados como discoveries**: session chain reconstruction (backlog/05), MCP tool factories (backlog/06), query control methods (backlog/07) e a V2 session API (backlog/08).

---

## Funcionalidades mapeadas (estado atual da codebase)

### `src/process.ts`

- `resolveExecutable(options?)` — resolve comando `openclaude`, suporte Windows via `cmd /c`
- `filterEnv(env)` — filtra valores `undefined` antes de passar ao child process
- `buildCliArgs(options)` — mapeia `Options` completo para args do CLI (output format, permissões, sessão, system prompt, tools, modelo, maxTurns, additionalDirectories, betas, effort, thinking, maxBudgetUsd, debug, mcpServers, extraArgs)
- `spawnAndStream(command, args, prompt, options)` — spawna processo, parse JSONL, buffer acumulativo 1MB, expõe:
  - `stream` — AsyncGenerator de SDKMessage
  - `writeStdin(data)` — com guard `stdinClosed` (D-037)
  - `close()` — shutdown de 3 estágios: stdin.end → SIGTERM (5s) → SIGKILL (5s) (D-035)
  - `onAbort` — shutdown de 3 estágios: stdin.end → SIGTERM (5s) → SIGKILL (5s) (D-036)
  - `interrupt()` — SIGINT preservado para interrupções do usuário

### `src/query.ts`

- `query(params)` — interface principal; retorna objeto `Query` (AsyncGenerator + métodos extras)
- `collectMessages(queryOrParams)` — coleta todas as mensagens até completion, lança erros tipados
- `continueSession(sessionId, prompt, options)` — sugar layer para `query()` com `resume: sessionId`
- `Query` interface: `interrupt()`, `close(): Promise<void>`, `respondToPermission(response)`

### `src/sessions.ts`

- `listSessions(options?)` — deep search em `~/.claude/projects/`, agrega sessões de todos os projetos
- `getSessionMessages(sessionId, options?)` — lê arquivo JSONL, filtra por `type === "user" || "assistant"` (**sem chain reconstruction**)
- `getSessionInfo(sessionId, options?)` — metadados da sessão
- `renameSession(sessionId, title, options?)` — atualiza título
- `tagSession(sessionId, tags, options?)` — atualiza tags
- `deleteSession(sessionId, options?)` — remove arquivo JSONL

### `src/registry.ts`

- `createOpenRouterRegistry(options)` — cria registry para OpenRouter com apiKey + models
- `resolveModelEnv(registry, modelId)` — resolve env vars para provider (anthropic, openrouter, openai, bedrock, vertex)

### `src/errors.ts`

- Hierarquia: `OpenClaudeError` → `AuthenticationError`, `BillingError`, `RateLimitError`, `InvalidRequestError`, `ServerError`, `MaxTurnsError`, `MaxBudgetError`, `ExecutionError`, `StructuredOutputError`
- `isRecoverable(error)` — retorna true para RateLimitError e ServerError

### `src/types/`

- `messages.ts` — todos os tipos de SDKMessage (30+ tipos)
- `options.ts` — `Options`, MCP server configs, permissões, hooks, thinking
- `sessions.ts` — `SDKSessionInfo`, `SessionMessage`, opções de listagem/leitura
- `tools.ts` — tool input/output schemas
- `provider.ts` — `Provider`, `Model`, `ProviderRegistry`

---

## Lacunas e oportunidades

### Gap 38 — `getSessionMessages()` sem reconstrução de conversation chain (BUG)

**Arquivo**: `src/sessions.ts`, função `getSessionMessages()`  
**Referência**: `backlog/05-session-chain-reconstruction/`, `ref/sessions.py`

**Problema**: O algoritmo atual filtra simplesmente por `type === "user" || type === "assistant"` e retorna na ordem do arquivo. Isso falha com:
- **Sidechains**: mensagens de branches paralelos aparecem misturadas na main chain
- **Team messages**: mensagens de team agents (campo `teamName`) aparecem na lista
- **Meta messages**: mensagens internas (`isMeta`) aparecem
- **Ordem incorreta**: sem reconstrução via `parentUuid`, sessões com compactação ou forks têm ordem errada

**Fix**: Reimplementar seguindo o algoritmo Python SDK:
1. Parse: filtrar entries com `uuid` e `type` em `TRANSCRIPT_TYPES`
2. Indexar por UUID e por posição no arquivo
3. Encontrar terminais (UUIDs que não aparecem como `parentUuid` de nenhuma outra entry)
4. De cada terminal, caminhar backward via `parentUuid` para encontrar "leaves" user/assistant
5. Filtrar: excluir sidechain, teamName, isMeta
6. Escolher o melhor leaf (maior posição no arquivo)
7. Caminhar de leaf até root, detectando ciclos
8. Reverter (root → leaf = cronológica)
9. Filtrar visíveis: user/assistant, !isMeta, !isSidechain, !teamName (isCompactSummary mantido)

### Gap 39 — `tool()` factory não existe (FEATURE)

**Arquivo**: a criar em `src/mcp.ts`  
**Referência**: `backlog/06-mcp-tool-factories/TASK.md`

**Problema**: Não há forma de definir MCP tools programaticamente. Usuários que querem tools inline precisam criar um MCP server externo separado. O Claude Code SDK oficial tem `tool()` com schema Zod e handler.

**Fix**: Implementar `tool(name, description, inputSchema, handler, extras?)` que retorna `SdkMcpToolDefinition`. Exportar tipos `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`.

### Gap 40 — `createSdkMcpServer()` não existe (FEATURE)

**Arquivo**: a criar em `src/mcp.ts`  
**Referência**: `backlog/06-mcp-tool-factories/TASK.md`

**Problema**: Não há forma de criar MCP servers in-process. `createSdkMcpServer()` cria um `McpServer` do `@modelcontextprotocol/sdk` e o registra como config `type: "sdk"` compatível com `mcpServers` Options.

**Fix**: Implementar `createSdkMcpServer({ name, version?, tools? })`. Adicionar `McpSdkServerConfigWithInstance` ao tipo `McpServerConfig`. Adicionar `@modelcontextprotocol/sdk` e `zod` como peerDependencies.

### Gap 41 — Query sem métodos de configuração mid-session (FEATURE)

**Arquivo**: `src/query.ts`, interface `Query`  
**Referência**: `backlog/07-query-methods/TASK.md`

**Problema**: `Query` expõe apenas 3 métodos (`interrupt`, `close`, `respondToPermission`). O Claude Code SDK expõe 15+ métodos de controle dinâmico via stdin JSON. Os 3 métodos de configuração são os mais impactantes: `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()`.

**Fix**: Implementar os 3 métodos de configuração via protocolo de controle stdin. Investigar formato exato dos comandos no source do OpenClaude CLI.

### Gap 42 — Query sem métodos de introspecção (FEATURE)

**Arquivo**: `src/query.ts`, interface `Query`  
**Referência**: `backlog/07-query-methods/TASK.md`

**Problema**: Faltam 6 métodos de introspecção: `initializationResult()`, `supportedCommands()`, `supportedModels()`, `supportedAgents()`, `mcpServerStatus()`, `accountInfo()`. Necessários para debugging e construção de UIs dinâmicas.

**Fix**: Implementar via protocolo stdin JSON. Requer definição dos tipos de resposta correspondentes.

### Gap 43 — Query sem métodos de operação avançada (FEATURE)

**Arquivo**: `src/query.ts`, interface `Query`  
**Referência**: `backlog/07-query-methods/TASK.md`

**Problema**: Faltam 6 métodos de operação: `rewindFiles()`, `reconnectMcpServer()`, `toggleMcpServer()`, `setMcpServers()`, `streamInput()`, `stopTask()`. Necessários para controle avançado de sessões em andamento.

**Fix**: Implementar via protocolo stdin JSON. `streamInput()` é o mais complexo (AsyncIterable).

### Gap 44 — V2 Session API: `createSession()` + `SDKSession` (FEATURE)

**Arquivo**: a criar em `src/session-v2.ts`  
**Referência**: `backlog/08-v2-session-api/TASK.md`

**Problema**: Não há API orientada a objeto para conversas multi-turn. O padrão atual (`continueSession()` + `query()`) requer que o caller gerencie o `sessionId` manualmente a cada turno.

**Fix**: Implementar `createSession(options): SDKSession` com objeto stateful que mantém `sessionId` e encadeia queries automaticamente. Suporte a `await using` via `[Symbol.asyncDispose]()`.

### Gap 45 — V2 Session API: `resumeSession()` + `prompt()` (FEATURE)

**Arquivo**: `src/session-v2.ts`  
**Referência**: `backlog/08-v2-session-api/TASK.md`

**Problema**: `resumeSession()` é o análogo de `createSession()` para sessões existentes. `prompt()` é um one-shot convenience que substitui o padrão `query() → collectMessages()` para quem não precisa de streaming.

**Fix**: `resumeSession(sessionId, options)` retorna SDKSession já conectado à sessão. `prompt(text, options)` faz query + coleta result em uma chamada.

---

## Priorização

| Discovery | Tipo | Descrição curta | Score | Justificativa |
|-----------|------|-----------------|-------|---------------|
| D-038 | bug | `getSessionMessages()` com conversation chain reconstruction | 8 | Bug de correção: filtragem ingênua produz resultados incorretos em sessões com sidechains ou forks. Qualquer app que leia histórico de sessões está exposto. Implementação complexa mas bem documentada no ref Python. |
| D-039 | feature | `tool()` factory com schema Zod e handler | 6 | Habilita MCP tools inline sem servidor externo. Pré-requisito para D-040. Impacto alto para usuários que querem integração tight com código TypeScript. |
| D-040 | feature | `createSdkMcpServer()` MCP server in-process | 6 | Complemento de D-039. Junta tools em servidor in-process compatível com `mcpServers`. Peerdepenencies adicionadas (zod + @modelcontextprotocol/sdk). |
| D-041 | feature | Query: métodos de configuração mid-session (setModel, setPermissionMode, setMaxThinkingTokens) | 7 | Gap funcional mais impactante do Query. `setModel()` e `setPermissionMode()` são necessários para automações que ajustam comportamento dinamicamente. Alta demanda por paridade com SDK oficial. |
| D-042 | feature | Query: métodos de introspecção (initializationResult, supportedModels, mcpServerStatus...) | 5 | Valor para debugging e UIs dinâmicas. Menor impacto que configuração mas importante para completude da API. Requer investigação do protocolo stdin. |
| D-043 | feature | Query: métodos de operação (rewindFiles, reconnectMcpServer, setMcpServers...) | 5 | Controle avançado de sessões. `rewindFiles()` e `setMcpServers()` têm casos de uso claros. `streamInput()` é o mais complexo. |
| D-044 | feature | V2 Session API: createSession() + SDKSession | 5 | Ergonomia multi-turn sem gerenciar sessionId manualmente. `await using` é DX moderna. Wrapper fino sobre query() existente. |
| D-045 | feature | V2 Session API: resumeSession() + prompt() | 4 | Conveniência adicional da V2. `prompt()` simplifica o one-shot comum. Baixa complexidade se D-044 já estiver pronto. |
| D-027 | improvement | Split de múltiplos JSONs concatenados por linha | 3 | Improvável no Node (readline já divide por \\n). Mantido por rastreabilidade mas sem prioridade. |
| D-028 | improvement | MAX_BUFFER_SIZE configurável via Options | 3 | 1 MB é suficiente para qualquer mensagem real. Complexidade adicionada sem benefício prático significativo. |
