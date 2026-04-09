# Brainstorming — openclaude-sdk (Sprint 10)

## Contexto

O TASK.md do sprint-10 mantém o objetivo central do projeto: **SDK TypeScript programático sobre o OpenClaude CLI**, espelhando o `@anthropic-ai/claude-code` SDK oficial mas para o ecossistema OpenClaude.

Sprints 1–9 cobriram a implementação completa da API pública:
- Core API (`query()`, `collectMessages()`, `continueSession()`)
- Session management V1 e V2 (`createSession`, `resumeSession`, `prompt`)
- Error hierarchy tipada
- Provider/Model registry com OpenRouter
- MCP tool factories inline (`tool()`, `createSdkMcpServer()`)
- Query control/introspection/operation methods (20+ métodos)
- Lifecycle management de SDK MCP servers
- Documentação completa no README.md

O sprint-10 é uma **wave de polimento e lacunas residuais** — o core está funcional, mas uma análise de gap revelou várias opções em `Options` que são tipadas mas silenciosamente ignoradas, inconsistências de versão de dependências, e side effects perigosos no lifecycle management.

---

## Funcionalidades mapeadas (estado atual)

### `src/process.ts` — `buildCliArgs()`

Mapeia para flags CLI:
- `outputFormat`, `allowDangerouslySkipPermissions`, `permissionMode`
- `resume`, `continue`, `sessionId`
- `systemPrompt` (string ou `{ append: string }`)
- `allowedTools`, `disallowedTools`, `model`
- `maxTurns`, `additionalDirectories`, `betas`, `effort`
- `thinking` (apenas `enabled` e `disabled`)
- `maxBudgetUsd`, `debug`
- `mcpServers` (stdio, SSE/HTTP, SDK com `_localPort`)
- `extraArgs`

### `src/process.ts` — `resolveExecutable()`

Usa `pathToClaudeCodeExecutable` ou `openclaude` como padrão. No Windows, envolve em `cmd.exe /c`.

### `src/mcp.ts`

- `tool()` — factory de SdkMcpToolDefinition com schema Zod
- `createSdkMcpServer()` — cria McpServer in-process (async, ESM correto)
- `startSdkServerTransport()` — HTTP server em porta aleatória com StreamableHTTPServerTransport

### `src/query.ts`

- `startSdkServers()` / `stopSdkServers()` — lifecycle interno
- **Mutação de `_localPort`**: `startSdkServers()` faz `sdkConfig._localPort = port` diretamente no objeto passado

### `src/session-v2.ts`

- `createSession()` — gerencia `sessionId` automaticamente entre turnos
- `resumeSession()` — sempre passa `resume: sessionId`
- `prompt()` — one-shot sem streaming

### `package.json`

- `devDependencies`: `zod@^4.3.6` (Zod v4)
- `peerDependencies`: `zod: >=3.0.0` (aceita v3+)

---

## Lacunas e oportunidades

### Gap 56 — Zod v4 como devDependency mas peerDep aceita v3 (BUG DE COMPATIBILIDADE)

`package.json` tem `devDependencies: { "zod": "^4.3.6" }` e `peerDependencies: { "zod": ">=3.0.0" }`. O TypeScript compila contra Zod v4. Usuários com Zod v3 podem enfrentar incompatibilidades de tipo ao usar `tool()` — as interfaces `z.ZodRawShape` e `z.ZodObject<Schema>` têm diferenças internas entre v3 e v4 que afetam inferência de tipos. A peerDep deve ser restrita a `>=4.0.0` ou o código deve ser testado explicitamente com v3.

### Gap 57 — Múltiplas opções de `Options` não mapeadas em `buildCliArgs()`

Os seguintes campos existem na interface `Options` mas são silenciosamente ignorados por `buildCliArgs()`:

| Campo | Tipo | Flag CLI esperada |
|-------|------|-------------------|
| `agent` | `string` | `--agent <name>` |
| `agents` | `Record<string, AgentDefinition>` | `--agents-config <json>` |
| `fallbackModel` | `string` | `--fallback-model <id>` |
| `forkSession` | `boolean` | `--fork-session` |
| `includePartialMessages` | `boolean` | `--include-partial-messages` |
| `maxThinkingTokens` | `number` | `--max-thinking-tokens <n>` (inicial, antes do spawn) |
| `permissionPromptToolName` | `string` | `--permission-prompt-tool-name <name>` |
| `persistSession` | `boolean` | `--persist-session` |
| `promptSuggestions` | `boolean` | `--prompt-suggestions` |
| `resumeSessionAt` | `string` | `--resume-session-at <uuid>` |
| `settingSources` | `SettingSource[]` | `--setting-sources <list>` |
| `tools` | `string[] \| { type: "preset" }` | `--tools <list>` ou `--tools-preset claude_code` |

Usuários que configuram qualquer uma dessas opções assumem que funcionam — a ausência de erro e de comportamento é uma violação do princípio de menor surpresa.

### Gap 58 — `resolveExecutable()` ignora `Options.executable` e `Options.executableArgs`

A interface `Options` tem `executable?: "bun" | "deno" | "node"` e `executableArgs?: string[]` mas `resolveExecutable()` nunca os usa. O CLI do OpenClaude pode ser invocado com `node --experimental-vm-modules openclaude` por exemplo. Silenciosamente ignorado.

### Gap 59 — `startSdkServers()` muta o objeto `McpSdkServerConfig` compartilhado

Em `src/query.ts`, `startSdkServers()` faz:
```typescript
sdkConfig._localPort = port
```
diretamente no objeto `McpSdkServerConfig` passado pelo usuário. Se o mesmo objeto de configuração for reutilizado em múltiplas queries simultâneas (padrão comum em automações), a mutação da query anterior permanece no objeto. A segunda query leria `_localPort` da primeira query (que pode já estar fechada), causando falha de conexão ao MCP server.

### Gap 60 — `createSession()` não filtra opções conflitantes do caller

Em `session-v2.ts`, se o usuário passa `options: { resume: "old-session", sessionId: "old-id" }` para `createSession()`, essas opções são mergeadas sem filtragem. O primeiro turno passa `sessionId: userSessionId` mas também `resume: "old-session"`, criando comportamento ambíguo (o CLI pode tratar `--session-id` e `--resume` como conflitantes).

### Gap 61 — `thinking: { type: "adaptive" }` não mapeado em `buildCliArgs()`

`buildCliArgs()` trata apenas `enabled` e `disabled` para `thinking`:
```typescript
if (options.thinking?.type === "enabled") { ... }
else if (options.thinking?.type === "disabled") { ... }
```
O valor `"adaptive"` (auto-selecionar baseado no modelo) é silenciosamente ignorado — nenhuma flag é passada ao CLI.

### Gap 62 — `systemPrompt: { type: "preset", preset: "claude_code" }` não mapeado

O tipo `Options.systemPrompt` aceita `string | { type: "preset"; preset: "claude_code"; append?: string }` mas `buildCliArgs()` só trata `string` e `{ append: string }`:
```typescript
if (typeof options.systemPrompt === "string") { ... }
else if (options.systemPrompt.append) { ... }
```
O caso `{ type: "preset", preset: "claude_code" }` cai no `else if` sem `append`, resultando em nenhuma flag — o preset não é ativado.

### Gap 63 — Headers de `McpSSEServerConfig` e `McpHttpServerConfig` não passados ao CLI

As interfaces `McpSSEServerConfig` e `McpHttpServerConfig` têm campo `headers?: Record<string, string>` mas `buildCliArgs()` gera apenas `--mcp-server-sse name:URL`, sem transmitir os headers. Servidores MCP que requerem autenticação via header (e.g., `Authorization: Bearer <token>`) ficam inacessíveis.

### Gap 64 — README não documenta uso de MCP servers externos (stdio, SSE, HTTP)

O README tem seção detalhada de "MCP Tool Factories" (servidores inline) mas não há seção com exemplos práticos de MCP servers externos. O campo `mcpServers` aparece na tabela de Options mas sem exemplo de uso com stdio, SSE ou HTTP. Usuários que querem integrar servidores MCP externos (ex: Brave Search, databases) não têm referência.

### Gap 65 — Parser JSON não trata múltiplos JSONs concatenados na mesma linha

O parser em `process.ts` acumula linhas e tenta `JSON.parse(jsonBuffer)`. Se o CLI emitir dois JSONs completos na mesma linha (ex: `{"type":"a"}{"type":"b"}`), o parse falha e o buffer continua crescendo até atingir `MAX_BUFFER_SIZE` e lançar erro. Embora raro com o OpenClaude CLI em modo normal, pode ocorrer em situações de flush agressivo ou em testes. (Re-introdução do gap identificado no sprint-8 e dropped no sprint-9.)

### Gap 66 — `MAX_BUFFER_SIZE` hardcoded (1MB) sem configuração via Options

O limite de buffer para JSON multi-linha está fixo em `1_048_576` bytes. Prompts grandes com imagens base64 ou ferramentas que retornam dados binários extensos podem exceder 1MB legitimamente. Deveria ser configurável via `Options.maxBufferSize?: number`. (Re-introdução do gap do sprint-8.)

---

## Priorização

| ID | Tipo | Score | Justificativa |
|----|------|-------|---------------|
| D-056 | bug | 8 | Incompatibilidade de tipo entre Zod v3/v4 pode travar usuários em produção |
| D-057 | feature | 7 | Múltiplas opções silenciosamente ignoradas — viola princípio de menor surpresa |
| D-059 | bug | 7 | Mutação de objeto compartilhado causa falha silenciosa em multi-query |
| D-062 | bug | 6 | Preset de system prompt não ativado — comportamento errado sem erro |
| D-058 | improvement | 5 | Opções de runtime (executable/executableArgs) ignoradas |
| D-060 | bug | 5 | Opções conflitantes em createSession() causam comportamento ambíguo |
| D-061 | bug | 5 | thinking: adaptive ignorado silenciosamente |
| D-063 | improvement | 5 | Headers de MCP servers externos não transmitidos |
| D-064 | docs | 5 | Ausência de exemplos práticos de MCP servers externos |
| D-065 | bug | 5 | Parser JSON falha em linhas com múltiplos JSONs concatenados |
| D-066 | improvement | 3 | MAX_BUFFER_SIZE configurável para casos de payloads grandes |
