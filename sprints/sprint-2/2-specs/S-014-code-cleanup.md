# openclaude-sdk - Cleanup de Codigo: Imports, Exports e Catch

Mover dynamic imports para top-level, remover internals da API publica, e tornar catch especifico.

---

## Objetivo

Resolver D-019, D-020 e D-021 — tres problemas de qualidade de codigo de severidade media que prejudicam legibilidade, manutencao e debugging.

---

## 1. Dynamic Imports para Top-Level (D-019)

### Problema

`renameSession()` (sessions.ts:257) e `tagSession()` (sessions.ts:276) fazem `await import("node:fs/promises")` dentro do corpo da funcao:

```typescript
const { appendFile } = await import("node:fs/promises")
```

O modulo `node:fs/promises` ja e importado no topo do arquivo (linha 5):

```typescript
import { readdir, stat, readFile } from "node:fs/promises"
```

O import dinamico e desnecessario e adiciona overhead de resolucao a cada chamada.

### Correcao

Adicionar `appendFile` ao import estatico existente na linha 5:

```typescript
import { readdir, stat, readFile, appendFile } from "node:fs/promises"
```

Remover as duas linhas de import dinamico (257 e 276) e usar `appendFile` diretamente.

---

## 2. Remover Internals da API Publica (D-020)

### Problema

`index.ts:41` exporta funcoes internas de implementacao:

```typescript
// Process internals (para uso avancado)
export { buildCliArgs, spawnAndStream, resolveExecutable } from "./process.js"
```

Essas funcoes sao detalhes de implementacao do subprocess. Expo-las cria contratos implicitos que dificultam refactoring futuro. Consumidores da SDK devem usar `query()` como interface principal.

### Correcao

Remover a linha de exportacao e o comentario:

```typescript
// REMOVER:
// Process internals (para uso avancado)
// export { buildCliArgs, spawnAndStream, resolveExecutable } from "./process.js"
```

Tambem remover `resolveCommand` (deprecated) da exportacao do registry:

```typescript
// De:
export { createOpenRouterRegistry, resolveModelEnv, resolveCommand } from "./registry.js"

// Para:
export { createOpenRouterRegistry, resolveModelEnv } from "./registry.js"
```

Usuarios avancados que precisem de acesso podem importar diretamente de `openclaude-sdk/process.js` — mas a SDK nao garante estabilidade dessas APIs.

---

## 3. Catch Especifico para SyntaxError (D-021)

### Problema

Em `process.ts:237-241`:

```typescript
try {
  const parsed = JSON.parse(trimmed) as SDKMessage
  yield parsed
} catch {
  // Linha nao-JSON — debug output do CLI, ignorar
}
```

O catch ignora **qualquer** excecao, incluindo erros do `yield` (generator cancelado, erro de downstream). Apenas `SyntaxError` de `JSON.parse` deveria ser ignorado.

### Correcao

```typescript
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

Desta forma:
- `SyntaxError` (JSON invalido) → ignorado (comportamento atual para linhas nao-JSON)
- Qualquer outra excecao → propaga normalmente

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | 5 | Adicionar `appendFile` ao import estatico |
| `src/sessions.ts` | 257 | Remover `await import("node:fs/promises")` |
| `src/sessions.ts` | 276 | Remover `await import("node:fs/promises")` |
| `src/index.ts` | 28-29 | Remover `resolveCommand` da exportacao do registry |
| `src/index.ts` | 40-41 | Remover exportacao de `buildCliArgs`, `spawnAndStream`, `resolveExecutable` |
| `src/process.ts` | 237-241 | Tornar catch especifico para `SyntaxError` |

---

## Criterios de Aceite

- [ ] `appendFile` e importado estaticamente no topo de `sessions.ts`
- [ ] Nenhum `await import("node:fs/promises")` permanece em `sessions.ts`
- [ ] `buildCliArgs`, `spawnAndStream`, `resolveExecutable` nao aparecem nas exportacoes de `index.ts`
- [ ] `resolveCommand` nao aparece nas exportacoes de `index.ts`
- [ ] Catch em `process.ts` so ignora `SyntaxError` — outras excecoes propagam
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Import estatico de `appendFile` | S-014 |
| Remocao de exports internos | S-014 |
| Catch especifico em `spawnAndStream()` | S-014 |
| Discoveries | D-019, D-020, D-021 |
