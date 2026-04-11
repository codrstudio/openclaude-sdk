# Ask User Tool — Human-in-the-loop mid-stream

Built-in opcional que permite ao agente **pausar e perguntar algo ao usuario** no meio da execucao, recebendo a resposta de volta e continuando. Diferente do plan mode (que e aprovacao binaria de tool use), o `ask_user` e solicitacao de **input semantico**: "qual o orcamento?", "qual a data preferida?", "confirma o nome do projeto?".

---

## Contexto

O openclaude-sdk hoje suporta dois mecanismos de interacao durante a execucao:

1. **Plan mode** (`permissionMode: "plan"` + `respondToPermission()`) — aprovar/negar tool uses antes de executar. E controle de execucao, nao dialogo.
2. **`streamInput()`** — empurrar texto via stdin, mas e unidirecional e nao se amarra a um ponto especifico da execucao.

Falta a ponte: o **agente parar, fazer uma pergunta, esperar a resposta do cliente, receber a resposta e continuar raciocinando sobre ela**. Essa capacidade e fundamental para agentes conversacionais que precisam desambiguacao ("voce quis dizer X ou Y?"), preenchimento progressivo de formulario ("falta o endereco") ou confirmacao explicita antes de executar acao cara.

O `@codrstudio/agentic-sdk` tinha `createAskUserTool` baseado em callback local, mas o modelo de callback nao se aplica aqui — o openclaude-sdk spawna um subprocesso e a comunicacao com o cliente e assincrona via stream.

---

## Design

### Ativacao

Nova flag em `Options`:

```typescript
interface Options {
  // ... campos existentes
  askUser?: boolean  // default: false
}
```

Quando `true`, o SDK registra um MCP server in-process chamado `ask_user` contendo uma unica tool `ask_user` que **bloqueia o handler** ate o cliente fornecer a resposta.

### Fluxo

```
Cliente <───────── Agente chama tool ask_user com { question, ...opts }
                           │
                           │ (handler bloqueia aguardando resposta)
                           │
Cliente ─────────> Query.respondToAskUser(callId, answer)
                           │
                           │ (handler resolve)
                           ▼
                   Resultado da tool volta para o agente
```

### Schema da tool

```typescript
const askUserSchema = z.object({
  question: z.string().describe("The question to ask the user"),
  context: z.string().optional().describe("Optional context explaining why"),
  inputType: z.enum(["text", "number", "boolean", "choice"]).default("text"),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
  })).optional().describe("Required when inputType === 'choice'"),
  placeholder: z.string().optional(),
})
```

### Novo metodo no `Query`

```typescript
interface Query {
  // ... metodos existentes

  /**
   * Emitido quando o agente invoca a tool ask_user.
   * Use respondToAskUser(callId, answer) para desbloquear.
   */
  onAskUser(handler: (req: AskUserRequest) => void): void

  /**
   * Responde a uma pergunta pendente do agente.
   * Desbloqueia o handler correspondente e permite o agente continuar.
   */
  respondToAskUser(callId: string, answer: AskUserAnswer): void
}

interface AskUserRequest {
  callId: string
  question: string
  context?: string
  inputType: "text" | "number" | "boolean" | "choice"
  choices?: { id: string; label: string }[]
  placeholder?: string
}

type AskUserAnswer =
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "choice"; id: string }
  | { type: "cancelled" }
```

### Implementacao do handler

O handler da tool `ask_user` cria um `Promise` e armazena o `resolve` num mapa interno `pendingAskUser: Map<callId, resolve>`. Quando o cliente chama `respondToAskUser(callId, answer)`, o resolve correspondente e chamado com o `CallToolResult` formatado.

```typescript
// pseudocodigo do handler
const handler = async (args) => {
  const callId = randomUUID()
  emitOnAskUser({ callId, ...args })
  const answer = await new Promise<AskUserAnswer>((resolve) => {
    pendingAskUser.set(callId, resolve)
  })
  return {
    content: [{ type: "text", text: formatAnswer(answer) }],
  }
}
```

`formatAnswer` converte a resposta estruturada em texto que o modelo consegue consumir:

- `text` → `"User answered: <value>"`
- `number` → `"User answered: <value>"`
- `boolean` → `"User answered: yes/no"`
- `choice` → `"User chose: <label> (id: <id>)"`
- `cancelled` → `"User cancelled the question."`

### Timeout opcional

```typescript
interface Options {
  askUser?: boolean
  askUserTimeoutMs?: number  // default: undefined (sem timeout)
}
```

Se definido e o cliente nao responder em `askUserTimeoutMs`, o handler resolve com `{ type: "cancelled" }` e um aviso: `"User did not respond within <N>s."`.

### System prompt injetado

```
You can ask the user for information mid-task using the ask_user tool. Use it when:
- You need clarification on an ambiguous request
- A required piece of information is missing
- You want explicit confirmation before an expensive or irreversible action

Prefer ask_user over guessing. Keep questions concise and provide context when needed.
Use inputType='choice' when there are clear discrete options.
```

---

## Estrutura de arquivos

```
src/
  ask-user/
    schema.ts       # Zod schema da tool
    server.ts       # createAskUserMcpServer() + pending map + formatAnswer
    prompt.ts       # System prompt append
    types.ts        # AskUserRequest, AskUserAnswer
    index.ts        # Barrel
  query.ts          # Wire up: onAskUser, respondToAskUser, aplicar flag
```

---

## Exports publicos novos

```typescript
export type {
  AskUserRequest,
  AskUserAnswer,
} from "./ask-user/index.js"
```

Nao precisa exportar schemas Zod porque nao ha valor em validacao client-side para `ask_user` — o contrato e tipado via TS.

---

## Exemplo end-to-end

```typescript
import { query } from "openclaude-sdk"

const q = query({
  prompt: "Book a meeting for next week with the marketing team",
  options: { askUser: true },
})

q.onAskUser((req) => {
  console.log("[agent asks]", req.question)

  // Em produccao, enviaria via SSE/WebSocket para o cliente
  // e esperaria a resposta. Aqui stubamos direto:
  if (req.inputType === "choice" && req.choices) {
    q.respondToAskUser(req.callId, { type: "choice", id: req.choices[0].id })
  } else {
    q.respondToAskUser(req.callId, { type: "text", value: "Tuesday 2pm" })
  }
})

for await (const msg of q) {
  // ...
}
```

---

## Integracao com `richOutput`

`richOutput` e `askUser` sao **ortogonais** — podem ser ligadas juntas ou separadas. Quando ambas estao `true`, os MCP servers sao registrados independentemente sob chaves diferentes (`"display"` e `"ask_user"`).

Existe uma oportunidade de **unificar a experiencia visual**: quando `askUser` gera uma pergunta com `inputType === "choice"`, o agentic-chat pode renderizar como `display_highlight` com action `choices` (reusando o renderer que ja existe). Mas isso e decisao do cliente — o SDK apenas emite o `tool_use` de `ask_user`, nao traduz para display.

---

## Criterios de aceite

- [ ] `options.askUser: boolean` aceita na interface `Options`
- [ ] `options.askUserTimeoutMs: number` opcional na interface `Options`
- [ ] Tool `ask_user` registrada como MCP sdk server quando flag ativa
- [ ] `Query.onAskUser(handler)` emite requests estruturados com `callId`
- [ ] `Query.respondToAskUser(callId, answer)` desbloqueia o handler e formata a resposta
- [ ] Timeout opcional cancela com `AskUserAnswer { type: "cancelled" }` + reason no texto
- [ ] Cliente pode cancelar explicitamente via `respondToAskUser(callId, { type: "cancelled" })`
- [ ] `respondToAskUser` com `callId` desconhecido faz no-op (ou warn), nao throw
- [ ] System prompt append descreve quando usar a tool
- [ ] Tipos `AskUserRequest`, `AskUserAnswer` exportados
- [ ] Zero overhead quando flag desligada (nenhum MCP server nem prompt append)
- [ ] Typecheck passa
- [ ] Build passa
- [ ] README ganha secao "Ask User" com exemplo e tabela de inputTypes
- [ ] Teste manual via demo — agente pausa na pergunta, cliente responde, agente continua

---

## Dependencias

| Dependencia | Status |
|-------------|--------|
| `tool()` e `createSdkMcpServer()` | Ja — milestone-01 task 06 |
| `@modelcontextprotocol/sdk` como peer dep | Ja |
| Task 01 deste milestone (rich output) | **Nao e dep estrita**, mas recomendada primeiro para validar o padrao de built-in MCP + flag + prompt inject antes de duplicar para ask_user |

---

## Nao-objetivos

- **UI de pergunta** — responsabilidade do cliente.
- **Persistencia de historico de perguntas** — se precisar, usa o JSONL de sessao nativo.
- **Perguntas concorrentes** — primeiro release aceita **uma pergunta pendente por vez**. Se o modelo invocar `ask_user` com outra ainda pendente, retorna erro "previous question not yet answered". Suporte multi-pergunta pode vir em iteracao futura.
- **Callback sync** (pergunta e resposta no mesmo tick) — sempre async via `Promise`.

---

## Prioridade

**Media** — segundo passo do milestone-02 depois de `richOutput`. Desbloqueia agentes conversacionais de verdade (multi-turn com desambiguacao). Nao bloqueia a deprecation do `agentic-sdk` (task 01 ja basta para isso).

---

## Rastreabilidade

| Origem | Referencia |
|--------|-----------|
| Gap analysis agentic-sdk vs openclaude-sdk | Conversa de design 2026-04-10 |
| Source historico | `D:\aw\context\workspaces\agentic-sdk\repo\src\tools\ask-user.ts` (baseado em callback local, nao reaproveitavel) |
| Dep de `tool()` e `createSdkMcpServer()` | `sprints/backlog/milestone-01/06-mcp-tool-factories/TASK.md` |
| Precedente de flag + built-in | `sprints/backlog/milestone-02/01-rich-output-display-tools/TASK.md` |
| Consumidor final | `D:\aw\context\workspaces\agentic-chat\repo` |

---

# Projeto

# openclaude-sdk

Um SDK em TypeScript que permite usar o OpenClaude (fork open-source do Claude Code) de forma programática, dentro de aplicações Node.js.

## Problema que resolve

O OpenClaude CLI é uma ferramenta interativa de terminal — você digita prompts e o agente responde. Mas para quem quer **integrar um agente de código em seus próprios sistemas** (automações, pipelines, produtos), usar o terminal não serve. É preciso uma interface programática.

O openclaude-sdk faz essa ponte: transforma o CLI num componente controlável por código.

## O que permite fazer

- **Conversar com o agente** — enviar prompts e receber respostas em streaming, como um chat programático
- **Controlar permissões** — aprovar ou negar ações do agente (leitura de arquivos, execução de comandos) sem intervenção humana
- **Gerenciar sessões** — retomar conversas anteriores, listar histórico, organizar sessões com títulos e tags
- **Usar múltiplos providers** — rotear requests para OpenRouter ou qualquer API compatível com OpenAI, não ficando preso a um único provedor
- **Tratar erros de forma inteligente** — distinguir erros recuperáveis (rate limit, timeout) de fatais (autenticação, billing), permitindo lógica de retry automático

## Para quem é

Desenvolvedores que querem construir produtos ou automações em cima de agentes de código — orquestradores, plataformas de desenvolvimento assistido por IA, ferramentas internas, CI/CD com agentes.

## Relação com o ecossistema

É o equivalente open-source do `@anthropic-ai/claude-code` SDK oficial da Anthropic, mas voltado para o OpenClaude. Mesma ideia, mesmo estilo de API, ecossistema diferente.