# openclaude-sdk - Integracao richOutput em Options e query.ts

Adicionar `richOutput?: boolean` a interface `Options` e integrar em `query()`: merge de MCP server display + append de system prompt cobrindo 3 formatos.

---

## Objetivo

Resolver D-076 (score 9), D-077 (score 9) e D-078 (score 8): adicionar a flag de entrada, implementar a funcao `mergeSystemPromptAppend()` e integrar tudo em `query.ts` de modo que `richOutput: true` ative o modulo display automaticamente.

| # | Discovery | Acao |
|---|-----------|------|
| 1 | D-076 | Campo `richOutput?: boolean` em `Options` (default `false`) |
| 2 | D-078 | `mergeSystemPromptAppend()` cobrindo 3 formatos de `systemPrompt` |
| 3 | D-077 | Hook em `query()` antes de `lifecycleGenerator()`: criar display server + merge |

**Dependencia**: S-066 (server + barrel do modulo display).

---

## Estado Atual

**Arquivo**: `src/types/options.ts`, linhas 268-317

```typescript
export interface Options {
  // ... (nao tem richOutput)
  mcpServers?: Record<string, McpServerConfig>           // linha 296
  systemPrompt?:                                          // linhas 310-312
    | string
    | { type: "preset"; preset: "claude_code"; append?: string }
}
```

**Arquivo**: `src/query.ts`, linhas 117-146

```typescript
export function query(params: { prompt, model?, registry?, options? }): Query {
  const { prompt, model, registry, options = {} } = params
  let resolvedOptions = options
  // ... registry resolve, MCP env propagation ...
  // ← ponto de insercao: richOutput hook vai AQUI, antes de resolveExecutable()
}
```

---

## Implementacao

### 1. Adicionar `richOutput` a `Options`

**Arquivo**: `src/types/options.ts`

**Antes** (linha 316):

```typescript
  tools?: string[] | { type: "preset"; preset: "claude_code" }
}
```

**Depois**:

```typescript
  tools?: string[] | { type: "preset"; preset: "claude_code" }
  richOutput?: boolean
}
```

### 2. Criar `mergeSystemPromptAppend()` em `src/display/prompt.ts`

**Arquivo**: `src/display/prompt.ts` (ja existe com `DISPLAY_SYSTEM_PROMPT` — adicionar a funcao)

Tipo do systemPrompt:

```typescript
type SystemPromptValue =
  | undefined
  | string
  | { type: "preset"; preset: "claude_code"; append?: string }
```

Funcao:

```typescript
export function mergeSystemPromptAppend(
  existing: SystemPromptValue,
  append: string,
): NonNullable<SystemPromptValue> {
  if (existing === undefined) {
    return { type: "preset", preset: "claude_code", append }
  }
  if (typeof existing === "string") {
    return existing + "\n\n" + append
  }
  // { type: "preset", preset: "claude_code", append?: string }
  return {
    ...existing,
    append: existing.append ? existing.append + "\n\n" + append : append,
  }
}
```

### 3. Integrar em `query()`

**Arquivo**: `src/query.ts`

Adicionar bloco apos a propagacao de env de MCP stdio (linhas 132-146), antes de `resolveExecutable()` (linha 148):

```typescript
  // Rich output: inject display MCP server + system prompt append
  if (resolvedOptions.richOutput) {
    const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
      await import("./display/index.js")
    const displayServer = await createDisplayMcpServer()

    const existingServers = resolvedOptions.mcpServers ?? {}
    if ("display" in existingServers) {
      console.warn('[openclaude-sdk] richOutput: overriding existing "display" MCP server')
    }

    resolvedOptions = {
      ...resolvedOptions,
      mcpServers: { ...existingServers, display: displayServer },
      systemPrompt: mergeSystemPromptAppend(resolvedOptions.systemPrompt, DISPLAY_SYSTEM_PROMPT),
    }
  }
```

**Nota**: import dinamico (`await import(...)`) para manter zero-overhead quando `richOutput` e `false` ou ausente — o modulo `display/` so e carregado quando necessario.

**Problema**: `query()` e sincrono — retorna `Query` (um `AsyncGenerator`). O `await import()` precisa acontecer dentro do `lifecycleGenerator()` (que ja e `async function*`), nao no corpo sincrono de `query()`.

**Correcao**: mover o hook de richOutput para dentro de `lifecycleGenerator()`, antes do `startSdkServers()`:

```typescript
async function* lifecycleGenerator(): AsyncGenerator<SDKMessage, void> {
  try {
    let opts = resolvedOptions

    // Rich output hook (inside async context)
    if (opts.richOutput) {
      const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
        await import("./display/index.js")
      const displayServer = await createDisplayMcpServer()
      const existingServers = opts.mcpServers ?? {}
      if ("display" in existingServers) {
        console.warn('[openclaude-sdk] richOutput: overriding existing "display" MCP server')
      }
      opts = {
        ...opts,
        mcpServers: { ...existingServers, display: displayServer },
        systemPrompt: mergeSystemPromptAppend(opts.systemPrompt, DISPLAY_SYSTEM_PROMPT),
      }
    }

    // Start SDK servers (existing code, agora usando opts em vez de resolvedOptions)
    let optionsForCli = opts
    if (opts.mcpServers) {
      const { running, portMap } = await startSdkServers(opts.mcpServers)
      // ...
    }
  }
}
```

---

## Criterios de Aceite

- [ ] `Options.richOutput?: boolean` existe em `src/types/options.ts`
- [ ] `mergeSystemPromptAppend()` exportada de `src/display/prompt.ts`
- [ ] Merge cobre `undefined` → preset com append
- [ ] Merge cobre `string` → concatenacao com `\n\n`
- [ ] Merge cobre `{ type: "preset", append? }` → concatenacao no append
- [ ] `query()` com `richOutput: false` (ou ausente) nao carrega modulo display (zero overhead)
- [ ] `query()` com `richOutput: true` injeta MCP server "display" + system prompt
- [ ] Se `mcpServers` ja tem chave `"display"`, emite `console.warn` e sobrescreve
- [ ] `mcpServers` existentes do usuario sao preservados (nao sobrescritos)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `Options.richOutput` | S-067 |
| `mergeSystemPromptAppend()` | S-067 |
| `src/display/prompt.ts` | S-067 |
| `src/query.ts` (lifecycleGenerator) | S-067 |
| Discovery | D-076, D-077, D-078 |
