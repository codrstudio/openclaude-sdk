# PRP-021 — Session Chain Reconstruction

## Objetivo

Reimplementar `getSessionMessages()` com algoritmo de reconstrucao de conversation chain via `parentUuid`, eliminando filtragem ingenua que produz resultados incorretos em sessoes com sidechains, team messages, meta messages ou compactacao.

Referencia: spec S-027 (D-038).

## Execution Mode

`implementar`

## Contexto

O modulo de sessions (`src/sessions.ts`) filtra mensagens ingenuamente por `type === "user" || type === "assistant"` (linhas 268-291). Isso mistura sidechains na main chain, inclui team messages e meta messages, e nao reconstroi a ordem correta em sessoes com forks.

O Python SDK resolve isso com 3 funcoes: `_parse_transcript_entries()`, `_build_conversation_chain()`, `_is_visible_message()`. Referencia: `backlog/05-session-chain-reconstruction/ref/sessions.py`.

## Especificacao

### Feature F-047 — Tipos internos e `parseTranscriptEntries()`

**1. Declarar constante e tipo interno** (nao exportados) em `src/sessions.ts`, acima de `getSessionMessages()`:

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

**2. Implementar `parseTranscriptEntries()`** — filtra mensagens brutas do JSONL para entries com `uuid` e `type` em `TRANSCRIPT_TYPES`:

```typescript
function parseTranscriptEntries(messages: unknown[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = []
  for (const msg of messages) {
    const obj = msg as Record<string, unknown>
    const entryType = obj.type as string | undefined
    const uuid = obj.uuid as string | undefined
    if (entryType && TRANSCRIPT_TYPES.has(entryType) && typeof uuid === "string") {
      entries.push({
        type: entryType,
        uuid,
        parentUuid: typeof obj.parentUuid === "string" ? obj.parentUuid : undefined,
        sessionId: typeof obj.session_id === "string" ? obj.session_id : undefined,
        message: obj.message,
        isSidechain: obj.isSidechain === true,
        isMeta: obj.isMeta === true,
        isCompactSummary: obj.isCompactSummary === true,
        teamName: typeof obj.teamName === "string" ? obj.teamName : undefined,
      })
    }
  }
  return entries
}
```

**3. Implementar `isVisibleMessage()`** — filtra entries para manter apenas mensagens visiveis:

```typescript
function isVisibleMessage(entry: TranscriptEntry): boolean {
  if (entry.type !== "user" && entry.type !== "assistant") return false
  if (entry.isMeta) return false
  if (entry.isSidechain) return false
  if (entry.teamName) return false
  // isCompactSummary e mantido intencionalmente — contem resumo pos-compactacao
  return true
}
```

Nenhuma funcao e exportada — sao helpers internos de `sessions.ts`.

### Feature F-048 — `buildConversationChain()`

Algoritmo que reconstroi a chain principal caminhando backward via `parentUuid`. Segue o Python fielmente.

```typescript
function buildConversationChain(entries: TranscriptEntry[]): TranscriptEntry[] {
  if (entries.length === 0) return []

  // Indexar por uuid para O(1) lookup
  const byUuid = new Map<string, TranscriptEntry>()
  for (const entry of entries) {
    byUuid.set(entry.uuid, entry)
  }

  // Indexar posicao no arquivo para tie-breaking
  const entryIndex = new Map<string, number>()
  for (let i = 0; i < entries.length; i++) {
    entryIndex.set(entries[i].uuid, i)
  }

  // Encontrar terminais: entries cujo uuid nao aparece como parentUuid de nenhuma outra
  const parentUuids = new Set<string>()
  for (const entry of entries) {
    if (entry.parentUuid) parentUuids.add(entry.parentUuid)
  }
  const terminals = entries.filter((e) => !parentUuids.has(e.uuid))

  // De cada terminal, caminhar backward para encontrar leaf user/assistant
  const leaves: TranscriptEntry[] = []
  for (const terminal of terminals) {
    let cur: TranscriptEntry | undefined = terminal
    const seen = new Set<string>()
    while (cur) {
      if (seen.has(cur.uuid)) break
      seen.add(cur.uuid)
      if (cur.type === "user" || cur.type === "assistant") {
        leaves.push(cur)
        break
      }
      cur = cur.parentUuid ? byUuid.get(cur.parentUuid) : undefined
    }
  }

  if (leaves.length === 0) return []

  // Filtrar leaves da main chain (nao sidechain, nao team, nao meta)
  const mainLeaves = leaves.filter(
    (leaf) => !leaf.isSidechain && !leaf.teamName && !leaf.isMeta,
  )

  // Escolher o melhor leaf (maior posicao no arquivo)
  function pickBest(candidates: TranscriptEntry[]): TranscriptEntry {
    let best = candidates[0]
    let bestIdx = entryIndex.get(best.uuid) ?? -1
    for (let i = 1; i < candidates.length; i++) {
      const curIdx = entryIndex.get(candidates[i].uuid) ?? -1
      if (curIdx > bestIdx) {
        best = candidates[i]
        bestIdx = curIdx
      }
    }
    return best
  }

  const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)

  // Caminhar de leaf ate root via parentUuid
  const chain: TranscriptEntry[] = []
  const chainSeen = new Set<string>()
  let cur: TranscriptEntry | undefined = leaf
  while (cur) {
    if (chainSeen.has(cur.uuid)) break
    chainSeen.add(cur.uuid)
    chain.push(cur)
    cur = cur.parentUuid ? byUuid.get(cur.parentUuid) : undefined
  }

  // Reverter para ordem cronologica (root -> leaf)
  chain.reverse()
  return chain
}
```

**Nota**: `logicalParentUuid` (em entries `compact_boundary`) NAO e seguido intencionalmente. Alinha com comportamento do VS Code IDE.

### Feature F-049 — Integrar pipeline em `getSessionMessages()`

**Substituir** o bloco de filtragem/mapeamento em `getSessionMessages()` (linhas 268-291).

**Antes:**

```typescript
const sessionMessages: SessionMessage[] = data.messages
  .filter((m) => {
    const obj = m as { type?: string }
    return obj.type === "user" || obj.type === "assistant"
  })
  .map((m) => {
    const obj = m as Record<string, unknown>
    return {
      type: obj.type as "user" | "assistant",
      uuid: (obj.uuid as string) || "",
      session_id: (obj.session_id as string) || sessionId,
      message: obj.message,
      parent_tool_use_id: null,
    }
  })
```

**Depois:**

```typescript
const entries = parseTranscriptEntries(data.messages)
const chain = buildConversationChain(entries)
const visible = chain.filter(isVisibleMessage)

const sessionMessages: SessionMessage[] = visible.map((entry) => ({
  type: entry.type as "user" | "assistant",
  uuid: entry.uuid,
  session_id: entry.sessionId || sessionId,
  message: entry.message,
  parent_tool_use_id: null,
}))
```

O `offset` e `limit` existentes continuam funcionando — operam sobre `sessionMessages` apos a reconstrucao.

### Comportamento consolidado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Sessao simples (sem branches) | Funciona | Resultado identico |
| Sessao com sidechain | Sidechain misturada | Apenas main chain |
| Sessao com team messages | Team msgs incluidas | Team msgs filtradas |
| Sessao com meta messages | Meta msgs incluidas | Meta msgs filtradas |
| Sessao com compactacao | Ordem pode estar errada | Compact summary mantido, ordem correta |
| Sessao com forks | Todas as branches misturadas | Melhor leaf selecionado, chain unica |
| Sessao vazia | Retorna `[]` | Retorna `[]` |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-047 | parseTranscriptEntries | Tipos internos (`TRANSCRIPT_TYPES`, `TranscriptEntry`), `parseTranscriptEntries()` e `isVisibleMessage()` |
| F-048 | buildConversationChain | Algoritmo de reconstrucao de chain via `parentUuid` com deteccao de ciclos e tie-breaking por posicao |
| F-049 | integrateChainPipeline | Substituir filtragem ingenua em `getSessionMessages()` pelo pipeline parse → build chain → filter visible |

## Limites

- NAO alterar `listSessions()` — ja funciona corretamente
- NAO alterar `renameSession()`, `tagSession()` ou `deleteSession()`
- NAO exportar `parseTranscriptEntries()`, `buildConversationChain()` ou `isVisibleMessage()` — sao helpers internos
- NAO seguir `logicalParentUuid` — alinhamento intencional com VS Code IDE
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs.
