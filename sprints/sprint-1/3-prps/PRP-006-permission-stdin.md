# PRP-006 — Suporte a Permission Mid-Stream via stdin

## Objetivo

Expor canal stdin do subprocess para permitir respostas a permission requests em plan mode, tornando plan mode utilizavel programaticamente.

Referencia: spec S-006 (D-006).

## Execution Mode

`implementar`

## Contexto

Em plan mode (`--permission-mode plan`), o CLI emite tool use requests e pausa aguardando input no stdin para approve/deny. A SDK nao expoe esse canal, tornando plan mode inutilizavel. O demo tem um endpoint stub anotado como nao suportado.

## Especificacao

### 1. Tipo PermissionResponse

Criar em `src/types/` (ou inline em `src/query.ts`):

```typescript
export interface PermissionResponse {
  toolUseId: string
  behavior: "allow" | "deny"
  message?: string
}
```

### 2. Novo metodo respondToPermission no Query

```typescript
export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
  close(): void
  respondToPermission(response: PermissionResponse): void
}
```

`respondToPermission()` serializa a resposta como JSON + newline e escreve no stdin do subprocess:

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

### 3. Manter stdin aberto em plan mode

Em `spawnAndStream()`, atualmente o prompt e escrito no stdin e stdin e fechado (`proc.stdin?.end()`).

Quando o permission mode requer stdin aberto (qualquer modo exceto `bypassPermissions` e `dontAsk`):
- Escrever prompt + newline: `proc.stdin?.write(prompt + "\n")`
- NAO chamar `proc.stdin?.end()`

Quando stdin nao precisa ficar aberto:
- Comportamento atual: escrever prompt e fechar stdin

### 4. Refatorar retorno de spawnAndStream()

`spawnAndStream()` precisa retornar funcao de escrita no stdin alem do generator:

```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: SpawnOptions,
): { stream: AsyncGenerator<SDKMessage>; writeStdin: (data: string) => void; close: () => void }
```

### 5. Adaptar query()

`query()` deve usar a nova assinatura de `spawnAndStream()` e conectar `writeStdin` ao metodo `respondToPermission` do Query.

### 6. Exportar via index.ts

Exportar o tipo `PermissionResponse` de `src/index.ts`.

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-017 | PermissionResponse type | Criar tipo para respostas de permissao |
| F-018 | respondToPermission | Implementar metodo no Query |
| F-019 | stdin aberto | Manter stdin aberto em plan mode |
| F-020 | spawnAndStream refactor | Alterar retorno para expor writeStdin |

## Limites

- NAO implementar deteccao semantica de permission requests — a SDK expoe o mecanismo (stdin write), o chamador identifica quando enviar
- NAO adicionar fila interna de respostas — chamador e responsavel pela ordem
- NAO adicionar timeout na resposta — o CLI controla seu proprio timeout
- NAO alterar comportamento de modos sem permissao (bypassPermissions, dontAsk)

## Dependencias

- **PRP-001** — projeto precisa estar configurado e compilando
- **PRP-004** — refator de `spawnAndStream()` (resolveExecutable) deve estar feito antes para evitar conflitos
