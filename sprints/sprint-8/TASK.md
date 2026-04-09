# session-chain-reconstruction

**Severidade**: Medio
**Arquivo alvo**: `src/sessions.ts` — funcao `getSessionMessages()` (linhas 190-232)
**Referencia Python**: `ref/sessions.py` — funcoes `_parse_transcript_entries()` (linha 863-894), `_build_conversation_chain()` (linha 897-986), `_is_visible_message()` (linha 989-1002)

## Problema

`getSessionMessages()` atual filtra simplesmente por `type === "user" || type === "assistant"` e retorna na ordem do arquivo. Isso falha com:

- **Sidechains**: mensagens de branches paralelos aparecem misturadas
- **Team messages**: mensagens de team agents aparecem na lista
- **Meta messages**: mensagens internas aparecem
- **Ordem incorreta**: sem reconstrucao de chain via `parentUuid`, a ordem pode estar errada em sessoes com compactacao ou forks

## O que fazer

Reimplementar `getSessionMessages()` seguindo o algoritmo do Python:

### Passo 1: Parse de transcript entries

```typescript
const TRANSCRIPT_TYPES = new Set(["user", "assistant", "progress", "system", "attachment"])

interface TranscriptEntry {
  type: string
  uuid: string
  parentUuid?: string
  sessionId?: string
  message?: unknown
  isSidechain?: boolean
  isMeta?: boolean
  isCompactSummary?: boolean
  teamName?: string
}
```

Filtrar linhas: manter apenas as que tem `uuid` e `type` em `TRANSCRIPT_TYPES`.

### Passo 2: Build conversation chain

1. **Indexar por uuid**: `Map<string, TranscriptEntry>` para O(1) lookup
2. **Indexar posicao**: `Map<string, number>` para file-order tie-breaking
3. **Encontrar terminais**: entries cujo `uuid` nao aparece como `parentUuid` de nenhuma outra entry
4. **De cada terminal**, caminhar backward via `parentUuid` ate encontrar entry `user` ou `assistant` — esses sao os "leaves"
5. **Filtrar leaves**: excluir sidechain, teamName, isMeta
6. **Escolher o melhor leaf**: o de maior posicao no arquivo (mais recente)
7. **Caminhar de leaf ate root** via `parentUuid`, detectando ciclos com `Set<string>`
8. **Reverter**: a chain resultante esta root → leaf (cronologica)

### Passo 3: Filtrar mensagens visiveis

Da chain, manter apenas entries onde:
- `type === "user" || type === "assistant"`
- `!isMeta`
- `!isSidechain`
- `!teamName`
- `isCompactSummary` **e mantido** (contem resumo pos-compactacao)

### Passo 4: Converter para `SessionMessage`

Mapear cada entry para o formato existente `SessionMessage`.

## Validacao

- Sessao com sidechain: apenas mensagens da main chain aparecem
- Sessao com team messages: team messages nao aparecem
- Sessao com compactacao: compact summary aparece como substituto das mensagens originais
- Sessao simples (sem branches): resultado identico ao atual

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