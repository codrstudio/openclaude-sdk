# PRP-007 — README e Documentacao da API Publica

## Objetivo

Produzir o `README.md` da SDK com documentacao completa da API publica, exemplos de uso e referencia de tipos.

Referencia: spec S-007 (D-002).

## Execution Mode

`documentar`

## Contexto

O TASK.md define `README.md` como artefato obrigatorio. A SDK precisa de documentacao para ser utilizavel por consumidores externos. Este PRP deve ser executado por ultimo, apos todas as features estarem implementadas, para documentar a API final.

## Especificacao

### Estrutura do README

O README deve conter as seguintes secoes, nesta ordem:

#### 1. Header
- Titulo: `openclaude-sdk`
- Descricao de uma linha: "TypeScript SDK wrapper for the OpenClaude CLI"

#### 2. Installation

```markdown
## Installation

\`\`\`bash
npm install openclaude-sdk
\`\`\`

Requires Node.js >= 20 and the [OpenClaude CLI](https://github.com/Gitlawb/openclaude) installed.
```

#### 3. Quick Start

Exemplo minimo com `query()` + `for await`:

```typescript
import { query } from "openclaude-sdk"

const q = query({ prompt: "Hello, world!" })

for await (const message of q) {
  if (message.type === "assistant") {
    console.log(message.message.content)
  }
}
```

#### 4. API Reference — Funcoes

Tabela com todas as funcoes exportadas, assinatura e descricao. Cada funcao deve ter pelo menos um exemplo de uso em bloco de codigo TypeScript.

Funcoes a documentar:
- `query()` — funcao principal
- `collectMessages()` — coleta todas as mensagens
- `continueSession()` — conveniencia para continuar sessao
- `createOpenRouterRegistry()` — factory para OpenRouter
- `resolveModelEnv()` — resolve env vars para modelo
- `listSessions()` — lista sessoes (mencionar deep search)
- `getSessionMessages()` — le mensagens de sessao
- `getSessionInfo()` — metadados de sessao
- `renameSession()` — renomeia sessao
- `tagSession()` — adiciona tag

#### 5. Options

Tabela com os campos de `Options` agrupados por categoria:

| Categoria | Campos a documentar |
|-----------|---------------------|
| Execucao | `cwd`, `model`, `maxTurns`, `maxBudgetUsd`, `effort` |
| Permissoes | `permissionMode`, `allowDangerouslySkipPermissions`, `allowedTools`, `disallowedTools` |
| Sessao | `resume`, `continue`, `sessionId` |
| Prompt | `systemPrompt` |
| Output | `outputFormat` (structured output com `--json-schema`) |
| Avancado | `additionalDirectories`, `betas`, `extraArgs`, `env`, `pathToClaudeCodeExecutable` |

#### 6. Error Handling

- Listar todas as classes de erro exportadas
- Exemplo com try/catch e `isRecoverable()`
- Tabela de erros recuperaveis vs fatais

#### 7. Provider Registry

Exemplo completo com OpenRouter mostrando `createOpenRouterRegistry()` + `query()`.

#### 8. Session Management

Exemplo de `listSessions()` com deep search e `continueSession()`.

#### 9. Plan Mode (Permission Handling)

Exemplo de `respondToPermission()` em plan mode.

### Regras de formato

| Regra | Detalhe |
|-------|---------|
| Idioma | Ingles |
| Exemplos | TypeScript com imports explicitos |
| Links | Link para repo OpenClaude nos pre-requisitos |
| Localizacao | `README.md` na raiz do repositorio |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-021 | README.md | Produzir documentacao completa da API publica |

## Limites

- NAO gerar documentacao automatica (typedoc, etc.) — README manual
- NAO documentar internals (spawnAndStream, buildCliArgs, etc.) — apenas API publica
- NAO incluir changelog ou roadmap

## Dependencias

- **PRP-001** — projeto configurado
- **PRP-002** — CLI args completos (para documentar Options)
- **PRP-003** — erros tipados (para documentar Error Handling)
- **PRP-004** — process fixes (para documentar interrupt behavior)
- **PRP-005** — session improvements (para documentar continueSession e deep search)
- **PRP-006** — permission stdin (para documentar plan mode)
