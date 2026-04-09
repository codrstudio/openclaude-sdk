# PRP-034 — buildCliArgs Option Mapping

## Objetivo

Mapear 12 campos de `Options` silenciosamente ignorados por `buildCliArgs()`, corrigir o mapeamento de `systemPrompt` preset e `thinking: adaptive`, e transmitir headers de MCP servers externos.

Referencia: specs S-049 (D-057), S-051 (D-062), S-054 (D-061), S-055 (D-063).

## Execution Mode

`implementar`

## Contexto

`buildCliArgs()` em `src/process.ts` converte um objeto `Options` em flags CLI para o OpenClaude. Diversas opcoes sao aceitas pela interface TypeScript sem erro, mas nao geram nenhuma flag — o CLI nunca as recebe. Isso viola o principio de menor surpresa: o usuario configura algo, nao recebe erro, mas a opcao nao tem efeito.

Estado atual do codigo relevante:

1. **12 campos nao mapeados** (S-049): `agent`, `agents`, `fallbackModel`, `forkSession`, `includePartialMessages`, `maxThinkingTokens`, `permissionPromptToolName`, `persistSession`, `promptSuggestions`, `resumeSessionAt`, `settingSources`, `tools` — todos definidos em `Options` (linhas 268-316 de `src/types/options.ts`) mas sem case em `buildCliArgs()`.

2. **systemPrompt preset** (S-051): `buildCliArgs()` linhas 78-84 tratam `string` e `{ append }` mas nao `{ type: "preset", preset: "claude_code" }` — o preset e ignorado silenciosamente.

3. **thinking: adaptive** (S-054): linhas 128-132 tratam `enabled` e `disabled` mas nao `adaptive` — silenciosamente ignorado.

4. **MCP server headers** (S-055): linhas 159-161 geram `--mcp-server-sse name:URL` para servers SSE/HTTP mas nao transmitem o campo `headers?: Record<string, string>` definido em `McpSSEServerConfig` e `McpHttpServerConfig`.

## Especificacao

### Feature F-077 — Mapear 12 campos Options ausentes em buildCliArgs

**1. Adicionar mapeamento em `src/process.ts`, funcao `buildCliArgs()`, apos o bloco de `debug` (linha 142) e antes de `mcpServers` (linha 145):**

```typescript
// Agent
if (options.agent) {
  args.push("--agent", options.agent)
}

// Agents config
if (options.agents && Object.keys(options.agents).length > 0) {
  args.push("--agents-config", JSON.stringify(options.agents))
}

// Fallback model
if (options.fallbackModel) {
  args.push("--fallback-model", options.fallbackModel)
}

// Fork session
if (options.forkSession) {
  args.push("--fork-session")
}

// Include partial messages
if (options.includePartialMessages) {
  args.push("--include-partial-messages")
}

// Max thinking tokens
if (options.maxThinkingTokens != null) {
  args.push("--max-thinking-tokens", String(options.maxThinkingTokens))
}

// Permission prompt tool name
if (options.permissionPromptToolName) {
  args.push("--permission-prompt-tool-name", options.permissionPromptToolName)
}

// Persist session
if (options.persistSession) {
  args.push("--persist-session")
}

// Prompt suggestions (inverted: false means --no-prompt-suggestions)
if (options.promptSuggestions === false) {
  args.push("--no-prompt-suggestions")
}

// Resume session at
if (options.resumeSessionAt) {
  args.push("--resume-session-at", options.resumeSessionAt)
}

// Setting sources
if (options.settingSources && options.settingSources.length > 0) {
  args.push("--setting-sources", options.settingSources.join(","))
}

// Tools
if (options.tools) {
  if (Array.isArray(options.tools)) {
    args.push("--tools", options.tools.join(","))
  } else if (options.tools.type === "preset") {
    args.push("--tools-preset", options.tools.preset)
  }
}
```

**Notas de implementacao:**

- `promptSuggestions` usa logica invertida: o campo `true` e o padrao do CLI (nenhuma flag necessaria), `false` gera `--no-prompt-suggestions`
- `agents` e serializado como JSON — o CLI espera um JSON string com as definicoes
- `tools` tem dois formatos: array de strings gera `--tools name1,name2`, objeto preset gera `--tools-preset claude_code`
- Campos `undefined` nao geram flags (guards com `if` garantem isso)

### Feature F-078 — Mapear systemPrompt preset

**1. Alterar bloco de systemPrompt em `src/process.ts` (linhas 78-84):**

Estado atual:
```typescript
if (options.systemPrompt) {
  if (typeof options.systemPrompt === "string") {
    args.push("--system-prompt", options.systemPrompt)
  } else if (options.systemPrompt.append) {
    args.push("--append-system-prompt", options.systemPrompt.append)
  }
}
```

Novo:
```typescript
if (options.systemPrompt) {
  if (typeof options.systemPrompt === "string") {
    args.push("--system-prompt", options.systemPrompt)
  } else {
    if ("type" in options.systemPrompt && options.systemPrompt.type === "preset") {
      args.push("--system-prompt-preset", options.systemPrompt.preset)
    }
    if (options.systemPrompt.append) {
      args.push("--append-system-prompt", options.systemPrompt.append)
    }
  }
}
```

Mudancas:
- Adicionar check para `type === "preset"` que gera `--system-prompt-preset claude_code`
- Preset e append NAO sao mutuamente exclusivos — ambas as flags podem ser geradas
- Manter comportamento identico para `string` e `{ append }` sem preset

### Feature F-079 — Mapear thinking: adaptive

**1. Simplificar bloco de thinking em `src/process.ts` (linhas 128-132):**

Estado atual:
```typescript
if (options.thinking?.type === "enabled") {
  args.push("--thinking", "enabled")
} else if (options.thinking?.type === "disabled") {
  args.push("--thinking", "disabled")
}
```

Novo:
```typescript
if (options.thinking) {
  args.push("--thinking", options.thinking.type)
}
```

Justificativa: o tipo `ThinkingConfig` (linha 200-203 de `options.ts`) e uma union discriminada que garante que `type` so pode ser `"adaptive"`, `"enabled"` ou `"disabled"`. Todos os tres valores sao validos para a flag `--thinking`. A simplificacao elimina o risco de esquecer novos valores futuros.

### Feature F-080 — Transmitir headers de MCP servers externos

**1. Alterar bloco SSE/HTTP em `buildCliArgs()`, `src/process.ts` (linhas 159-161):**

Estado atual:
```typescript
} else if (config.type === "sse" || config.type === "http") {
  const remote = config as McpSSEServerConfig | McpHttpServerConfig
  args.push("--mcp-server-sse", `${name}:${remote.url}`)
}
```

Novo:
```typescript
} else if (config.type === "sse" || config.type === "http") {
  const remote = config as McpSSEServerConfig | McpHttpServerConfig
  args.push("--mcp-server-sse", `${name}:${remote.url}`)
  if (remote.headers) {
    for (const [headerName, headerValue] of Object.entries(remote.headers)) {
      args.push("--mcp-server-header", `${name}:${headerName}:${headerValue}`)
    }
  }
}
```

Mudancas:
- Apos gerar `--mcp-server-sse`, iterar sobre `headers` se presentes
- Formato da flag: `--mcp-server-header <server-name>:<header-name>:<value>`
- Sem headers, comportamento identico ao atual

**Nota**: o formato exato da flag `--mcp-server-header` deve ser verificado contra o CLI do OpenClaude. Se o formato divergir, ajustar conforme a documentacao do CLI.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `options.agent = "coder"` | Ignorado | `--agent coder` |
| `options.agents = { x: {...} }` | Ignorado | `--agents-config {"x":{...}}` |
| `options.tools = ["Read", "Write"]` | Ignorado | `--tools Read,Write` |
| `options.tools = { type: "preset", preset: "claude_code" }` | Ignorado | `--tools-preset claude_code` |
| `options.promptSuggestions = false` | Ignorado | `--no-prompt-suggestions` |
| `options.promptSuggestions = true` | Ignorado | Nenhuma flag (padrao do CLI) |
| `options.systemPrompt = { type: "preset", preset: "claude_code" }` | Ignorado | `--system-prompt-preset claude_code` |
| `options.systemPrompt = { type: "preset", preset: "claude_code", append: "Be concise" }` | `--append-system-prompt "Be concise"` | `--system-prompt-preset claude_code --append-system-prompt "Be concise"` |
| `options.thinking = { type: "adaptive" }` | Ignorado | `--thinking adaptive` |
| `options.thinking = { type: "enabled" }` | `--thinking enabled` | `--thinking enabled` (identico) |
| MCP SSE server com `headers: { Authorization: "Bearer tk" }` | Ignorado | `--mcp-server-header name:Authorization:Bearer tk` |
| MCP SSE server sem headers | `--mcp-server-sse name:url` | `--mcp-server-sse name:url` (identico) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-077 | mapUnmappedOptions | Mapear 12 campos `Options` para flags CLI: agent, agents, fallbackModel, forkSession, includePartialMessages, maxThinkingTokens, permissionPromptToolName, persistSession, promptSuggestions, resumeSessionAt, settingSources, tools |
| F-078 | mapSystemPromptPreset | Tratar `systemPrompt: { type: "preset", preset: "claude_code" }` gerando `--system-prompt-preset` |
| F-079 | mapThinkingAdaptive | Simplificar bloco thinking para `args.push("--thinking", options.thinking.type)` cobrindo `adaptive` |
| F-080 | mapMcpServerHeaders | Iterar sobre `headers` de MCP SSE/HTTP servers e gerar `--mcp-server-header` para cada |

## Limites

- NAO alterar `resolveExecutable()` — mapeamento de executable e escopo de PRP-035
- NAO alterar o tratamento de MCP servers tipo `sdk` ou `stdio` — apenas SSE/HTTP recebem headers
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar `src/types/options.ts` — todos os campos ja existem na interface
- NAO alterar nenhum outro arquivo alem de `src/process.ts`

## Dependencias

Nenhuma dependencia de outros PRPs do sprint-10. Independente.
