# Brainstorming — Sprint 13

## Contexto

O TASK.md desta wave descreve o **ask_user built-in**: uma tool MCP in-process que permite ao agente pausar a execução, fazer uma pergunta estruturada ao cliente, e continuar após receber a resposta. É o segundo built-in do milestone-02, depois do `richOutput` (implementado em wave-13/sprint-12).

O padrão arquitetural já foi validado com `richOutput`:
- Flag booleana em `Options` (zero overhead quando `false`)
- `createXxxMcpServer()` no módulo dedicado
- Prompt de sistema injetado via `mergeSystemPromptAppend()`
- Servidor registrado em `mcpServers['ask_user']`

O `ask_user` segue exatamente esse padrão, mas adiciona **comunicação bidirecional**: o handler da tool bloqueia em uma `Promise` até o cliente chamar `respondToAskUser(callId, answer)`.

---

## Funcionalidades mapeadas (já implementadas)

### Wave-13 / Sprint-12 (D-071 a D-081)
- `src/display/schemas.ts` — 19 schemas Zod portados do openclaude-sdk
- `src/display/tools.ts` — 4 meta-tools (display_highlight, display_collection, display_card, display_visual)
- `src/display/server.ts` — `createDisplayMcpServer()`
- `src/display/prompt.ts` — `DISPLAY_SYSTEM_PROMPT` + `mergeSystemPromptAppend()`
- `src/display/index.ts` — barrel do módulo display
- `Options.richOutput?: boolean` — flag na interface
- Integração em `query.ts` — quando `richOutput: true`, injeta server e system prompt
- Exports públicos em `src/index.ts` — 19 schemas, 19 tipos, `DisplayToolRegistry`, `DisplayToolName`
- README — seção "Rich Output" com exemplo e tabela das 4 meta-tools

### Infraestrutura existente reutilizável
- `tool()` factory (`src/mcp.ts`) — cria `SdkMcpToolDefinition<Schema>` com Zod schema
- `createSdkMcpServer()` (`src/mcp.ts`) — cria McpServer in-process
- `mergeSystemPromptAppend()` (`src/display/prompt.ts`) — já disponível para o módulo ask-user reusar
- `startSdkServers()` em `query.ts` — lifecycle management automático de SDK MCP servers
- `Query` interface — métodos bidirecionais já existem (`respondToPermission`)

---

## Lacunas e oportunidades

### Lacuna principal: ask_user built-in (TASK.md)
O `Query` hoje não tem como o agente fazer perguntas ao cliente. `streamInput()` é unidirecional. `respondToPermission()` é binário (allow/deny), não semântico. Falta o mecanismo onde o agente para, pergunta algo estruturado, e recebe uma resposta antes de continuar.

### Lacuna: tipos públicos AskUserRequest / AskUserAnswer
Sem esses tipos exportados, o cliente não consegue tipar o handler de `onAskUser`.

### Lacuna: concurrent question guard
TASK.md define explicitamente que o primeiro release aceita **uma pergunta pendente por vez**. Se o agente invocar `ask_user` com outra pendente, deve receber erro claro.

### Lacuna: respondToAskUser com callId desconhecido
Precisa ser no-op (ou warn), não throw — TASK.md é explícito sobre isso.

### Oportunidade: reutilizar mergeSystemPromptAppend
`mergeSystemPromptAppend()` já existe em `src/display/prompt.ts`. O módulo `ask-user` deve importar dali em vez de duplicar a lógica.

### Gaps de sprint anteriores (ainda não implementados)
Descobertas de sprint-10/11 que ficaram pendentes continuam válidas como dívida técnica:
- D-056: compatibilidade Zod v3/v4 em peerDependencies
- D-057: 12+ opções silenciosamente ignoradas em buildCliArgs()
- D-059: mutação de McpSdkServerConfig._localPort
- D-061/D-062: thinking adaptive e systemPrompt preset não mapeados
- D-067: SDKUserMessage em send() da V2 Session API

---

## Priorização

### Tier 1 — Bloqueante / Core (score 9)
Sem estes, a feature não existe:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-082 | Options.askUser?: boolean — flag de ativação | 9 |
| D-085 | src/ask-user/schema.ts — Zod schema da tool ask_user | 8 |
| D-086 | src/ask-user/server.ts — createAskUserMcpServer() com pending map | 9 |
| D-089 | Query.onAskUser(handler) — subscrição de perguntas | 9 |
| D-090 | Query.respondToAskUser(callId, answer) — desbloqueia handler | 9 |
| D-091 | Integração em query.ts — flag → server + prompt inject | 9 |

### Tier 2 — Contrato e tipos (score 7-8)
Necessários para correctude e usabilidade:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-084 | src/ask-user/types.ts — AskUserRequest, AskUserAnswer | 8 |
| D-083 | Options.askUserTimeoutMs?: number — timeout configurável | 7 |
| D-087 | src/ask-user/prompt.ts — ASK_USER_SYSTEM_PROMPT | 7 |
| D-093 | Exports públicos de AskUserRequest, AskUserAnswer em index.ts | 7 |
| D-095 | Cancelamento explícito via respondToAskUser({ type: "cancelled" }) | 7 |

### Tier 3 — Qualidade e docs (score 5-6)
Importantes mas não bloqueantes:

| ID | Funcionalidade | Score |
|----|----------------|-------|
| D-092 | Concurrent question guard — erro se ask_user chamado com pendente | 6 |
| D-088 | src/ask-user/index.ts — barrel do módulo | 6 |
| D-094 | README seção "Ask User" com exemplo e tabela de inputTypes | 6 |
| D-096 | respondToAskUser com callId desconhecido — no-op + warn | 5 |
