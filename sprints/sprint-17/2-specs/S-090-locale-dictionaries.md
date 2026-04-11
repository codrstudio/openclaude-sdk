# openclaude-sdk - Dicionarios JSON de intencao por locale

Spec dos tres arquivos de dicionario JSON com frases de intencao para cada tool built-in.

---

## Objetivo

Resolve D-126, D-127, D-128.

| Problema | Consequencia |
|----------|-------------|
| Nao existem strings de intencao para substituir `tool_use.input` | Filtro nao tem conteudo para gerar — impossivel funcionar |
| Precisam ser multilingue (3 locales na v1) | Sem dicionarios, filtro so poderia usar string fixa em um idioma |

---

## Implementacao

### 1. Criar `src/tool-intention/locales/pt-BR.json`

### 2. Criar `src/tool-intention/locales/en-US.json`

### 3. Criar `src/tool-intention/locales/es-ES.json`

### Formato de cada arquivo

```json
{
  "Bash": [
    "variante 1",
    "variante 2",
    "variante 3",
    "variante 4",
    "variante 5"
  ],
  "Read": [...],
  "_fallback": [...]
}
```

### Tools cobertas (23 built-in + fallback)

| Tool | Descricao para contexto |
|------|------------------------|
| `Task` | Criar/delegar subtarefa |
| `AskUserQuestion` | Perguntar ao usuario |
| `Bash` | Executar comando no terminal |
| `Edit` | Editar arquivo existente |
| `EnterPlanMode` | Entrar em modo planejamento |
| `EnterWorktree` | Entrar em worktree |
| `ExitPlanMode` | Sair do modo planejamento |
| `ExitWorktree` | Sair de worktree |
| `Glob` | Buscar arquivos por padrao |
| `Grep` | Buscar conteudo em arquivos |
| `NotebookEdit` | Editar notebook |
| `Read` | Ler arquivo |
| `SendMessage` | Enviar mensagem |
| `Skill` | Executar skill |
| `TaskOutput` | Retornar resultado de tarefa |
| `TaskStop` | Parar tarefa |
| `TeamCreate` | Criar equipe |
| `TeamDelete` | Deletar equipe |
| `TodoWrite` | Gerenciar lista de tarefas |
| `ToolSearch` | Buscar ferramentas |
| `WebFetch` | Buscar pagina web |
| `WebSearch` | Pesquisar na web |
| `Write` | Escrever arquivo |
| `_fallback` | Usado quando tool nao esta no dicionario |

### Regras

- **5 variantes** por tool por locale — pick aleatorio em runtime
- Variantes devem ser **curtas** (max 6 palavras), **neutras**, **no gerundio** ou forma equivalente
- **Sem emoji, sem giria, sem antropomorfismo**
- **Sem pontuacao final** nas frases
- `_fallback` e a unica chave com prefixo `_` — usada para tools nao mapeadas (ex: MCP tools externas)
- Texto em portugues para `pt-BR`, ingles para `en-US`, espanhol para `es-ES`
- Nao traduzir literalmente entre locales — usar formas idiomaticas
- Cada JSON deve ter exatamente 24 chaves (23 tools + `_fallback`)

### Exemplo pt-BR

```json
{
  "Bash": [
    "Executando um comando",
    "Rodando uma operacao no terminal",
    "Executando uma acao no sistema",
    "Processando um comando",
    "Rodando um script"
  ],
  "Read": [
    "Lendo um arquivo",
    "Consultando um documento",
    "Abrindo um arquivo",
    "Verificando conteudo de um arquivo",
    "Acessando um documento"
  ]
}
```

### Exemplo en-US

```json
{
  "Bash": [
    "Running a command",
    "Executing a terminal operation",
    "Running a system action",
    "Processing a command",
    "Running a script"
  ],
  "Read": [
    "Reading a file",
    "Checking a document",
    "Opening a file",
    "Reviewing file contents",
    "Accessing a document"
  ]
}
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/tool-intention/locales/pt-BR.json` | Novo arquivo — 23 tools × 5 variantes + `_fallback` |
| `src/tool-intention/locales/en-US.json` | Novo arquivo — idem |
| `src/tool-intention/locales/es-ES.json` | Novo arquivo — idem |

---

## Criterios de Aceite

- [ ] 3 arquivos JSON em `src/tool-intention/locales/`
- [ ] Cada arquivo com 24 chaves (23 tools + `_fallback`)
- [ ] Cada chave com array de exatamente 5 strings
- [ ] Strings curtas (max 6 palavras), sem pontuacao final, sem emoji
- [ ] `pt-BR.json` em portugues brasileiro
- [ ] `en-US.json` em ingles americano
- [ ] `es-ES.json` em espanhol
- [ ] JSON valido (parseable sem erro)

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `src/tool-intention/locales/pt-BR.json` | S-090 |
| `src/tool-intention/locales/en-US.json` | S-090 |
| `src/tool-intention/locales/es-ES.json` | S-090 |
| D-126 | S-090 |
| D-127 | S-090 |
| D-128 | S-090 |
