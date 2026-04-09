# openclaude-sdk - Documentacao dos Query Introspection e Operation Methods no README

Documentar metodos avancados de introspecao e operacao do Query no README.

---

## Objetivo

Resolver D-049 (score 5): metodos avancados implementados no sprint-7 mas invisiveis no README. Referencia tabular com assinatura e descricao e suficiente.

| # | Metodo | Categoria |
|---|--------|-----------|
| 1 | `initializationResult()` | Introspecao |
| 2 | `supportedCommands()` | Introspecao |
| 3 | `supportedModels()` | Introspecao |
| 4 | `supportedAgents()` | Introspecao |
| 5 | `mcpServerStatus()` | Introspecao |
| 6 | `accountInfo()` | Introspecao |
| 7 | `reconnectMcpServer(name)` | Operacao |
| 8 | `toggleMcpServer(name, enabled)` | Operacao |
| 9 | `stopTask(taskId)` | Operacao |
| 10 | `rewindFiles(msgId, opts?)` | Operacao |
| 11 | `setMcpServers(servers)` | Operacao |
| 12 | `streamInput(stream)` | Operacao |

**Spec de referencia**: `sprints/sprint-8/2-specs/S-036-readme-query-operations.md`

---

## Implementacao

1. Expandir tabela do Query no README com duas sub-secoes: "Introspection" e "Operations"
2. Cada metodo com assinatura, tipo de retorno e descricao de uma linha
3. Exemplo de uso para `mcpServerStatus()` (o mais util para debugging)

---

## Criterios de Aceite

- [ ] Todos os 12 metodos documentados na tabela do Query
- [ ] Assinatura e tipo de retorno para cada metodo
- [ ] Exemplo de uso para `mcpServerStatus()`
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Query introspection/operation docs | S-046 |
| Discovery | D-049 |
| Spec anterior | S-036 (sprint-8) |
