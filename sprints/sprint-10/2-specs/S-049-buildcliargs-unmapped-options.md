# openclaude-sdk - Mapear Options Ignoradas em buildCliArgs

Adicionar mapeamento CLI para 12 campos de `Options` que sao tipados mas silenciosamente ignorados por `buildCliArgs()`.

---

## Objetivo

Resolver D-057 (score 7): multiplos campos da interface `Options` existem e sao aceitos sem erro, mas `buildCliArgs()` nao os converte em flags CLI. Usuarios configuram essas opcoes assumindo que funcionam — a ausencia de erro e de comportamento viola o principio de menor surpresa.

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `buildCliArgs()`, linhas 48-177

Os seguintes campos de `Options` nao tem mapeamento:

| Campo | Tipo | Flag CLI esperada |
|-------|------|-------------------|
| `agent` | `string` | `--agent <name>` |
| `agents` | `Record<string, AgentDefinition>` | `--agents-config <json>` |
| `fallbackModel` | `string` | `--fallback-model <id>` |
| `forkSession` | `boolean` | `--fork-session` |
| `includePartialMessages` | `boolean` | `--include-partial-messages` |
| `maxThinkingTokens` | `number` | `--max-thinking-tokens <n>` |
| `permissionPromptToolName` | `string` | `--permission-prompt-tool-name <name>` |
| `persistSession` | `boolean` | `--persist-session` |
| `promptSuggestions` | `boolean` | `--prompt-suggestions` |
| `resumeSessionAt` | `string` | `--resume-session-at <uuid>` |
| `settingSources` | `SettingSource[]` | `--setting-sources <list>` |
| `tools` | `string[] \| { type: "preset" }` | `--tools <list>` ou `--tools-preset claude_code` |

---

## Implementacao

### 1. Adicionar mapeamentos em `buildCliArgs()`

**Arquivo**: `src/process.ts`, inserir antes do bloco `// Extra args` (linha 166)

```typescript
// Agent
if (options.agent) {
  args.push("--agent", options.agent)
}

// Agents config
if (options.agents) {
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

// Prompt suggestions
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

### 2. Nenhuma mudanca em tipos

Todos os campos ja existem na interface `Options` em `src/types/options.ts`.

---

## Notas de Implementacao

- `promptSuggestions` usa logica invertida: o campo e `boolean` mas a flag CLI e `--no-prompt-suggestions` (desabilita). Mapear apenas quando `false`.
- `agents` serializa o record inteiro como JSON — o CLI espera `--agents-config '{...}'`.
- `tools` tem duas formas: array de strings (`--tools tool1,tool2`) ou preset (`--tools-preset claude_code`).

---

## Criterios de Aceite

- [ ] Todos os 12 campos listados geram flags CLI corretas quando configurados
- [ ] Campos `undefined` ou vazios nao geram flags
- [ ] `promptSuggestions: true` nao gera flag (comportamento padrao do CLI)
- [ ] `promptSuggestions: false` gera `--no-prompt-suggestions`
- [ ] `tools` como array gera `--tools <list>`
- [ ] `tools` como preset gera `--tools-preset claude_code`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` | S-049 |
| 12 campos de `Options` | S-049 |
| Discovery | D-057 |
