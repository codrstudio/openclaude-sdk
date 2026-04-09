# PRP-033 — buildConversationChain: Empty mainLeaves

## Objetivo

Corrigir edge case em `buildConversationChain()` onde `mainLeaves` vazio causa fallback para sidechain leaf, incluindo mensagens de sidechain na chain principal.

Referencia: spec S-047 (D-050).

## Execution Mode

`implementar`

## Contexto

`buildConversationChain()` em `src/sessions.ts` reconstroi a cadeia de mensagens de uma sessao a partir do transcript. Apos filtrar leaves por `isVisibleMessage()` (que exclui sidechains, team messages e meta), o algoritmo separa `mainLeaves` dos demais.

Problema: quando `mainLeaves` esta vazio (todos os leaves sao sidechain/team/meta), o fallback atual `pickBest(leaves)` retorna um leaf de sidechain. Isso faz com que `buildConversationChain()` caminhe backward a partir de um sidechain leaf, incluindo mensagens de sidechain na chain principal — contradizendo a propria filtragem de `isVisibleMessage()`.

**Nota**: divergencia intencional do Python SDK (que tem o mesmo comportamento na linha 959). Optamos por consistencia com `isVisibleMessage()` em vez de paridade.

## Especificacao

### Feature F-076 — Fix empty mainLeaves fallback

**1. Alterar `src/sessions.ts`, funcao `buildConversationChain()`:**

Estado atual (linha 353):
```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

Novo:
```typescript
if (mainLeaves.length === 0) return []
const leaf = pickBest(mainLeaves)
```

Logica: se nenhum leaf pertence a main chain, a sessao nao tem conversacao principal recuperavel. Retornar `[]` e mais seguro e consistente que retornar mensagens de sidechain.

**2. Nenhuma outra alteracao necessaria.** O tipo de retorno ja e `TranscriptEntry[]`, e `[]` e um valor valido.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| `mainLeaves` tem entries | `pickBest(mainLeaves)` | `pickBest(mainLeaves)` (identico) |
| `mainLeaves` vazio, `leaves` tem sidechains | `pickBest(leaves)` → sidechain na chain | `[]` (chain vazia) |
| `mainLeaves` vazio, `leaves` vazio | `pickBest([])` → erro ou undefined | `[]` (chain vazia) |
| Sessao normal (user + assistant) | Chain completa | Chain completa (identico) |
| Sessao so com team messages | Sidechain messages na chain | `[]` |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-076 | fixEmptyMainLeaves | Retornar `[]` em `buildConversationChain()` quando `mainLeaves` esta vazio, em vez de fallback para sidechain leaf |

## Limites

- NAO alterar `isVisibleMessage()` — ja funciona corretamente
- NAO alterar `pickBest()` — ja funciona corretamente
- NAO alterar nenhuma outra funcao em `sessions.ts`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs. Independente de PRP-030/031/032.
