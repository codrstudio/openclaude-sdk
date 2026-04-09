# openclaude-sdk - Corrigir Parser JSON para Multiplos Objetos Concatenados

Tratar caso de multiplos JSONs completos na mesma linha do stdout.

---

## Objetivo

Resolver D-065 (score 5): o parser em `process.ts` acumula linhas e tenta `JSON.parse(jsonBuffer)`. Se o CLI emitir dois JSONs completos na mesma linha (ex: `{"type":"a"}{"type":"b"}`), o parse falha e o buffer continua crescendo ate atingir `MAX_BUFFER_SIZE` e lancar erro. Re-introducao do gap identificado no sprint-8 e dropped no sprint-9.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Dois JSONs na mesma linha | `JSON.parse` falha no buffer concatenado |
| 2 | Buffer cresce indefinidamente | Atinge MAX_BUFFER_SIZE e lanca erro fatal |

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `streamGen()`, linhas 325-349

```typescript
let jsonBuffer = ""
const MAX_BUFFER_SIZE = 1_048_576 // 1MB

try {
  for await (const line of rl) {
    if (options.signal?.aborted) break

    const trimmed = line.trim()
    if (!trimmed) continue

    if (!jsonBuffer && !trimmed.startsWith("{")) continue

    jsonBuffer += trimmed

    if (jsonBuffer.length > MAX_BUFFER_SIZE) {
      jsonBuffer = ""
      throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
    }

    try {
      const parsed = JSON.parse(jsonBuffer) as SDKMessage
      jsonBuffer = ""
      yield parsed
    } catch {
      // Partial JSON — continue accumulating
      continue
    }
  }
}
```

---

## Implementacao

**Arquivo**: `src/process.ts`, substituir o bloco de parse dentro do `for await` (linhas 335-349)

**Antes:**

```typescript
jsonBuffer += trimmed

if (jsonBuffer.length > MAX_BUFFER_SIZE) {
  jsonBuffer = ""
  throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
}

try {
  const parsed = JSON.parse(jsonBuffer) as SDKMessage
  jsonBuffer = ""
  yield parsed
} catch {
  // Partial JSON — continue accumulating
  continue
}
```

**Depois:**

```typescript
jsonBuffer += trimmed

if (jsonBuffer.length > MAX_BUFFER_SIZE) {
  jsonBuffer = ""
  throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
}

// Tentar parse. Se falhar, pode ser JSON parcial OU multiplos JSONs concatenados
try {
  const parsed = JSON.parse(jsonBuffer) as SDKMessage
  jsonBuffer = ""
  yield parsed
} catch {
  // Tentar split de multiplos JSONs concatenados: {"a":1}{"b":2}
  const objects = splitConcatenatedJson(jsonBuffer)
  if (objects) {
    jsonBuffer = ""
    for (const obj of objects) {
      yield obj
    }
  }
  // Se splitConcatenatedJson retornou null, e JSON parcial — continuar acumulando
}
```

### Funcao auxiliar `splitConcatenatedJson`

**Arquivo**: `src/process.ts`, adicionar antes de `spawnAndStream()`

```typescript
function splitConcatenatedJson(buffer: string): SDKMessage[] | null {
  // Heuristica rapida: se nao tem }{ nao pode ser concatenacao
  if (!buffer.includes("}{")) return null

  const results: SDKMessage[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === "{") depth++
    else if (buffer[i] === "}") {
      depth--
      if (depth === 0) {
        try {
          const parsed = JSON.parse(buffer.slice(start, i + 1)) as SDKMessage
          results.push(parsed)
          start = i + 1
        } catch {
          return null // Parse falhou — nao e concatenacao valida
        }
      }
    }
  }

  // Se sobrou buffer nao consumido ou nenhum objeto parseado, nao e concatenacao
  if (start < buffer.length || results.length === 0) return null

  return results
}
```

**Nota**: esta heuristica nao trata strings JSON que contem `{` ou `}` literais. Porem, como o OpenClaude CLI emite JSONs de primeiro nivel simples (sem `{` literal em valores string de mensagens), a heuristica e suficiente para o caso de uso. Se no futuro o CLI emitir payloads com `{` em strings, sera necessario um parser mais robusto com tracking de aspas.

---

## Criterios de Aceite

- [ ] Linha com um unico JSON: comportamento identico ao atual
- [ ] Linha com dois JSONs concatenados (`{"type":"a"}{"type":"b"}`): ambos sao yielded
- [ ] Linha com JSON parcial: continua acumulando (nao tenta split)
- [ ] Buffer excedendo MAX_BUFFER_SIZE: lanca erro (regressao)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `streamGen()` — parser JSONL | S-057 |
| `splitConcatenatedJson()` | S-057 |
| Discovery | D-065 |
| Spec anterior | S-037 (sprint-8, dropped no sprint-9) |
