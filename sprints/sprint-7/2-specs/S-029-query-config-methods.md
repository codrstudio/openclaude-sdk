# openclaude-sdk - Metodos de Configuracao Mid-Session no Query

Implementar `setModel()`, `setPermissionMode()` e `setMaxThinkingTokens()` no objeto `Query` via protocolo de controle stdin.

---

## Objetivo

Resolver D-041 (score 7): o `Query` retornado por `query()` expoe apenas `interrupt()`, `close()` e `respondToPermission()`. Faltam os 3 metodos de configuracao que permitem ajustar comportamento da sessao em andamento.

| Metodo | Caso de uso |
|--------|-------------|
| `setModel(model?)` | Trocar modelo mid-session (ex: escalar de haiku para opus em tarefas complexas) |
| `setPermissionMode(mode)` | Ajustar permissoes dinamicamente (ex: relaxar para automacao, restringir apos fase perigosa) |
| `setMaxThinkingTokens(tokens)` | Ajustar budget de thinking (ex: aumentar para raciocinio complexo) |

Referencia: `backlog/07-query-methods/TASK.md`.

---

## Estado Atual

**Arquivo**: `src/query.ts`, interface `Query`, linhas 26-33

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
  close(): Promise<void>
  respondToPermission(response: PermissionResponse): void
}
```

Tres metodos. `respondToPermission()` ja demonstra o padrao de comunicacao via `writeStdin()` com JSON + `\n`.

---

## Protocolo de Controle via stdin

O CLI do OpenClaude aceita comandos JSON via stdin durante a execucao. O formato e:

```json
{"type": "<command_type>", ...params}
```

Cada comando e fire-and-forget — nao ha resposta direta. O efeito e aplicado ao proximo turno do agente.

### Comandos de configuracao

| Comando | Payload JSON |
|---------|-------------|
| `set_model` | `{ "type": "set_model", "model": "<model_id>" }` |
| `set_permission_mode` | `{ "type": "set_permission_mode", "permissionMode": "<mode>" }` |
| `set_max_thinking_tokens` | `{ "type": "set_max_thinking_tokens", "maxThinkingTokens": <number \| null> }` |

---

## Implementacao

### 1. Atualizar interface `Query`

Adicionar os 3 metodos a interface em `src/query.ts`:

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  /** Interrompe a query */
  interrupt(): Promise<void>
  /** Fecha a query e mata o processo */
  close(): Promise<void>
  /** Responde a uma solicitacao de permissao de ferramenta */
  respondToPermission(response: PermissionResponse): void
  /** Troca o modelo durante a sessao */
  setModel(model?: string): void
  /** Muda o modo de permissao durante a sessao */
  setPermissionMode(mode: PermissionMode): void
  /** Ajusta o budget de thinking tokens */
  setMaxThinkingTokens(tokens: number | null): void
}
```

### 2. Implementar os metodos no objeto Query

No bloco `Object.assign(stream, { ... })` dentro de `query()`:

```typescript
setModel(model?: string): void {
  const payload = JSON.stringify({ type: "set_model", model: model ?? null })
  writeStdin(payload + "\n")
},

setPermissionMode(mode: PermissionMode): void {
  const payload = JSON.stringify({ type: "set_permission_mode", permissionMode: mode })
  writeStdin(payload + "\n")
},

setMaxThinkingTokens(tokens: number | null): void {
  const payload = JSON.stringify({ type: "set_max_thinking_tokens", maxThinkingTokens: tokens })
  writeStdin(payload + "\n")
},
```

Todos seguem o mesmo padrao de `respondToPermission()`: serializar JSON, enviar via `writeStdin()` com `\n` como delimitador.

### 3. Import de `PermissionMode`

`PermissionMode` ja esta disponivel via `src/types/messages.ts`. Adicionar import em `query.ts`:

```typescript
import type { SDKMessage, SDKSystemMessage, PermissionMode } from "./types/messages.js"
```

Verificar se `PermissionMode` ja e importado — se nao, adicionar.

### Comportamento por cenario

| Cenario | Comportamento |
|---------|--------------|
| `setModel("opus")` durante query ativa | Modelo muda para proximo turno |
| `setModel()` sem argumento | Reseta para modelo default |
| `setPermissionMode("plan")` | Proxima tool use pedira confirmacao |
| `setMaxThinkingTokens(8192)` | Budget de thinking ajustado |
| `setMaxThinkingTokens(null)` | Thinking desabilitado |
| Metodo chamado apos `close()` | `writeStdin` lanca erro (guard `stdinClosed` de S-026/D-037) |

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/query.ts` | Adicionar 3 metodos a interface `Query` e implementacao no `Object.assign` |
| `src/query.ts` | Possivel import adicional de `PermissionMode` |

---

## Criterios de Aceite

- [ ] `setModel(model?)` envia comando `set_model` via stdin
- [ ] `setPermissionMode(mode)` envia comando `set_permission_mode` via stdin
- [ ] `setMaxThinkingTokens(tokens)` envia comando `set_max_thinking_tokens` via stdin
- [ ] Todos os metodos usam `writeStdin()` existente (reutilizam guard `stdinClosed`)
- [ ] Interface `Query` atualizada com os 3 novos metodos
- [ ] Metodos sao fire-and-forget (nao retornam Promise)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `setModel()` | S-029 |
| `setPermissionMode()` | S-029 |
| `setMaxThinkingTokens()` | S-029 |
| Discovery | D-041 |
| Referencia | `backlog/07-query-methods/TASK.md` |
