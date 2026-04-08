# Brainstorming — openclaude-sdk (Sprint 2)

## Contexto

O TASK.md desta wave é uma **revisão de qualidade** do código produzido na wave anterior. A nota geral é 7.5/10 — boa arquitetura, precisa de hardening. O objetivo é corrigir os problemas críticos e médios identificados na revisão antes de publicar a SDK.

Não há novos artefatos a criar — todos os artefatos de sprint-1 (package, README, src/) existem e passam no build. O escopo é corretivo e de hardening.

## Funcionalidades já implementadas (sprint-1, todas passing)

Todos os 21 features de sprint-1 foram implementados:
- **F-001** — Fontes copiadas do protótipo para `src/`
- **F-002** — package.json, tsconfig.json, tsup.config.ts configurados
- **F-003** — Build, typecheck e validação passando
- **F-004 a F-007** — `buildCliArgs()` completo: array flags, scalar flags, structured output (`--json-schema`), extraArgs passthrough
- **F-008** — Fix permissionMode duplicado
- **F-009 a F-011** — Hierarquia de erros tipados (`errors.ts`), `isRecoverable()`, integração em `collectMessages()`
- **F-012 a F-014** — SIGINT interrupt, `resolveExecutable()`, cleanup de `spawnAndStream()`
- **F-015 a F-016** — `listSessions()` com deep search, `continueSession()`
- **F-017 a F-019** — Tipo `PermissionResponse`, `respondToPermission()`, stdin aberto em plan mode
- **F-020 a F-021** — Refactor `spawnAndStream`, README documentação

## Lacunas e Oportunidades

### Gap 11 — Cast inseguro de `options.env` (CRÍTICO)

**Arquivo**: `process.ts:165`, `query.ts:58`

`options.env` é tipado como `Record<string, string | undefined>`, mas é castado diretamente para `Record<string, string>` antes de ser espalhado no env do processo filho. Isso:
1. Perde type safety — o compilador não vê o problema
2. Pode passar `undefined` como valor de variável de ambiente, causando comportamento inesperado no child process

O fix correto é filtrar as entradas `undefined` antes do spread: `Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined))`.

### Gap 12 — Flag `--allowedTools` vs `--allowed-tools` (CRÍTICO)

**Arquivo**: `process.ts:74,79`

O código usa `--allowedTools` (camelCase) e `--disallowedTools`, mas CLIs Unix convencionalmente usam kebab-case (`--allowed-tools`, `--disallowed-tools`). Se o CLI real espera kebab-case, as ferramentas nunca são passadas corretamente e o CLI ignora silenciosamente. É necessário verificar o comportamento real do CLI e ajustar.

### Gap 13 — Switch sem default em `collectMessages()` (CRÍTICO)

**Arquivo**: `query.ts:141-170`

Dois switches em `collectMessages()` não têm caso `default`:
1. Switch em `msg.subtype` (result errors) — subtypes novos/desconhecidos somem silenciosamente
2. Switch em `msg.error` (assistant errors) — tipos de erro não mapeados são ignorados

O fix é adicionar `default: throw new ExecutionError(...)` em ambos os switches, garantindo que nenhum erro desconhecido seja engolido.

### Gap 14 — Bedrock/Vertex não tratados em `resolveModelEnv()` (CRÍTICO)

**Arquivo**: `registry.ts:21-42`

O tipo `Provider` inclui `"bedrock"` e `"vertex"` como valores válidos para `provider.type`, mas o switch em `resolveModelEnv()` não os trata — cai no `default` (retorna só `OPENAI_MODEL`). Isso significa que providers bedrock e vertex passam silenciosamente sem configurar as env vars corretas, causando falha silenciosa de autenticação.

O fix é adicionar cases para `"bedrock"` e `"vertex"` (com as env vars conhecidas de cada provider) ou lançar um erro explícito se não suportados.

### Gap 15 — `encodeCwd` gera colisões (CRÍTICO)

**Arquivo**: `sessions.ts:22-24`

```ts
function encodeCwd(dir: string): string {
  return resolve(dir).replace(/[^a-zA-Z0-9]/g, "-")
}
```

Paths distintos mapeiam para o mesmo encoded string. Exemplo:
- `/foo/bar` → `-foo-bar`
- `/foo-bar` → `-foo-bar` ← **COLISÃO**

O fix é usar um separador que nunca ocorre naturalmente em nomes de arquivo, como `_` em vez de `-`, ou melhor ainda, um hash do caminho resolvido (ex: sha1 curto). Alternativamente, usar um encoding que seja reversível, como substituir `/` por `__` e `-` por `_d_`.

### Gap 16 — `respondToPermission` sem validação nem guard de processo vivo (MÉDIO)

**Arquivo**: `query.ts:73-79`

O método `respondToPermission()` chama `writeStdin(payload + "\n")` sem verificar:
1. Se o processo ainda está vivo (pode ter sido encerrado antes)
2. Se `toolUseId` e `behavior` são válidos/não-vazios

Escrever em stdin de processo morto pode lançar um erro EPIPE não tratado.

### Gap 17 — Env merge não filtra `undefined` values (MÉDIO)

**Arquivo**: `query.ts:49-51`

```ts
options.env = { ...options.env, ...envFromRegistry }
```

`envFromRegistry` é `Record<string, string>` (sem undefined), mas `options.env` pode ter `undefined` values. Após o merge, o objeto resultante pode ter `undefined` values que serão passados ao processo filho.

Relacionado ao Gap 11 — a correção do env filtering deve ser aplicada neste ponto também.

### Gap 18 — `createOpenRouterRegistry` aceita inputs inválidos (MÉDIO)

**Arquivo**: `registry.ts:49-71`

A função aceita `apiKey: ""` (string vazia) e `models: []` (array vazio) sem reclamar. Isso causa:
- `defaultModel: ""` — modelo padrão inválido
- Queries subsequentes falharão com erro de autenticação ou "model not found", não no ponto de configuração

O fix é validar: lançar `Error` se `apiKey` for vazio ou se `models` for array vazio.

### Gap 19 — Dynamic imports dentro de função (MÉDIO)

**Arquivo**: `sessions.ts:256,275`

`renameSession()` e `tagSession()` fazem `await import("node:fs/promises")` dentro do corpo da função. Isso é desnecessário em Node.js moderno — a importação dinâmica não tem vantagem sobre o import estático no topo do arquivo. Piora a legibilidade e adiciona overhead de resolução a cada chamada.

O fix é mover o import para o topo do arquivo (já existem outros imports estáticos de `node:fs/promises` no mesmo arquivo).

### Gap 20 — Internals expostos na API pública (MÉDIO)

**Arquivo**: `index.ts:41`

`buildCliArgs`, `spawnAndStream` e `resolveExecutable` são exportados como API pública. São internals de implementação — consumidores da SDK não deveriam depender deles. Expô-los cria contratos implícitos que dificultam refactoring futuro.

O fix é remover essas exportações do `index.ts`. Usuários avançados que precisem de acesso podem importar diretamente de `./process.js`.

### Gap 21 — Catch vazio engole erros legítimos (MÉDIO)

**Arquivo**: `process.ts:237-241`

```ts
try {
  const parsed = JSON.parse(trimmed) as SDKMessage
  yield parsed
} catch {
  // Linha nao-JSON — debug output do CLI, ignorar
}
```

O catch ignora **qualquer** exceção do bloco try, incluindo erros do `yield parsed` (ex: generator cancelado, erro de downstream). Isso esmaga erros legítimos que deveriam propagar.

O fix é ser específico: só ignorar `SyntaxError` de JSON.parse, e deixar outros erros propagar.

## Priorização

| ID | Discovery | Score | Justificativa |
|----|-----------|-------|---------------|
| D-015 | Corrigir `encodeCwd` — colisões de path | 9 | Corrupção silenciosa de dados: duas sessões de projetos distintos podem sobrescrever uma à outra. Bug crítico de correctness. |
| D-013 | Adicionar default ao switch em `collectMessages()` | 8 | Erros desconhecidos somem silenciosamente — a query retorna `result: null` sem nenhuma indicação de falha. |
| D-014 | Tratar Bedrock/Vertex em `resolveModelEnv()` | 8 | Providers declarados no tipo mas sem implementação — falha silenciosa de auth. O tipo mente ao consumidor. |
| D-011 | Fix unsafe cast de `options.env` | 7 | `undefined` em env vars do processo filho pode causar comportamento indefinido. Perde type safety garantida pelo compilador. |
| D-012 | Verificar `--allowedTools` vs `--allowed-tools` | 7 | Se o flag estiver errado, ferramentas permitidas nunca são passadas ao CLI. Falha silenciosa crítica para segurança. |
| D-021 | Catch específico para SyntaxError em process.ts | 6 | Catch genérico pode esconder erros de generator/downstream que deveriam propagar. |
| D-016 | Guard de processo vivo em `respondToPermission()` | 5 | EPIPE não tratado pode crashar o processo consumidor da SDK. |
| D-017 | Filtrar undefined no env merge em query.ts | 5 | Relacionado a D-011 — mesmo problema no ponto de merge do registry env. |
| D-018 | Validação de inputs em `createOpenRouterRegistry()` | 4 | Fail-fast: melhor errar na configuração do que em runtime na primeira query. |
| D-019 | Mover dynamic imports para top-level em sessions.ts | 3 | Overhead mínimo e questão de estilo. Baixo risco se não corrigido. |
| D-020 | Remover internals da API pública | 3 | Quebra de contrato apenas em semver major. Baixo risco imediato, mas dívida técnica. |
