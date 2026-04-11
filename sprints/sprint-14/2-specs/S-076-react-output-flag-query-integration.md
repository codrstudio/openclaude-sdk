# openclaude-sdk - Flag reactOutput e integracao em query.ts

Spec da flag `reactOutput?: boolean` em `Options` e sua integracao no bloco `richOutput` de `query.ts`.

---

## Objetivo

Resolve D-094 e D-097.

| Problema | Consequencia |
|----------|-------------|
| Interface `Options` nao tem `reactOutput` | Sem ponto de entrada para ativar a feature |
| Bloco `richOutput` em `query.ts` nao faz merge do `REACT_OUTPUT_SYSTEM_PROMPT` | Modelo nunca recebe instrucoes sobre action `react` mesmo com flag ativa |

---

## Estado Atual

### `src/types/options.ts` (linhas 307-309)

```typescript
export interface Options {
  // ...
  richOutput?: boolean
  askUser?: boolean
  askUserTimeoutMs?: number
  // ...
}
```

Sem `reactOutput`.

### `src/query.ts` (linhas 221-236)

```typescript
if (optionsForCli.richOutput) {
  const { createDisplayMcpServer, DISPLAY_SYSTEM_PROMPT, mergeSystemPromptAppend } =
    await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("display" in existingServers) {
    console.warn("[openclaude-sdk] mcpServers already has a 'display' key — overriding with built-in display server")
  }

  optionsForCli = {
    ...optionsForCli,
    mcpServers: { ...existingServers, display: displayServer },
    systemPrompt: mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT),
  }
}
```

O bloco importa `DISPLAY_SYSTEM_PROMPT` e faz um unico merge. Nao ha segundo merge para React.

---

## Implementacao

### 1. Flag `reactOutput` em `Options`

Em `src/types/options.ts`, adicionar logo apos `richOutput`:

```typescript
richOutput?: boolean
reactOutput?: boolean   // NEW — so tem efeito quando richOutput tambem e true
askUser?: boolean
askUserTimeoutMs?: number
```

### 2. Integracao em `query.ts`

Alterar o bloco `if (optionsForCli.richOutput)` para:

```typescript
if (optionsForCli.richOutput) {
  const {
    createDisplayMcpServer,
    DISPLAY_SYSTEM_PROMPT,
    REACT_OUTPUT_SYSTEM_PROMPT,
    mergeSystemPromptAppend,
  } = await import("./display/index.js")
  const displayServer = await createDisplayMcpServer()

  const existingServers = optionsForCli.mcpServers ?? {}
  if ("display" in existingServers) {
    console.warn("[openclaude-sdk] mcpServers already has a 'display' key — overriding with built-in display server")
  }

  let mergedPrompt = mergeSystemPromptAppend(optionsForCli.systemPrompt, DISPLAY_SYSTEM_PROMPT)

  if (optionsForCli.reactOutput) {
    mergedPrompt = mergeSystemPromptAppend(mergedPrompt, REACT_OUTPUT_SYSTEM_PROMPT)
  }

  optionsForCli = {
    ...optionsForCli,
    mcpServers: { ...existingServers, display: displayServer },
    systemPrompt: mergedPrompt,
  }
}
```

### 3. Comportamento de gate

| `richOutput` | `reactOutput` | Resultado |
|---|---|---|
| `false` / ausente | qualquer | Nada injetado (zero overhead) |
| `true` | `false` / ausente | Display tools ativadas **sem** prompt React |
| `true` | `true` | Display tools ativadas **com** prompt React |

**`reactOutput: true` sem `richOutput: true` e ignorado em silencio** — o `if (optionsForCli.richOutput)` externo ja cuida disso. Nao adicionar warn nem erro.

### 4. Schema no MCP server permanece estatico

A action `react` **sempre** existe no `visualSchema` do MCP server `display` — independente de `reactOutput`. O que muda e apenas o system prompt. Isso simplifica tipos e evita variantes do server.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/types/options.ts` | L307 (interface Options) | + `reactOutput?: boolean` |
| `src/query.ts` | L221-236 (bloco richOutput) | + import `REACT_OUTPUT_SYSTEM_PROMPT`, + segundo `mergeSystemPromptAppend` condicional |

---

## Criterios de Aceite

- [ ] `Options.reactOutput?: boolean` existe em `src/types/options.ts`
- [ ] `query.ts` importa `REACT_OUTPUT_SYSTEM_PROMPT` do `./display/index.js`
- [ ] Quando `richOutput: true` + `reactOutput: true`, system prompt contem ambos os blocos (display base + regras React)
- [ ] Quando `richOutput: true` + `reactOutput: false/absent`, system prompt contem apenas display base — nada de React injetado
- [ ] Quando `richOutput: false/absent` + `reactOutput: true`, nada e injetado (gate silencioso, sem warn)
- [ ] MCP server `display` sempre registra action `react` no schema, independente de `reactOutput`
- [ ] `tsc --noEmit` passa
- [ ] `tsup` builda sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `Options.reactOutput` | S-076 |
| `query.ts` bloco richOutput (segundo merge) | S-076 |
| Gate silencioso (reactOutput sem richOutput) | S-076 |
| D-094 | S-076 |
| D-097 | S-076 |
