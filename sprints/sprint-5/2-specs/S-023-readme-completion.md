# openclaude-sdk - Completar README.md

Adicionar secoes ausentes ao README: Error Handling, Options Reference e Permission Mid-Stream.

---

## Objetivo

Resolver D-033 (score 6): o README.md cobre `query()`, `continueSession()`, registry e sessions, mas falta documentacao critica para DX:

1. **Error Handling** — hierarquia de erros, `isRecoverable()`, exemplos de captura
2. **Options Reference** — tabela dos campos principais
3. **Permission Mid-Stream** — exemplo de `respondToPermission()` em plan mode

---

## Secoes a Adicionar

### 1. Error Handling

Inserir apos a secao de Sessions. Conteudo:

| Subsecao | Conteudo |
|----------|----------|
| Hierarquia | Diagrama textual: `OpenClaudeError` → subclasses |
| Tabela de erros | Nome, tipo (fatal/recuperavel), quando ocorre |
| Exemplo de captura | `try/catch` com `instanceof` e `isRecoverable()` |
| `isRecoverable()` | Explicacao: retorna `true` para `RateLimitError`, `ServerError`; `false` para `AuthenticationError`, `BillingError`, etc. |

#### Hierarquia de erros (estado atual em `src/errors.ts`)

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

#### Exemplo de codigo para o README

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

### 2. Options Reference

Inserir apos Error Handling. Formato: tabela com campos mais usados.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `cwd` | `string` | Diretorio de trabalho do agente |
| `model` | `string` | Model override (ex: `"claude-sonnet-4-5-20250514"`) |
| `systemPrompt` | `string \| { append }` | System prompt ou append ao default |
| `allowedTools` | `string[]` | Tools permitidas |
| `disallowedTools` | `string[]` | Tools bloqueadas |
| `maxTurns` | `number` | Limite de turnos |
| `maxBudgetUsd` | `number` | Limite de custo em USD |
| `timeoutMs` | `number` | Timeout em ms (S-020) |
| `permissionMode` | `PermissionMode` | Modo de permissoes (`"plan"`, `"bypassPermissions"`, `"dontAsk"`) |
| `thinking` | `ThinkingConfig` | Configuracao de thinking (`enabled`/`disabled`/`adaptive`) |
| `effort` | `string` | Nivel de esforco (`"low"`, `"medium"`, `"high"`, `"max"`) |
| `debug` | `boolean` | Ativa output de debug |
| `mcpServers` | `Record<string, McpServerConfig>` | Servidores MCP (S-021) |
| `env` | `Record<string, string>` | Vars de ambiente adicionais para o child process |
| `resume` | `string` | Session ID para retomar |
| `outputFormat` | `{ type, schema }` | JSON schema para structured output |

Nota: incluir `timeoutMs` e `mcpServers` assumindo que S-020 e S-021 serao implementadas neste sprint.

### 3. Permission Mid-Stream

Inserir apos Options Reference. Conteudo:

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Create a new file called hello.txt",
  options: { permissionMode: "plan" },
})

for await (const msg of q) {
  if (msg.type === "assistant" && msg.stop_reason === "tool_use") {
    // Agente solicita permissao para usar uma ferramenta
    q.respondToPermission({
      toolUseId: msg.tool_use_id,
      behavior: "allow",         // ou "deny"
      message: "Approved by automation",
    })
  }
}
```

Explicar que:
- `permissionMode: "plan"` mantem stdin aberto para respostas
- `respondToPermission()` envia a decisao ao processo
- `behavior: "deny"` rejeita a acao e o agente tenta alternativa

---

## Regras de Escrita

- Manter o tom e formatacao do README existente
- Exemplos em TypeScript com imports explicitos
- Nao duplicar conteudo que ja existe nas secoes atuais
- Manter compatibilidade com o indice (table of contents) existente, se houver

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `README.md` | Adicionar 3 secoes: Error Handling, Options Reference, Permission Mid-Stream |

---

## Criterios de Aceite

- [ ] Secao Error Handling com hierarquia, tabela e exemplo de `isRecoverable()`
- [ ] Secao Options Reference com tabela dos campos principais
- [ ] Secao Permission Mid-Stream com exemplo de `respondToPermission()`
- [ ] Exemplos de codigo compilam conceitualmente (imports corretos, tipos alinhados)
- [ ] Texto em ingles (README e publico, alinhado com convencao npm)
- [ ] Sem duplicacao com conteudo existente

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Secao Error Handling | S-023 |
| Secao Options Reference | S-023 |
| Secao Permission Mid-Stream | S-023 |
| Discovery | D-033 |
| Dependencias (campos documentados) | S-020, S-021 |
