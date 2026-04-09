# openclaude-sdk - Adicionar Campo name a McpSdkServerConfig

Adicionar campo `name: string` a interface `McpSdkServerConfig` e ao retorno de `createSdkMcpServer()`.

---

## Objetivo

Resolver D-054 (score 7): o TASK.md especifica `McpSdkServerConfigWithInstance` com campo `name: string`, mas a interface atual `McpSdkServerConfig` em `src/types/options.ts` nao inclui esse campo. O campo e necessario para:

| # | Gap | Consequencia |
|---|-----|--------------|
| 1 | `name` ausente no tipo | Lifecycle manager (D-055) nao consegue associar erros ao servidor correto |
| 2 | `name` ausente no retorno | Transporte local (D-051) nao sabe qual nome usar ao registrar o server no CLI |

**Pre-requisito para**: D-051 (transporte local), D-055 (lifecycle management).

---

## Estado Atual

**Arquivo**: `src/types/options.ts`, linha 29-32

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  instance: unknown
}
```

**Arquivo**: `src/mcp.ts`, linha 60-63

```typescript
return {
  type: "sdk" as const,
  instance: server,
}
```

O campo `name` nao existe em nenhum dos dois locais.

---

## Implementacao

### 1. Adicionar `name` a `McpSdkServerConfig`

**Arquivo**: `src/types/options.ts`

**Antes:**

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  instance: unknown
}
```

**Depois:**

```typescript
export interface McpSdkServerConfig {
  type: "sdk"
  name: string
  instance: unknown
}
```

### 2. Retornar `name` em `createSdkMcpServer()`

**Arquivo**: `src/mcp.ts`

**Antes:**

```typescript
return {
  type: "sdk" as const,
  instance: server,
}
```

**Depois:**

```typescript
return {
  type: "sdk" as const,
  name: options.name,
  instance: server,
}
```

### 3. Nenhuma mudanca em `buildCliArgs()`

O bloco `if (config.type === "sdk")` em `src/process.ts:147` ja tem acesso a `config` tipado como `McpSdkServerConfig`. Apos esta mudanca, `config.name` estara disponivel para uso no transporte local (D-051).

---

## Arquivos Afetados

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `src/types/options.ts` | 29-32 | Adicionar `name: string` a `McpSdkServerConfig` |
| `src/mcp.ts` | 60-63 | Incluir `name: options.name` no objeto retornado |

---

## Criterios de Aceite

- [ ] `McpSdkServerConfig` tem campo `name: string`
- [ ] `createSdkMcpServer()` retorna objeto com `name` populado a partir de `options.name`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `McpSdkServerConfig.name` | S-038 |
| `createSdkMcpServer()` retorno | S-038 |
| Discovery | D-054 |
| Dependentes | D-051, D-055 |
