# openclaude-sdk - Edge Case em buildConversationChain: mainLeaves Vazio

Corrigir fallback de `buildConversationChain()` quando todos os leaves sao sidechain/team/meta.

---

## Objetivo

Resolver D-050 (score 3): quando `mainLeaves` esta vazio (todos os leaves sao sidechain, team ou meta), o codigo faz fallback para `pickBest(leaves)` que retorna um leaf de sidechain. Isso inclui mensagens de sidechain na chain principal, contradizendo o objetivo da funcao.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Fallback para sidechain leaf | Chain principal pode conter mensagens de sidechain |
| 2 | Inconsistencia com objetivo | `isVisibleMessage()` filtra sidechains mas `buildConversationChain()` as inclui |

**Nota**: o Python SDK tem o mesmo comportamento (linha 959). Este fix diverge intencionalmente do Python para corrigir a inconsistencia.

---

## Estado Atual

**Arquivo**: `src/sessions.ts`, funcao `buildConversationChain()`, linha 353

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

Quando `mainLeaves` esta vazio, `pickBest(leaves)` seleciona o leaf de sidechain/team/meta com maior posicao no arquivo. A chain resultante contem entries de um branch paralelo, que serao parcialmente filtradas por `isVisibleMessage()` mas a chain em si esta "contaminada" — a reconstrucao de parentUuid percorre a sidechain em vez da main chain.

### Cenario

```
root (user) → a1 (assistant) → u2 (user) → a2 (assistant, isSidechain=true) [terminal]
                              ↘ s1 (system) [terminal, isSidechain=true]
```

Se `a2` e `s1` sao os unicos terminais e ambos sao sidechain:
- `leaves = [a2]` (unico leaf user/assistant)
- `mainLeaves = []` (a2 e sidechain)
- Fallback: `pickBest([a2])` → chain via sidechain

---

## Implementacao

### 1. Retornar array vazio quando `mainLeaves` esta vazio

Substituir a linha 353:

**Antes:**

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

**Depois:**

```typescript
if (mainLeaves.length === 0) return []
const leaf = pickBest(mainLeaves)
```

### Justificativa

Se nenhum leaf pertence a main chain, a sessao nao tem conversacao principal recuperavel. Retornar `[]` e mais seguro que retornar mensagens de sidechain — o caller (`getSessionMessages()`) retornara lista vazia, o que e o comportamento correto para uma sessao sem main chain visivel.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Sessao normal (main leaves existem) | ✅ Seleciona melhor main leaf | ✅ Identico |
| Todos os leaves sao sidechain | ❌ Retorna chain de sidechain | ✅ Retorna `[]` |
| Todos os leaves sao team messages | ❌ Retorna chain de team | ✅ Retorna `[]` |
| Sessao vazia (sem entries) | ✅ Retorna `[]` | ✅ Identico |
| Sessao sem leaves (sem terminais user/assistant) | ✅ Retorna `[]` | ✅ Identico |

---

## Arquivos Afetados

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/sessions.ts` | 353 | Substituir fallback `pickBest(leaves)` por `return []` |

---

## Criterios de Aceite

- [ ] Quando `mainLeaves` esta vazio, `buildConversationChain()` retorna `[]`
- [ ] Quando `mainLeaves` nao esta vazio, comportamento identico ao atual
- [ ] `getSessionMessages()` retorna `[]` para sessoes onde todos os terminais sao sidechain
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Edge case mainLeaves vazio | S-037 |
| `buildConversationChain()` | S-037 |
| Discovery | D-050 |
| Divergencia Python | Intencional — Python SDK linha 959 tem mesmo fallback |
