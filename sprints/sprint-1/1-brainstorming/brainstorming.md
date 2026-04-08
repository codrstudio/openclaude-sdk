# Brainstorming — openclaude-sdk (Sprint 1)

## Contexto

O projeto cria a `openclaude-sdk`: uma biblioteca TypeScript que encapsula o OpenClaude CLI (um coding-agent CLI) em uma API de alto nível, orientada a eventos, para consumo em aplicações Node.js/TypeScript.

O TASK.md define três artefatos finais:
- `README.md` — documentação da interface pública da SDK
- `proto/sdk/` — protótipo da SDK (já existe, é a referência de implementação)
- `proto/demo/` — exemplo de uso (já existe, é a referência de integração)

O protótipo (`proto/sdk/`) é a referência principal: mostra o que foi validado e deve ser a base para a SDK de produção.

## Funcionalidades já implementadas (no protótipo)

O protótipo (`proto/sdk/src/`) tem as seguintes funcionalidades validadas:

### Core
- **`query()`** — função principal, retorna `AsyncGenerator<SDKMessage>` com métodos extras (`interrupt()`, `close()`). Aceita prompt, model, registry e Options.
- **`collectMessages()`** — helper que coleta todas as mensagens de um generator e retorna resultado estruturado (messages, sessionId, result, costUsd, durationMs).
- **`spawnAndStream()`** — gerencia subprocess do openclaude CLI, lê JSONL do stdout via readline, suporta abort via AbortController, timeout, Windows compat via `cmd /c`.
- **`buildCliArgs()`** — mapeia o objeto `Options` para flags CLI: `-p -`, `--verbose`, `--output-format stream-json`, `--dangerously-skip-permissions`, `--permission-mode`, `--resume`, `--continue`, `--session-id`, `--system-prompt`, `--append-system-prompt`, `--allowedTools`, `--disallowedTools`, `--model`, `--max-turns`, `--debug`.

### Provider/Model Registry
- **`createOpenRouterRegistry()`** — factory para criar registry com OpenRouter como provider
- **`resolveModelEnv()`** — mapeia provider type (openai/gemini/github) para env vars do openclaude CLI (CLAUDE_CODE_USE_OPENAI, OPENAI_BASE_URL, OPENAI_MODEL, etc.)
- **`resolveCommand()`** — sempre retorna "openclaude"

### Session Management
- **`listSessions()`** — lista sessões do diretório `~/.claude/projects/`, ordena por lastModified
- **`getSessionMessages()`** — lê mensagens de uma sessão por sessionId
- **`getSessionInfo()`** — retorna metadados de uma sessão
- **`renameSession()`** — appenda `{type: "custom_title"}` ao arquivo JSONL
- **`tagSession()`** — appenda `{type: "tag"}` ao arquivo JSONL

### Tipos
Sistema completo de tipos TypeScript espelhando `@anthropic-ai/claude-agent-sdk`:
- `SDKMessage` union com ~20 variantes (assistant, user, result, system/init, system/status, hooks, tasks, rate_limit, etc.)
- `Options` — interface com ~35 campos para configurar o CLI
- `Provider`, `Model`, `ProviderRegistry` — tipos do registry
- `SDKSessionInfo`, `SessionMessage`, `ListSessionsOptions`, etc.

### Demo (proto/demo/)
- Servidor Hono com SSE streaming das mensagens SDK
- Workspace isolation por sessão (diretório separado por sessão)
- Seleção de modelo por sessão e por mensagem
- Suporte a imagens (salvas em tmpdir, referenciadas no prompt)
- Plan mode (modo interativo, sem `--dangerously-skip-permissions`)
- Gestão de sessões em memória com binding para CLI session ID

## Lacunas e Oportunidades

### Gap 1 — Package não está configurado para distribuição
O `package.json` do protótipo está como `@claude-chat/sdk-3` (private). A SDK de produção precisa de nome correto (`openclaude-sdk`), campo `exports` configurado, build com `tsup` (ESM + CJS + DTS), e um `package.json` completo com `main`, `module`, `types`.

### Gap 2 — Sem README da SDK
O `README.md` do diretório de artefatos é de outro projeto (claude-chat). A SDK precisa de sua própria documentação de API pública: como instalar, como usar `query()`, exemplos básicos, referência de tipos principais.

### Gap 3 — `buildCliArgs()` incompleto
Vários campos do `Options` existem como tipos mas não são mapeados para flags CLI:
- `additionalDirectories` → `--add-dir`
- `mcpServers` → `--mcp-config` (ou arquivo de config temporário)
- `betas` → `--beta`
- `outputFormat` → `--json-schema` (para structured output)
- `effort` → `--effort`
- `thinking` → `--thinking`
- `extraArgs` → passagem direta de args adicionais

### Gap 4 — Sem suporte a structured output (`--json-schema`)
O protótipo define o tipo `outputFormat` em Options mas não implementa o mapeamento para `--json-schema`. Para o `agentic-workflow` (que usa `--json-schema` no merge de worktrees), isso é necessário.

### Gap 5 — Hierarquia de erros tipados ausente
Falhas durante a query (auth, rate limit, billing, invalid_request) chegam como `SDKResultMessage` com `subtype: "error_*"` ou como `SDKAssistantMessage` com campo `error`. Não há classes de erro exportadas para facilitar o tratamento programático.

### Gap 6 — Permission mid-stream (plan mode) sem suporte real
O demo tem um endpoint stub `/permission` com nota de que "Permission responses via stdin require plan mode with stream-json input. The SDK currently doesn't expose stdin for mid-stream writes." Em plan mode, o CLI espera input pelo stdin para approve/deny. A SDK não expõe esse canal.

### Gap 7 — `listSessions()` não faz deep search
A função só lê arquivos JSONL no diretório imediato de um projeto (encoding do cwd). Se `dir` não for especificado, lista só o root `~/.claude/projects/`. Não itera pelos subdiretórios de projetos.

### Gap 8 — Interrupt usa SIGTERM em vez de SIGINT
O `interrupt()` no `Query` chama `abortController.abort()` que mata o processo com SIGTERM. O CLI pode esperar SIGINT (Ctrl+C) para interromper graciosamente e salvar histórico. Precisa testar e ajustar o sinal.

### Gap 9 — Duplicação na resolução do comando Windows
`resolveCommand()` retorna "openclaude" mas o `spawnAndStream()` tem sua própria lógica de Windows (cmd /c). `pathToClaudeCodeExecutable` em Options também pode sobrescrever. Essa sobreposição de três mecanismos é confusa e pode causar bugs.

### Gap 10 — Sem `continueSession()` de alto nível
O `query()` tem `options.resume` e `options.continue`, mas não há uma função de conveniência que carrega o sessionId de uma sessão existente e continua automaticamente. O demo gerencia isso manualmente com estado em memória.

## Priorização

| ID | Discovery | Score | Justificativa |
|----|-----------|-------|---------------|
| D-001 | Configuração do package para distribuição | 9 | Pré-requisito para qualquer uso fora do monorepo. Sem build correto, a SDK não é utilizável. |
| D-002 | README da SDK (documentação da API pública) | 9 | TASK.md define README.md como artefato obrigatório da wave. |
| D-003 | Completar `buildCliArgs()` com flags ausentes | 7 | `additionalDirectories`, `betas`, `effort` são usados em produção. `outputFormat`/`--json-schema` é usado pelo agentic-workflow. |
| D-004 | Suporte a structured output (`--json-schema`) | 7 | Funcionalidade crítica para uso programático com schemas JSON. Já usado no agentic-workflow. |
| D-005 | Hierarquia de erros tipados | 6 | DX: consumidores da SDK precisam distinguir auth errors de rate limits de erros de execução. |
| D-006 | Permission mid-stream stdin (plan mode) | 5 | Feature importante mas complexa. Requer expor stdin do subprocess para o chamador. |
| D-007 | `listSessions()` com deep search | 5 | Útil quando `dir` não é especificado e o usuário quer listar todas as sessões de todos os projetos. |
| D-008 | Interrupt com SIGINT correto | 5 | Correção de comportamento: SIGTERM pode não salvar histórico; SIGINT é o sinal esperado pelo CLI. |
| D-009 | Deduplicar resolução de comando Windows | 4 | Refactor de limpeza: eliminar ambiguidade entre resolveCommand, pathToClaudeCodeExecutable e spawnAndStream. |
| D-010 | `continueSession()` convenience function | 4 | DX: evita que chamadores gerenciem sessionId manualmente para resumir sessões. |
