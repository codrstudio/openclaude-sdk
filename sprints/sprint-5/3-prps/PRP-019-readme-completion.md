# PRP-019 — README Completion

## Objetivo

Completar o README.md com tres secoes ausentes criticas para DX: Error Handling, Options Reference e Permission Mid-Stream.

Referencia: spec S-023 (D-033).

## Execution Mode

`documentar`

## Contexto

O README.md cobre `query()`, `continueSession()`, registry e sessions, mas falta documentacao essencial:

1. **Error Handling** — a SDK tem uma hierarquia de erros tipados (`src/errors.ts`) com `isRecoverable()`, mas o README nao documenta nenhum deles
2. **Options Reference** — nao ha tabela consolidada dos campos de `Options`
3. **Permission Mid-Stream** — `respondToPermission()` existe mas nao ha exemplo de uso em plan mode

## Especificacao

### 1. Secao Error Handling

Inserir apos a secao de Sessions. Conteudo obrigatorio:

**Hierarquia de erros** (diagrama textual):

```
OpenClaudeError
├── AuthenticationError      (fatal)
├── BillingError             (fatal)
├── RateLimitError           (recuperavel — tem resetsAt, utilization)
├── InvalidRequestError      (fatal)
├── ServerError              (recuperavel)
├── MaxTurnsError            (fatal)
├── MaxBudgetError           (fatal)
├── ExecutionError           (fatal)
└── StructuredOutputError    (fatal)
```

**Tabela de erros**: nome, tipo (fatal/recuperavel), quando ocorre.

**Exemplo de captura** com `instanceof` e `isRecoverable()`:

```typescript
import { query, collectMessages, isRecoverable, RateLimitError } from "openclaude-sdk"

try {
  const result = await collectMessages(query({ prompt: "Hello" }))
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Resets at: ${err.resetsAt}`)
  }
  if (isRecoverable(err)) {
    // Retry logic
  } else {
    // Fatal — do not retry
    throw err
  }
}
```

### 2. Secao Options Reference

Inserir apos Error Handling. Formato: tabela markdown com campos principais.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `cwd` | `string` | Diretorio de trabalho do agente |
| `model` | `string` | Model override |
| `systemPrompt` | `string \| { append }` | System prompt ou append ao default |
| `allowedTools` | `string[]` | Tools permitidas |
| `disallowedTools` | `string[]` | Tools bloqueadas |
| `maxTurns` | `number` | Limite de turnos |
| `maxBudgetUsd` | `number` | Limite de custo em USD |
| `timeoutMs` | `number` | Timeout em ms |
| `permissionMode` | `PermissionMode` | Modo de permissoes |
| `thinking` | `ThinkingConfig` | Configuracao de thinking |
| `effort` | `string` | Nivel de esforco |
| `debug` | `boolean` | Ativa output de debug |
| `mcpServers` | `Record<string, McpServerConfig>` | Servidores MCP |
| `env` | `Record<string, string>` | Vars de ambiente para o child process |
| `resume` | `string` | Session ID para retomar |
| `outputFormat` | `{ type, schema }` | JSON schema para structured output |

### 3. Secao Permission Mid-Stream

Inserir apos Options Reference. Exemplo completo:

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Create a new file called hello.txt",
  options: { permissionMode: "plan" },
})

for await (const msg of q) {
  if (msg.type === "assistant" && msg.stop_reason === "tool_use") {
    q.respondToPermission({
      toolUseId: msg.tool_use_id,
      behavior: "allow",
      message: "Approved by automation",
    })
  }
}
```

Explicar:
- `permissionMode: "plan"` mantem stdin aberto para respostas
- `respondToPermission()` envia a decisao ao processo
- `behavior: "deny"` rejeita a acao e o agente tenta alternativa

### Regras de escrita

- Manter o tom e formatacao do README existente
- Exemplos em TypeScript com imports explicitos
- Nao duplicar conteudo que ja existe nas secoes atuais
- Texto em ingles (README e publico, convencao npm)
- Atualizar table of contents se existir

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-043 | readmeCompletion | Adicionar secoes Error Handling, Options Reference e Permission Mid-Stream ao README.md |

## Limites

- NAO reescrever secoes existentes do README
- NAO adicionar secoes alem das tres especificadas
- NAO documentar internals (buildCliArgs, spawnAndStream, etc.)
- NAO traduzir para portugues — README em ingles

## Dependencias

- **PRP-017** (F-041): documenta `timeoutMs` na tabela de Options
- **PRP-018** (F-042): documenta `mcpServers` na tabela de Options
