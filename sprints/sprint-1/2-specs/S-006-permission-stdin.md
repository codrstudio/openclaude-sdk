# openclaude-sdk - Suporte a Permission Mid-Stream via stdin

Expor canal stdin do subprocess para permitir respostas a permission requests em plan mode.

---

## Objetivo

Resolver D-006: em plan mode, o CLI espera input pelo stdin para approve/deny de tool uses. A SDK nao expoe esse canal, tornando plan mode inutilizavel programaticamente.

---

## Contexto

Quando o CLI roda em `--permission-mode plan`, ele emite mensagens do tipo `system` com subtype relevante e aguarda input no stdin. O fluxo e:

1. CLI emite tool use request (mensagem assistant com ToolUseBlock)
2. CLI pausa e aguarda stdin
3. Chamador envia JSON com decisao (allow/deny)
4. CLI continua execucao

---

## API Publica

### Novo metodo no Query

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
  close(): void
  /** Envia resposta de permissao ao CLI via stdin */
  respondToPermission(response: PermissionResponse): void
}
```

### Tipo PermissionResponse

```typescript
export interface PermissionResponse {
  /** ID do tool_use que esta sendo respondido */
  toolUseId: string
  /** Decisao: permitir ou negar */
  behavior: "allow" | "deny"
  /** Mensagem ao agente quando deny */
  message?: string
}
```

---

## Implementacao

### Manter stdin aberto

Atualmente `spawnAndStream()` envia o prompt e fecha stdin:

```typescript
proc.stdin?.write(prompt)
proc.stdin?.end()
```

Quando `permissionMode === "plan"` (ou qualquer modo que nao seja `bypassPermissions`/`dontAsk`), **nao fechar stdin**:

```typescript
proc.stdin?.write(prompt + "\n")

if (keepStdinOpen) {
  // Nao chamar proc.stdin?.end()
} else {
  proc.stdin?.end()
}
```

### Expor writeToStdin no retorno de spawnAndStream

`spawnAndStream()` precisa retornar tanto o generator quanto uma funcao de escrita:

```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: SpawnOptions,
): { stream: AsyncGenerator<SDKMessage>; writeStdin: (data: string) => void; close: () => void }
```

### respondToPermission em query()

```typescript
respondToPermission(response: PermissionResponse): void {
  const payload = JSON.stringify({
    tool_use_id: response.toolUseId,
    behavior: response.behavior,
    message: response.message,
  })
  writeStdin(payload + "\n")
}
```

---

## Deteccao de Permission Request

O consumidor da SDK identifica um permission request inspecionando mensagens:

| Tipo de Mensagem | Campo | Significado |
|------------------|-------|-------------|
| `SDKAssistantMessage` | `message.content` contendo `ToolUseBlock` | O CLI quer usar uma tool |
| Pausa na stream | Nenhuma mensagem nova | CLI aguardando stdin |

**Nota**: o formato exato do permission request depende da versao do CLI. A SDK expoe o mecanismo (stdin write), nao a deteccao semantica.

---

## Restricoes

| Restricao | Motivo |
|-----------|--------|
| Stdin aberto so em plan mode | Outros modos nao pausam para permissao |
| Sem fila interna | Chamador e responsavel por enviar na ordem correta |
| Sem timeout na resposta | O CLI controla seu proprio timeout |

---

## Impacto em Interfaces Existentes

| Componente | Mudanca |
|------------|---------|
| `spawnAndStream()` | Retorno muda de `AsyncGenerator` para `{ stream, writeStdin, close }` |
| `query()` | Adaptar para nova assinatura de `spawnAndStream()` |
| `Query` interface | Novo metodo `respondToPermission()` |
| `index.ts` | Exportar `PermissionResponse` type |

---

## Criterios de Aceite

- [ ] `Query` tem metodo `respondToPermission(response)`
- [ ] Em plan mode, stdin do subprocess permanece aberto
- [ ] `respondToPermission()` escreve JSON + newline no stdin
- [ ] Em modos sem permissao (bypassPermissions, dontAsk), stdin e fechado normalmente
- [ ] `PermissionResponse` type esta exportado
- [ ] Nao quebra o fluxo existente de `query()` sem plan mode

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `respondToPermission()` em Query | S-006 |
| `spawnAndStream()` refactor | S-006 |
| `PermissionResponse` type | S-006 |
| Discovery | D-006 |
