# openclaude-sdk - Reconstrucao de Conversation Chain em getSessionMessages()

Reimplementar `getSessionMessages()` com algoritmo de reconstrucao de chain via `parentUuid`, alinhando com o Python SDK.

---

## Objetivo

Resolver D-038 (score 8): `getSessionMessages()` em `src/sessions.ts` (linhas 268-291) filtra simplesmente por `type === "user" || type === "assistant"` e retorna na ordem do arquivo. Isso produz resultados incorretos em sessoes com sidechains, team messages, meta messages ou compactacao.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Sidechains misturadas na main chain | Mensagens de branches paralelos aparecem na lista |
| 2 | Team messages incluidas | Mensagens de team agents poluem o historico |
| 3 | Meta messages incluidas | Mensagens internas do sistema aparecem |
| 4 | Ordem incorreta em sessoes com forks | Sem reconstrucao via `parentUuid`, a ordem pode estar errada |

Referencia: `backlog/05-session-chain-reconstruction/ref/sessions.py` — funcoes `_parse_transcript_entries()` (linha 863), `_build_conversation_chain()` (linha 897), `_is_visible_message()` (linha 989).

---

## Estado Atual

**Arquivo**: `src/sessions.ts`, funcao `getSessionMessages()`, linhas 268-291

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

Filtragem ingenua: nao considera `parentUuid`, `isSidechain`, `isMeta`, `teamName`, `isCompactSummary`.

---

## Implementacao

### 1. Tipos internos

Adicionar como tipos locais (nao exportados) em `src/sessions.ts`:

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

### 2. `parseTranscriptEntries(messages)`

Filtra as mensagens brutas do JSONL para manter apenas entries com `uuid` e `type` em `TRANSCRIPT_TYPES`.

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

### 3. `buildConversationChain(entries)`

Reconstroi a chain principal caminhando backward via `parentUuid`. Segue o algoritmo Python fielmente.

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

**Nota**: `logicalParentUuid` (em entries `compact_boundary`) NAO e seguido intencionalmente. Isso alinha com o comportamento do VS Code IDE — apos compactacao, `isCompactSummary` substitui as mensagens originais.

### 4. `isVisibleMessage(entry)`

Filtra entries da chain para manter apenas mensagens visiveis ao usuario.

```typescript
function isVisibleMessage(entry: TranscriptEntry): boolean {
  if (entry.type !== "user" && entry.type !== "assistant") return false
  if (entry.isMeta) return false
  if (entry.isSidechain) return false
  // isCompactSummary e mantido intencionalmente — contem resumo pos-compactacao
  if (entry.teamName) return false
  return true
}
```

### 5. Atualizar `getSessionMessages()`

Substituir o bloco de filtragem/mapeamento atual:

**Antes:**

```typescript
const sessionMessages: SessionMessage[] = data.messages
  .filter((m) => {
    const obj = m as { type?: string }
    return obj.type === "user" || obj.type === "assistant"
  })
  .map((m) => { /* ... */ })
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

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Sessao simples (sem branches) | ✅ Funciona | ✅ Resultado identico |
| Sessao com sidechain | ❌ Sidechain misturada | ✅ Apenas main chain |
| Sessao com team messages | ❌ Team msgs incluidas | ✅ Team msgs filtradas |
| Sessao com meta messages | ❌ Meta msgs incluidas | ✅ Meta msgs filtradas |
| Sessao com compactacao | ❌ Ordem pode estar errada | ✅ Compact summary mantido, ordem correta |
| Sessao com forks | ❌ Todas as branches misturadas | ✅ Melhor leaf selecionado, chain unica |
| Sessao vazia | ✅ Retorna `[]` | ✅ Retorna `[]` |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | 268-291 | Substituir filtragem ingenua por pipeline: parse → build chain → filter visible |
| `src/sessions.ts` | (novo, acima de `getSessionMessages`) | Adicionar `TRANSCRIPT_TYPES`, `TranscriptEntry`, `parseTranscriptEntries()`, `buildConversationChain()`, `isVisibleMessage()` |

---

## Criterios de Aceite

- [ ] `parseTranscriptEntries()` filtra entries sem `uuid` ou com `type` fora de `TRANSCRIPT_TYPES`
- [ ] `buildConversationChain()` reconstroi chain via `parentUuid` com deteccao de ciclos
- [ ] Terminais sao entries cujo `uuid` nao e `parentUuid` de nenhuma outra
- [ ] Leaf selecionado e o de maior posicao no arquivo (mais recente)
- [ ] Leaves de sidechain/team/meta sao preteridos em favor de main chain
- [ ] `isVisibleMessage()` mantem `user` e `assistant`, exclui `isMeta`, `isSidechain`, `teamName`
- [ ] `isCompactSummary` e mantido (nao filtrado)
- [ ] `logicalParentUuid` nao e seguido
- [ ] Sessao simples produz resultado identico ao comportamento anterior
- [ ] `offset` e `limit` continuam funcionando apos a reconstrucao
- [ ] Funcoes internas nao sao exportadas
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Reconstrucao de conversation chain | S-027 |
| `parseTranscriptEntries()` | S-027 |
| `buildConversationChain()` | S-027 |
| `isVisibleMessage()` | S-027 |
| Discovery | D-038 |
| Referencia Python | `backlog/05-session-chain-reconstruction/ref/sessions.py` |
