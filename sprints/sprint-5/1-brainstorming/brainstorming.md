# Brainstorming — openclaude-sdk (Sprint 5)

## Contexto

O TASK.md define o `openclaude-sdk` como um SDK TypeScript programático para o OpenClaude CLI: envio de prompts com streaming, controle de permissões mid-stream, gerenciamento de sessões, múltiplos providers via registry, e tratamento tipado de erros.

Esta é a **wave 5 / sprint 5**. As waves 1–4 implementaram D-001 a D-026 (feature set completo conforme o TASK.md). O sprint 4 focou exclusivamente em JSONL partial buffering (D-026), que está implementado em `src/process.ts` linhas 247–274 com `jsonBuffer` persistente, skip de não-JSON, e limite de 1 MB.

O foco desta wave é **polimento e correção de gaps remanescentes** — bugs sutis encontrados na análise do código atual, features do Options type que não foram conectadas ao CLI, e documentação incompleta.

---

## Funcionalidades mapeadas (estado atual da codebase)

### `src/process.ts`
- `resolveExecutable()` — resolve o comando `openclaude` com suporte Windows via `cmd /c`
- `filterEnv()` — filtra `undefined` values de um env parcial antes de passar ao child process
- `buildCliArgs()` — mapeia `Options` completo para args do CLI: output format, permissions, session, system prompt, allowed/disallowed tools, model, maxTurns, additionalDirectories, betas, effort, thinking, maxBudgetUsd, debug, extraArgs
- `spawnAndStream()` — spawn do processo, SIGINT/SIGTERM abort handling, timeout, stdin para prompt, readline JSONL parser com buffer acumulativo (D-026), stderr forwarding

### `src/query.ts`
- `query()` — interface principal: resolve registry+model → env, constrói CLI args, spawna processo, decora AsyncGenerator com `interrupt()`, `close()`, `respondToPermission()`
- `continueSession()` — wrapper que seta `resume: sessionId`
- `collectMessages()` — consome o generator completo, extrai sessionId/result/costUsd/durationMs, lança erros tipados para todos os subtypes conhecidos

### `src/errors.ts`
- Hierarquia: `OpenClaudeError` → `AuthenticationError`, `BillingError`, `RateLimitError` (com resetsAt/utilization), `InvalidRequestError`, `ServerError`, `MaxTurnsError`, `MaxBudgetError`, `ExecutionError`, `StructuredOutputError`
- `isRecoverable()` — classifica erros recuperáveis vs. fatais

### `src/registry.ts`
- `resolveModelEnv()` — mapeia provider type (openai, gemini, github, bedrock, vertex) para env vars do CLI. bedrock/vertex lançam erro explícito (não suportados)
- `createOpenRouterRegistry()` — factory para OpenRouter com validação de apiKey e models
- `resolveCommand()` — `@deprecated`, retorna "openclaude", ainda presente no arquivo mas não exportado pelo index.ts

### `src/sessions.ts`
- `sanitizePath()` — algoritmo Python-compatível: regex `[^a-zA-Z0-9]` → '-', truncação com simpleHash djb2 para paths > 200 chars
- `listSessions()` — deep search por padrão, ordena por lastModified desc, suporta limit
- `getSessionMessages()` — lê arquivo JSONL de uma sessão, filtra mensagens user/assistant, suporta offset/limit
- `getSessionInfo()` — busca sessão por sessionId via listSessions()
- `renameSession()` — append de `{"type":"custom_title","title":"..."}` no JSONL
- `tagSession()` — append de `{"type":"tag","tag":"..."}` no JSONL

### `src/types/`
- Tipos completos para mensagens (SDKMessage discriminated union), Options (interface completa com ~30 campos), Provider/ProviderRegistry, Sessions, Tools

---

## Lacunas e Oportunidades

### Gap 29 — `getSessionMessages()` não encontra sessões sem `dir` (BUG FUNCIONAL, CRÍTICO)

**Arquivo**: `src/sessions.ts`, função `getSessionMessages()`, linha ~214

**Problema**: Quando chamada sem `options.dir`, a função busca em `getProjectsDir()` raiz (`~/.claude/projects/`) por `{sessionId}.jsonl`. Porém todas as sessões vivem em **subdiretorios** como `~/.claude/projects/-my-project-/{sessionId}.jsonl`. A busca no root sempre retorna `[]`.

**Caso de uso quebrado**:
```typescript
const sessions = await listSessions()           // funciona — deep search
const msgs = await getSessionMessages(sessions[0].sessionId)  // retorna [] — BUG
```

**Fix**: Ao não receber `dir`, fazer busca profunda idêntica à de `listSessions()`: iterar subdirs e procurar `{sessionId}.jsonl` em cada um.

Alternativamente, `SDKSessionInfo` poderia expor o `projectDir` interno (o subdir sanitizado onde o arquivo está), para que o caller passe na opção `dir`.

### Gap 30 — Mutação do objeto `options` em `query()` quando registry é fornecido (BUG)

**Arquivo**: `src/query.ts`, linha 50

```typescript
options.env = { ...options.env, ...envFromRegistry }  // muta o objeto do caller
```

**Problema**: Se o caller reutilizar o mesmo objeto `options` para múltiplas queries com diferentes models/registries, o `env` acumula indefinidamente. Cada nova query adiciona vars do registry anterior ao env atual.

**Fix**: Não mutar `options`. Criar cópia local:
```typescript
const resolvedOptions: Options = { ...options, env: { ...options.env, ...envFromRegistry } }
```

### Gap 31 — `timeoutMs` ausente da API pública (OMISSÃO)

**Arquivo**: `src/query.ts` + `src/types/options.ts`

**Problema**: `spawnAndStream()` aceita `timeoutMs` como parâmetro interno mas `query()` nunca o passa. O `Options` também não tem o campo. Usuários que precisam de timeout são forçados a criar um `AbortController` e `setTimeout()` manualmente fora da SDK.

**Fix**: Adicionar `timeoutMs?: number` ao `Options` e passá-lo em `query()` → `spawnAndStream()`.

### Gap 32 — `mcpServers` em Options ignorado silenciosamente em `buildCliArgs()` (OMISSÃO)

**Arquivo**: `src/process.ts`, função `buildCliArgs()`

**Problema**: `Options.mcpServers?: Record<string, McpServerConfig>` está tipado e documentado no tipo, mas `buildCliArgs()` não o mapeia para nenhum flag CLI. Usuários que configuram MCP servers via `options.mcpServers` não veem nenhum efeito.

O OpenClaude CLI herda de Claude Code e suporta `--mcp-server` para servidores stdio e `--mcp-server-sse` para SSE. O mapeamento existe no código de referência Python.

**Fix**: Implementar o mapeamento de `McpStdioServerConfig` e `McpSSEServerConfig` para os flags corretos do CLI.

### Gap 33 — README incompleto: hierarquia de erros, Options, respondToPermission (DOCUMENTAÇÃO)

**Arquivo**: `README.md`

**Problema**: O README cobre `query()`, `continueSession()`, registry, sessions. Faltam:
1. Seção de **Error Handling** com exemplos de captura de `RateLimitError`, `AuthenticationError`, uso de `isRecoverable()`
2. Seção de **Options reference** com tabela dos campos principais (allowedTools, thinking, debug, maxBudgetUsd, permissionMode, etc.)
3. Exemplo de **permission mid-stream** com `respondToPermission()` em plan mode
4. Seção de **Typed errors** explicando a hierarquia completa

### Gap 34 — `deleteSession()` ausente do session management (FEATURE FALTANTE)

**Arquivo**: `src/sessions.ts` + `src/index.ts`

**Problema**: O módulo de session management tem renomeação e tagging, mas não tem deleção. Usuários que precisam de cleanup de sessões antigas (quota de storage, histórico sensível) não têm como fazê-lo pela SDK — precisam manipular arquivos diretamente.

**Fix**: `deleteSession(sessionId, options?)` que localiza e remove o arquivo JSONL correspondente.

---

## Priorização

| ID | Tipo | Descrição | Score | Justificativa |
|----|------|-----------|-------|---------------|
| D-031 | bug | `getSessionMessages()` sempre retorna `[]` quando sem `dir` — sessões inacessíveis sem deep search | 9 | Bug funcional que quebra o fluxo mais natural: listar sessões → ler mensagens. Usuário não tem como saber que precisa de `dir`. |
| D-030 | bug | Mutação de `options.env` em `query()` quando registry + model são fornecidos | 7 | Bug de reusabilidade: reutilizar opções entre queries acumula env vars. Silencioso e difícil de debugar. |
| D-033 | docs | README incompleto — falta hierarquia de erros, Options reference, respondToPermission | 6 | O TASK.md define README.md como entregável. Gaps em documentação de DX são impactantes para adotantes. |
| D-029 | feature | `timeoutMs` ausente do Options público e não conectado ao `spawnAndStream()` | 6 | Feature documentada nos internals mas inacessível. Usuários de automação precisam de timeouts. |
| D-032 | feature | `mcpServers` em Options silenciosamente ignorado em `buildCliArgs()` | 5 | Divergência entre tipo e comportamento real — viola princípio de menor surpresa. |
| D-034 | feature | `deleteSession()` ausente — não há como remover sessões via SDK | 4 | CRUD incompleto; usuários precisam acessar filesystem diretamente para limpeza. |
| D-027 | improvement | Split de múltiplos JSONs concatenados por linha (carry-over sprint 4) | 3 | Readline do Node já divide por \n — cenário improvável na prática. |
| D-028 | improvement | `MAX_BUFFER_SIZE` configurável via `Options.maxBufferSize` (carry-over sprint 4) | 3 | 1 MB é suficiente para qualquer JSON real do CLI. Adiciona complexidade por pouco benefício. |
