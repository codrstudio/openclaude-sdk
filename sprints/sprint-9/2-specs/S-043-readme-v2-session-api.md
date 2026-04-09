# openclaude-sdk - Documentacao da V2 Session API no README

Adicionar secao ao README.md documentando `createSession()`, `resumeSession()` e `prompt()` com exemplos praticos.

---

## Objetivo

Resolver D-046 (score 9): as funcoes `createSession()`, `resumeSession()` e `prompt()` foram implementadas no sprint-7 mas nao aparecem no README. Sao a API de maior impacto de DX — conversas multi-turn stateful sem gerenciar `sessionId` manualmente.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `createSession()` nao documentada | Usuarios nao sabem que podem criar sessoes stateful |
| 2 | `resumeSession()` nao documentada | Retomada de sessoes via V2 invisivel |
| 3 | `prompt()` nao documentada | One-shot simplificado inacessivel |
| 4 | `await using` nao documentado | Padrao de cleanup automatico desconhecido |

**Spec de referencia**: `sprints/sprint-8/2-specs/S-033-readme-v2-session-api.md` — contem a implementacao completa. Esta spec e identica em escopo.

---

## Estado Atual

**Arquivo**: `README.md`

O README documenta apenas V1 (`query()`, `collectMessages()`, `continueSession()`). Nao ha mencao a V2.

A implementacao em `src/session-v2.ts` exporta: `createSession`, `resumeSession`, `prompt` e tipos `SDKSession`, `CreateSessionOptions`, `ResumeSessionOptions`, `PromptOptions`.

---

## Implementacao

Seguir fielmente a spec `S-033` do sprint-8:

1. Nova secao "V2 Session API" apos "Session Management", antes de "Plan Mode"
2. `createSession(opts?)` com assinatura e `CreateSessionOptions`
3. Tabela da interface `SDKSession` (send, collect, close, asyncDispose)
4. Exemplo multi-turn com streaming
5. `resumeSession(sessionId, opts?)` com assinatura e exemplo
6. `prompt(text, opts?)` one-shot com assinatura e exemplo
7. Nota sobre `await using` e `AsyncDisposable` (requer TS >= 5.2)
8. Tabela comparativa V1 vs V2

---

## Criterios de Aceite

- [ ] Secao "V2 Session API" inserida no README apos "Session Management"
- [ ] `createSession()`, `resumeSession()`, `prompt()` documentadas com assinaturas
- [ ] Tabela da interface `SDKSession`
- [ ] Exemplos de codigo compilaveis
- [ ] Tabela comparativa V1 vs V2
- [ ] Nota sobre `await using`
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| V2 Session API docs | S-043 |
| Discovery | D-046 |
| Spec anterior | S-033 (sprint-8) |
