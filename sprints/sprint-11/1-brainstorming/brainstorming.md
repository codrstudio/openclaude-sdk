# Brainstorming — openclaude-sdk (Sprint 11)

## Contexto

O TASK.md do sprint-11 define como meta a **V2 Session API** — uma interface simplificada multi-turn com `createSession`, `resumeSession`, `prompt` e objeto `SDKSession` com `send()`, `stream()`, `close()` e suporte a `await using`.

Sprints 1–10 cobriram a implementação completa da API pública, incluindo:
- Core API (`query()`, `collectMessages()`, `continueSession()`)
- V2 Session API (`createSession`, `resumeSession`, `prompt`)
- Error hierarchy tipada
- Provider/Model registry com OpenRouter
- MCP tool factories inline (`tool()`, `createSdkMcpServer()`)
- Query control/introspection/operation methods (20+ métodos)
- Lifecycle management de SDK MCP servers
- Documentação completa no README.md

Sprint 10 foi uma **wave de polimento**, identificando 11 gaps residuais (D-056 a D-066). Destes, D-060 (filtrar opções conflitantes em `createSession()`) foi implementado como parte da implementação D-044/D-045, apesar de constar como `impl=False` no ranking.

---

## Funcionalidades mapeadas (estado atual)

### `src/session-v2.ts` — V2 Session API

Implementação existente:

- **`createSession(opts: CreateSessionOptions): SDKSession`**
  - Gera `sessionId` via `randomUUID()` ou usa o fornecido
  - Primeiro turno usa `{ sessionId }`, turnos seguintes usam `{ resume: sessionId }`
  - Filtra `resume`, `sessionId`, `continue` de `opts.options` e `turnOptions` (D-060 resolvido)
  - Suporte a `await using` via `[Symbol.asyncDispose]`

- **`resumeSession(sessionId, opts): SDKSession`**
  - Sempre passa `resume: sessionId` em cada turno
  - Mesma filtragem de conflitos

- **`prompt(text, opts): Promise<{ result, sessionId, costUsd, durationMs }>`**
  - One-shot sem gerenciamento de sessão

- **Interface `SDKSession`**:
  - `send(prompt, turnOptions?): Query` — retorna `Query` iterável (AsyncGenerator)
  - `collect(prompt, turnOptions?): Promise<{ messages, result, costUsd, durationMs }>`
  - `close(): Promise<void>`
  - `[Symbol.asyncDispose](): Promise<void>`

### Diferença entre spec TASK.md e implementação atual

O TASK.md especifica:
```typescript
interface SDKSession {
  send(message: string | SDKUserMessage): Promise<void>  // não retorna nada
  stream(): AsyncGenerator<SDKMessage, void>             // método separado
}
```

A implementação atual é diferente e **mais ergonômica**:
```typescript
interface SDKSession {
  send(prompt: string, turnOptions?: Partial<Options>): Query  // retorna Query (AsyncGenerator)
  collect(prompt, turnOptions?): Promise<...>                   // conveniência
}
```

O design atual é superior: `send()` retornando `Query` permite iterar diretamente sem precisar de `stream()` separado. O `collect()` oferece a conveniência de aguardar o resultado completo.

### Lacunas vs. TASK.md

1. **`SDKUserMessage` não aceito em `send()`** — TASK.md especifica `send(message: string | SDKUserMessage)` mas a implementação aceita apenas `string`. `SDKUserMessage` tem `content: ContentBlock[]` que poderia incluir imagens.

2. **`stream()` não existe como método separado** — TASK.md especifica `stream(): AsyncGenerator`. A implementação retorna `Query` diretamente de `send()`, o que é equivalente mas não segue o contrato da spec. Um alias `stream()` que retorna o último `Query` poderia ser adicionado para compatibilidade.

3. **`prompt()` não retorna `SDKResultMessage` completo** — TASK.md especifica `Promise<SDKResultMessage>` mas a implementação retorna `{ result, sessionId, costUsd, durationMs }` (formato interno). Usuários que esperem o tipo oficial ficam sem tipagem correta.

---

## Lacunas e oportunidades

### D-067 — `SDKSession.send()` não aceita `SDKUserMessage` (apenas string)

A interface atual aceita apenas `string`. O TASK.md define `string | SDKUserMessage` para permitir conteúdo multi-modal (imagens, tool results). Usuários que queiram enviar imagens via `createSession()` ficam sem essa capacidade.

**Impacto**: Médio — a maioria dos casos é text-only, mas casos com visão/imagens são bloqueados.

### D-068 — `prompt()` one-shot não retorna `SDKResultMessage` completo

O TASK.md especifica `Promise<SDKResultMessage>`, mas a implementação retorna um subconjunto do resultado. `SDKResultMessage` inclui campos adicionais (`is_error`, `subtype`, `usage`) que ficam inacessíveis.

**Impacto**: Baixo — o subconjunto retornado cobre 95% dos casos de uso.

### D-069 — Ergonomia de `CreateSessionOptions`: nesting desnecessário de `options`

`CreateSessionOptions` tem `options?: Options`, criando nesting: `createSession({ options: { model: "..." } })`. O campo `model` está ao nível raiz mas outros campos de `Options` ficam um nível abaixo. Poderia ser achatado ou documentado melhor.

**Impacto**: Baixo — ergonomia leve, não é bug.

### D-070 — `SDKSession` não expõe `activeQuery` para cancelamento externo

Um consumidor não consegue acessar a `Query` ativa para chamar `abort()` diretamente sem usar `close()`. Poderia existir um getter `currentQuery?: Query` para casos avançados.

**Impacto**: Baixo — `close()` já resolve o caso de uso de cancelamento.

---

## Gaps carregados do Sprint 10 (ainda não implementados)

| ID | Tipo | Desc resumida |
|----|------|---------------|
| D-056 | bug | Zod v4 no devDep mas peerDep aceita v3 — incompatibilidade de tipo |
| D-057 | feature | 12+ opções de `Options` ignoradas por `buildCliArgs()` |
| D-058 | improvement | `Options.executable` e `executableArgs` ignorados em `resolveExecutable()` |
| D-059 | bug | `startSdkServers()` muta `McpSdkServerConfig._localPort` compartilhado |
| D-061 | bug | `thinking: { type: "adaptive" }` não mapeado em `buildCliArgs()` |
| D-062 | bug | `systemPrompt: { type: "preset" }` não mapeado em `buildCliArgs()` |
| D-063 | improvement | Headers de `McpSSEServerConfig`/`McpHttpServerConfig` não transmitidos ao CLI |
| D-064 | docs | README sem seção de MCP servers externos (stdio, SSE, HTTP) com exemplos |
| D-065 | bug | Parser JSON falha em múltiplos JSONs concatenados na mesma linha |
| D-066 | improvement | `MAX_BUFFER_SIZE` hardcoded (1MB), deveria ser configurável via `Options` |

---

## Priorização

| ID | Tipo | Score | Justificativa |
|----|------|-------|---------------|
| D-059 | bug | 7 | Mutação de objeto compartilhado causa falha silenciosa em multi-query concorrente |
| D-056 | bug | 7 | Incompatibilidade Zod v3/v4 pode travar usuários em produção |
| D-057 | feature | 7 | 12+ opções silenciosamente ignoradas violam princípio de menor surpresa |
| D-062 | bug | 6 | System prompt preset não ativado — comportamento errado sem erro visível |
| D-067 | feature | 5 | `send()` aceitar `SDKUserMessage` para suporte multi-modal em sessões V2 |
| D-061 | bug | 5 | thinking adaptive ignorado — sem erro, sem comportamento |
| D-065 | bug | 5 | Parser JSON pode corromper stream em edge cases de flush |
| D-063 | improvement | 5 | Headers de MCP externos não transmitidos — bloqueia auth em MCP servers reais |
| D-058 | improvement | 4 | executable/executableArgs ignorados — limita customização de runtime |
| D-068 | improvement | 4 | `prompt()` deveria retornar tipo completo `SDKResultMessage` |
| D-064 | docs | 4 | Ausência de exemplos de MCP externos dificulta adoção |
| D-066 | improvement | 3 | MAX_BUFFER_SIZE configurável — edge case com payloads grandes |
| D-069 | improvement | 2 | Ergonomia de `CreateSessionOptions` — nesting desnecessário |
| D-070 | improvement | 2 | Getter `currentQuery` em `SDKSession` — caso de uso avançado raro |
