# openclaude-sdk - Edge Case em buildConversationChain: mainLeaves Vazio

Corrigir fallback de `buildConversationChain()` quando todos os leaves sao sidechain/team/meta.

---

## Objetivo

Resolver D-050 (score 3): quando `mainLeaves` esta vazio (todos os leaves sao sidechain, team ou meta), o fallback `pickBest(leaves)` retorna um leaf de sidechain, incluindo mensagens de sidechain na chain principal.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Fallback para sidechain leaf | Chain principal contem mensagens de sidechain |
| 2 | Inconsistencia | `isVisibleMessage()` filtra sidechains mas `buildConversationChain()` as inclui |

**Nota**: divergencia intencional do Python SDK (mesmo comportamento na linha 959).

**Spec de referencia**: `sprints/sprint-8/2-specs/S-037-buildconversationchain-empty-mainleaves.md` — contem implementacao detalhada.

---

## Estado Atual

**Arquivo**: `src/sessions.ts`, funcao `buildConversationChain()`, linha 353

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

---

## Implementacao

Substituir linha 353:

**Antes:**

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

**Depois:**

```typescript
if (mainLeaves.length === 0) return []
const leaf = pickBest(mainLeaves)
```

Se nenhum leaf pertence a main chain, a sessao nao tem conversacao principal recuperavel. Retornar `[]` e mais seguro que retornar mensagens de sidechain.

---

## Criterios de Aceite

- [ ] Quando `mainLeaves` esta vazio, `buildConversationChain()` retorna `[]`
- [ ] Quando `mainLeaves` nao esta vazio, comportamento identico ao atual
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Edge case mainLeaves vazio | S-047 |
| `buildConversationChain()` | S-047 |
| Discovery | D-050 |
| Spec anterior | S-037 (sprint-8) |
