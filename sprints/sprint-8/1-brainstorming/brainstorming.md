# Brainstorming — openclaude-sdk (Sprint 8)

## Contexto

O TASK.md do sprint-8 define o objetivo como `session-chain-reconstruction`: reimplementar
`getSessionMessages()` para seguir o algoritmo do Python SDK via `parentUuid`, eliminando
sidechains, team messages, meta messages e ordem incorreta.

No entanto, **essa funcionalidade já foi implementada no sprint-7** (features F-047, F-048, F-049
— todas em status `passing`). A implementação em `src/sessions.ts` inclui:

- `parseTranscriptEntries()` — filtra entries com `uuid` e `type` em `TRANSCRIPT_TYPES`
- `buildConversationChain()` — reconstrói a main chain via `parentUuid`, detecta ciclos, choose o
  melhor leaf por posição no arquivo
- `isVisibleMessage()` — filtra user/assistant excluindo isMeta, isSidechain, teamName
- `getSessionMessages()` usa o pipeline completo: parse → chain → filter → map

O algoritmo está alinhado ponto a ponto com a referência Python
(`backlog/05-session-chain-reconstruction/ref/sessions.py`), incluindo o comentário sobre
`isCompactSummary` ser mantido intencionalmente.

As demais discoveries de sprint-7 (D-039 a D-045) também foram todas implementadas:
- D-039/D-040/D-041/D-042/D-043: MCP factories, query config/introspection/operation methods
- D-044/D-045: V2 Session API (createSession, resumeSession, prompt)

---

## Funcionalidades mapeadas (estado atual da codebase)

### `src/sessions.ts`

- `sanitizePath(name)` — alinhado com Python SDK (single regex, truncação 200 chars + hash djb2)
- `simpleHash(s)` — hash djb2 de 32 bits em base36, compatível com `_simple_hash()` Python
- `findSessionFile(projectsDir, sessionId)` — deep search por sessionId nos subdirs
- `listSessions(options?)` — deep search em `~/.claude/projects/`
- `parseTranscriptEntries(messages)` — filtra entries válidas (uuid + TRANSCRIPT_TYPES)
- `isVisibleMessage(entry)` — filtra user/assistant, exclui isMeta/isSidechain/teamName
- `buildConversationChain(entries)` — reconstrói main chain via parentUuid com tie-breaking
- `getSessionMessages(sessionId, options?)` — pipeline completo com chain reconstruction
- `getSessionInfo`, `renameSession`, `tagSession`, `deleteSession`

### `src/query.ts`

- `query(params)` — interface principal com `Query` (AsyncGenerator + métodos extras)
- `collectMessages()`, `continueSession()`
- `Query.setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` — fire-and-forget via stdin
- `Query.initializationResult()`, `supportedCommands()`, `supportedModels()`, `supportedAgents()`,
  `mcpServerStatus()`, `accountInfo()` — introspection via control protocol
- `Query.rewindFiles()`, `setMcpServers()` — operations com response (30s timeout)
- `Query.reconnectMcpServer()`, `toggleMcpServer()`, `stopTask()` — fire-and-forget
- `Query.streamInput(stream)` — AsyncIterable → stdin JSON chunks

### `src/mcp.ts`

- `tool<Schema>(name, description, inputSchema, handler, extras?)` — factory MCP tool inline
- `createSdkMcpServer(options)` — McpServer in-process
- Tipos: `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`

### `src/session-v2.ts`

- `createSession(opts?)` — SDKSession stateful com sessionId automático
- `resumeSession(sessionId, opts?)` — SDKSession que retoma sessão existente
- `prompt(text, opts?)` — one-shot: query() + collectMessages() → {result, sessionId, costUsd, durationMs}
- `Symbol.asyncDispose` suportado em `SDKSession`

### `src/index.ts`

Exports completos para todas as funcionalidades acima, incluindo tipos de query introspection,
options (McpSdkServerConfig), e V2 Session API.

---

## Lacunas e oportunidades

### Gap 46 — README não documenta a V2 Session API (DOCS)

**Arquivo**: `README.md`

As funções `createSession()`, `resumeSession()` e `prompt()` foram implementadas em F-059/F-060/F-061
mas não aparecem no README. São a API de maior impacto de DX do sprint-7: permitem conversas
multi-turno stateful sem gerenciar sessionId manualmente, e cleanup automático via `await using`.

O README atual descreve apenas `query()`, `collectMessages()` e `continueSession()` para gerenciar
sessões. A V2 Session API é o padrão recomendado para novos projetos.

### Gap 47 — README não documenta Query control e introspection methods (DOCS)

**Arquivo**: `README.md`

Os métodos `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()` (controle mid-session) e
os métodos de introspection (`initializationResult()`, `supportedModels()`, `mcpServerStatus()`,
etc.) foram implementados mas não documentados.

O README atual documenta apenas `interrupt()`, `close()` e `respondToPermission()` na tabela de
métodos do `Query`. Os novos métodos nem aparecem na tabela.

### Gap 48 — README não documenta MCP tool factories (DOCS)

**Arquivo**: `README.md`

`tool()` e `createSdkMcpServer()` foram implementados (F-050/F-051/F-052) e exportados, mas não
há seção de documentação sobre eles no README. Usuários que quiserem definir MCP tools inline não
terão orientação.

### Gap 49 — README não documenta Query operation methods avançados (DOCS)

**Arquivo**: `README.md`

Os métodos `rewindFiles()`, `setMcpServers()`, `reconnectMcpServer()`, `toggleMcpServer()`,
`stopTask()`, e `streamInput()` foram implementados mas não documentados. São úteis para automações
avançadas e precisam de exemplos de uso.

### Gap 50 — Edge case em buildConversationChain(): fallback com sidechain leaves (BUG)

**Arquivo**: `src/sessions.ts`, função `buildConversationChain()`

Quando `mainLeaves` está vazio (todos os leaves são sidechain, team ou meta), o código faz
fallback para `pickBest(leaves)` que pode retornar um leaf de sidechain. Isso incluiria mensagens
de sidechain na chain principal, contradizendo o objetivo da função.

O Python SDK tem o mesmo comportamento (linha 959: `leaf = _pick_best(main_leaves) if main_leaves else _pick_best(leaves)`). Porém, se `mainLeaves` é vazio em todas as sessões que valem, talvez o correto seja retornar `[]`.

**Baixo impacto**: cenário muito raro em sessões reais — ocorre apenas quando TODOS os terminais são
de sidechains, o que não é o padrão normal de uma sessão Claude Code.

---

## Priorização

| # | Discovery | Tipo | Score | Justificativa |
|---|-----------|------|-------|---------------|
| D-046 | README: V2 Session API | docs | 9 | Funcionalidade mais impactante de DX do sprint-7; usuários não sabem que existe |
| D-047 | README: Query control/introspection | docs | 7 | setModel() e setPermissionMode() têm uso imediato em automações; sem docs são inacessíveis |
| D-048 | README: MCP tool factories | docs | 6 | tool() + createSdkMcpServer() são o caminho para MCP inline; docs são pré-requisito de adoção |
| D-049 | README: Query operation methods avançados | docs | 5 | rewindFiles, streamInput, etc. são avançados mas precisam de referência |
| D-050 | Edge case buildConversationChain fallback | bug | 3 | Raro, paridade com Python SDK, impacto baixo |

As 4 primeiras discoveries são todas documentação. O sprint-7 entregou um conjunto amplo de
funcionalidades (V2 Session API, Query control/introspection/operations, MCP factories) que não
foram incorporadas ao README. Este é o principal gap de sprint-8.
