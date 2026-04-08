# PRP-012 — Permission Guard

## Objetivo

Adicionar validacao de inputs em `respondToPermission()` e guard de processo vivo em `writeStdin()` para prevenir EPIPE nao tratado e payloads invalidos.

Referencia: spec S-013 (D-016).

## Execution Mode

`implementar`

## Contexto

`respondToPermission()` em `query.ts:73-79` escreve no stdin do subprocess sem verificar:
1. Se o processo ainda esta vivo — escrever em stdin de processo morto lanca EPIPE nao tratado
2. Se `toolUseId` e nao-vazio — payload invalido para o CLI
3. Se `behavior` e `"allow"` ou `"deny"` — valores invalidos nao sao rejeitados

## Especificacao

### 1. Validacao de inputs em respondToPermission()

Adicionar validacao antes da serializacao:

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

### 2. Guard de processo vivo em writeStdin()

Atualizar `writeStdin()` dentro de `spawnAndStream()`:

```typescript
function writeStdin(data: string): void {
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("Cannot write to stdin: process has exited")
  }
  proc.stdin?.write(data)
}
```

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-030 | Permission input validation | Validar `toolUseId` e `behavior` antes de serializar |
| F-031 | writeStdin process guard | Verificar se processo esta vivo antes de escrever no stdin |

## Limites

- NAO alterar a interface publica de `respondToPermission()` — mesma assinatura
- NAO adicionar retry ou reconexao — apenas fail-fast com erro claro
- NAO alterar o formato do payload JSON enviado ao CLI

## Dependencias

Nenhuma. Alteracoes sao auto-contidas em `src/query.ts` e `src/process.ts`.
