# openclaude-sdk - Guard de Processo Vivo em respondToPermission

Adicionar validacao de inputs e guard de processo vivo antes de escrever no stdin.

---

## Objetivo

Resolver D-016: `respondToPermission()` em `query.ts:73-79` escreve no stdin do subprocess sem verificar se o processo ainda esta vivo ou se os inputs sao validos. Escrever em stdin de processo morto lanca EPIPE nao tratado.

---

## Problema

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

Cenarios de falha:
1. Processo ja encerrou (exit code != null) → EPIPE no `write()`
2. `response.toolUseId` vazio → CLI recebe payload invalido
3. `response.behavior` nao e "allow" nem "deny" → CLI recebe payload invalido

---

## Correcao

### Validacao de inputs em respondToPermission()

```typescript
respondToPermission(response: PermissionResponse): void {
  if (!response.toolUseId) {
    throw new Error("respondToPermission: toolUseId must not be empty")
  }
  if (response.behavior !== "allow" && response.behavior !== "deny") {
    throw new Error(
      `respondToPermission: behavior must be "allow" or "deny", got "${response.behavior}"`,
    )
  }

  const payload = JSON.stringify({
    tool_use_id: response.toolUseId,
    behavior: response.behavior,
    message: response.message,
  })
  writeStdin(payload + "\n")
}
```

### Guard de processo vivo em writeStdin()

Atualizar `writeStdin()` em `spawnAndStream()` para verificar se o processo ainda esta vivo:

```typescript
function writeStdin(data: string): void {
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("Cannot write to stdin: process has exited")
  }
  proc.stdin?.write(data)
}
```

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/query.ts` | 73-79 | Adicionar validacao de `toolUseId` e `behavior` |
| `src/process.ts` | 211-213 | Adicionar guard de processo vivo em `writeStdin()` |

---

## Criterios de Aceite

- [ ] `respondToPermission({ toolUseId: "", behavior: "allow" })` lanca erro sincrono
- [ ] `respondToPermission({ toolUseId: "id", behavior: "invalid" as any })` lanca erro sincrono
- [ ] `writeStdin()` apos processo encerrado lanca erro em vez de EPIPE
- [ ] Chamadas validas continuam funcionando normalmente
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `respondToPermission()` validacao | S-013 |
| `writeStdin()` guard | S-013 |
| Discovery | D-016 |
