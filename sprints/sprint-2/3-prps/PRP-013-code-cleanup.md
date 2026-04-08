# PRP-013 — Code Cleanup

## Objetivo

Mover dynamic imports para top-level, remover internals da API publica, e tornar catch especifico para `SyntaxError`.

Referencia: spec S-014 (D-019, D-020, D-021).

## Execution Mode

`implementar`

## Contexto

Tres problemas de qualidade de codigo identificados na revisao:
1. `renameSession()` e `tagSession()` fazem `await import("node:fs/promises")` dentro do corpo da funcao, mas `appendFile` pode ser importado estaticamente (o modulo ja e importado no topo do arquivo)
2. `index.ts` exporta internals (`buildCliArgs`, `spawnAndStream`, `resolveExecutable`, `resolveCommand`) que sao detalhes de implementacao
3. Catch generico em `process.ts` ignora qualquer excecao, incluindo erros de generator/downstream — apenas `SyntaxError` de `JSON.parse` deveria ser ignorado

## Especificacao

### 1. Import estatico de appendFile (sessions.ts)

Alterar o import existente na linha 5:

```typescript
// De:
import { readdir, stat, readFile } from "node:fs/promises"

// Para:
import { readdir, stat, readFile, appendFile } from "node:fs/promises"
```

Remover as duas linhas de import dinamico dentro de `renameSession()` e `tagSession()`:

```typescript
// REMOVER (ambas as ocorrencias):
const { appendFile } = await import("node:fs/promises")
```

Usar `appendFile` diretamente nas funcoes.

### 2. Remover internals da API publica (index.ts)

Remover a exportacao de process internals:

```typescript
// REMOVER:
// Process internals (para uso avancado)
export { buildCliArgs, spawnAndStream, resolveExecutable } from "./process.js"
```

Remover `resolveCommand` da exportacao do registry:

```typescript
// De:
export { createOpenRouterRegistry, resolveModelEnv, resolveCommand } from "./registry.js"

// Para:
export { createOpenRouterRegistry, resolveModelEnv } from "./registry.js"
```

### 3. Catch especifico para SyntaxError (process.ts)

Substituir o catch generico:

```typescript
// De:
try {
  const parsed = JSON.parse(trimmed) as SDKMessage
  yield parsed
} catch {
  // Linha nao-JSON — debug output do CLI, ignorar
}

// Para:
try {
  const parsed = JSON.parse(trimmed) as SDKMessage
  yield parsed
} catch (err) {
  if (err instanceof SyntaxError) {
    // Linha nao-JSON — debug output do CLI, ignorar
    continue
  }
  throw err
}
```

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-032 | Static appendFile import | Mover `appendFile` para import estatico em `sessions.ts` |
| F-033 | Remove public internals | Remover `buildCliArgs`, `spawnAndStream`, `resolveExecutable`, `resolveCommand` de `index.ts` |
| F-034 | Specific SyntaxError catch | Tornar catch especifico para `SyntaxError` em `spawnAndStream()` |

## Limites

- NAO remover `resolveCommand()` de `registry.ts` — apenas da exportacao publica em `index.ts`
- NAO alterar a logica de nenhuma funcao — apenas imports, exports e catch
- NAO adicionar testes (nenhum test runner configurado)

## Dependencias

- **PRP-010** — se `resolveCommand` for depreciado no registry, a remocao da exportacao em index.ts deve acontecer depois ou junto
