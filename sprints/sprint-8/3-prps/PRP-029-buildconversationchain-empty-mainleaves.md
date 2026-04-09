# PRP-029 — Edge Case: buildConversationChain mainLeaves Vazio

## Objetivo

Corrigir `buildConversationChain()` para retornar `[]` quando `mainLeaves` esta vazio, em vez de fazer fallback para um leaf de sidechain/team/meta.

Referencia: spec S-037 (D-050).

## Execution Mode

`implementar`

## Contexto

Em `src/sessions.ts`, funcao `buildConversationChain()`, linha 353:

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

Quando todos os leaves sao sidechain, team ou meta, `mainLeaves` esta vazio e o fallback `pickBest(leaves)` seleciona um leaf de sidechain. A chain resultante contem entries de um branch paralelo, contradizendo o objetivo de excluir sidechains.

O Python SDK tem o mesmo comportamento (linha 959). Este fix diverge intencionalmente para corrigir a inconsistencia: `isVisibleMessage()` filtra sidechains, mas `buildConversationChain()` as inclui como fallback.

## Especificacao

### Feature F-066 — Retornar array vazio quando mainLeaves esta vazio

**1. Substituir a linha 353** de `src/sessions.ts`:

**Antes:**

```typescript
const leaf = mainLeaves.length > 0 ? pickBest(mainLeaves) : pickBest(leaves)
```

**Depois:**

```typescript
if (mainLeaves.length === 0) return []
const leaf = pickBest(mainLeaves)
```

**2. Justificativa:**

Se nenhum leaf pertence a main chain, a sessao nao tem conversacao principal recuperavel. Retornar `[]` e mais seguro que retornar mensagens de sidechain — o caller (`getSessionMessages()`) retornara lista vazia, que e o comportamento correto para uma sessao sem main chain visivel.

**3. Comportamento por cenario:**

| Cenario | Antes | Depois |
|---------|-------|--------|
| Sessao normal (main leaves existem) | Seleciona melhor main leaf | Identico |
| Todos os leaves sao sidechain | Retorna chain de sidechain | Retorna `[]` |
| Todos os leaves sao team messages | Retorna chain de team | Retorna `[]` |
| Sessao vazia (sem entries) | Retorna `[]` | Identico |
| Sessao sem leaves (sem terminais user/assistant) | Retorna `[]` | Identico |

**4. Validacao:**

- `npm run typecheck` passa sem erros
- `npm run build` passa sem erros

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-066 | fixEmptyMainLeaves | Retornar `[]` em `buildConversationChain()` quando `mainLeaves` esta vazio, em vez de fallback para sidechain leaf |

## Limites

- NAO alterar `listSessions()`, `renameSession()`, `tagSession()` ou `deleteSession()`
- NAO alterar `parseTranscriptEntries()` ou `isVisibleMessage()`
- NAO exportar funcoes internas de `sessions.ts`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia de outros PRPs.
