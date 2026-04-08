# openclaude-sdk - README e Documentacao da API Publica

Produzir README.md da SDK com documentacao completa da API publica.

---

## Objetivo

Resolver D-002: o TASK.md define README.md como artefato obrigatorio. A SDK precisa de documentacao de API publica para ser utilizavel.

---

## Estrutura do README

| Secao | Conteudo |
|-------|----------|
| Titulo + badge | Nome, versao, badge de build |
| Instalacao | `npm install openclaude-sdk` |
| Quick Start | Exemplo minimo com `query()` |
| API Reference | Todas as funcoes exportadas |
| Types | Tipos principais |
| Provider Registry | Como configurar providers alternativos |
| Session Management | Como listar/continuar sessoes |
| Error Handling | Classes de erro e `isRecoverable()` |
| Advanced | `extraArgs`, `outputFormat`, plan mode |

---

## Secoes Obrigatorias

### 1. Instalacao

```markdown
## Installation

\`\`\`bash
npm install openclaude-sdk
\`\`\`

Requires Node.js >= 20 and the [OpenClaude CLI](https://github.com/Gitlawb/openclaude) installed.
```

### 2. Quick Start

Exemplo com `query()` + `for await`:

```typescript
import { query } from "openclaude-sdk"

const q = query({ prompt: "Hello, world!" })

for await (const message of q) {
  if (message.type === "assistant") {
    console.log(message.message.content)
  }
}
```

### 3. API Reference — Funcoes

| Funcao | Assinatura | Descricao |
|--------|------------|-----------|
| `query()` | `(params: QueryParams) => Query` | Funcao principal, retorna AsyncGenerator de SDKMessage |
| `collectMessages()` | `(q: Query) => Promise<CollectResult>` | Coleta todas as mensagens e retorna resultado estruturado |
| `continueSession()` | `(params: ContinueParams) => Query` | Conveniencia para continuar sessao existente |
| `createOpenRouterRegistry()` | `(config) => ProviderRegistry` | Factory para OpenRouter como provider |
| `resolveModelEnv()` | `(registry, modelId) => Record<string, string>` | Resolve env vars para um modelo |
| `listSessions()` | `(options?) => Promise<SDKSessionInfo[]>` | Lista sessoes do CLI |
| `getSessionMessages()` | `(sessionId, options?) => Promise<SessionMessage[]>` | Le mensagens de uma sessao |
| `getSessionInfo()` | `(sessionId, options?) => Promise<SDKSessionInfo \| undefined>` | Metadados de sessao |
| `renameSession()` | `(sessionId, title, options?) => Promise<void>` | Renomeia sessao |
| `tagSession()` | `(sessionId, tag, options?) => Promise<void>` | Adiciona tag a sessao |

### 4. API Reference — Options

Tabela com os campos mais usados de `Options`, agrupados por categoria:

| Categoria | Campos |
|-----------|--------|
| Execucao | `cwd`, `model`, `maxTurns`, `maxBudgetUsd`, `effort` |
| Permissoes | `permissionMode`, `allowDangerouslySkipPermissions`, `allowedTools`, `disallowedTools` |
| Sessao | `resume`, `continue`, `sessionId` |
| Prompt | `systemPrompt` |
| Output | `outputFormat` (structured output) |
| Avancado | `additionalDirectories`, `betas`, `extraArgs`, `env`, `pathToClaudeCodeExecutable` |

### 5. Error Handling

Exemplo de uso com try/catch e `isRecoverable()`.

### 6. Provider Registry

Exemplo com OpenRouter mostrando `createOpenRouterRegistry()` + `query()`.

---

## Requisitos de Formato

| Regra | Detalhe |
|-------|---------|
| Idioma | Ingles (README e para consumo publico) |
| Exemplos de codigo | TypeScript com imports explicitos |
| Cada funcao | Pelo menos um exemplo de uso |
| Links | Link para repo OpenClaude no pre-requisito |

---

## Criterios de Aceite

- [ ] README.md esta na raiz do repositorio
- [ ] Secao de instalacao com `npm install`
- [ ] Quick start com exemplo funcional minimo
- [ ] Todas as funcoes publicas documentadas com assinatura e exemplo
- [ ] Options documentadas por categoria
- [ ] Secao de error handling com classes de erro
- [ ] Secao de provider registry com exemplo OpenRouter
- [ ] Secao de session management
- [ ] Idioma ingles
- [ ] Pre-requisito: Node >= 20 + OpenClaude CLI

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `README.md` | S-007 |
| Discovery | D-002 |
