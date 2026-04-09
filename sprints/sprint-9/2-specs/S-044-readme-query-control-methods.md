# openclaude-sdk - Documentacao dos Query Control Methods no README

Documentar `setModel()`, `setPermissionMode()` e `setMaxThinkingTokens()` na tabela do Query no README.

---

## Objetivo

Resolver D-047 (score 7): os metodos de configuracao mid-session do Query foram implementados no sprint-7 mas nao aparecem no README. Usuarios que precisam ajustar comportamento dinamicamente nao sabem que esses metodos existem.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `setModel()` nao documentado | Troca de modelo mid-session invisivel |
| 2 | `setPermissionMode()` nao documentado | Mudanca de permissao dinamica inacessivel |
| 3 | `setMaxThinkingTokens()` nao documentado | Controle de thinking budget desconhecido |

**Spec de referencia**: `sprints/sprint-8/2-specs/S-034-readme-query-control-introspection.md`

---

## Implementacao

1. Atualizar tabela do objeto `Query` no README com os 3 metodos de controle
2. Adicionar exemplo de uso mid-session (setModel apos N turnos)
3. Documentar assinaturas: `setModel(model?: string)`, `setPermissionMode(mode)`, `setMaxThinkingTokens(tokens: number | null)`

---

## Criterios de Aceite

- [ ] Tabela do Query inclui `setModel()`, `setPermissionMode()`, `setMaxThinkingTokens()`
- [ ] Exemplo de uso mid-session
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Query control methods docs | S-044 |
| Discovery | D-047 |
| Spec anterior | S-034 (sprint-8) |
