# jsonl-partial-buffering

**Severidade**: Alto
**Arquivo alvo**: `src/process.ts` — funcao `spawnAndStream()`, bloco de parse JSONL (linhas 244-261)
**Referencia Python**: `ref/subprocess_cli.py` — metodo `_read_messages_impl()` (linha 543-618)

## Problema

O parser JSONL atual usa `JSON.parse(trimmed)` por linha via readline. Se o CLI emitir um JSON partido em duas linhas (linhas truncadas pelo OS pipe buffer), a mensagem e perdida silenciosamente.

Alem disso, o `catch` generico ignora `SyntaxError` mas tambem pode engolir erros legitimos de outros tipos.

## O que fazer

Implementar buffering de linhas parciais, seguindo o algoritmo do Python:

1. **Buffer acumulativo**: manter `jsonBuffer = ""` entre iteracoes
2. **Skip non-JSON quando buffer vazio**: se `jsonBuffer` esta vazio e a linha nao comeca com `{`, ignorar (linhas debug como `[SandboxDebug]`)
3. **Acumular**: concatenar linha ao buffer
4. **Tentar parse**: se `JSON.parse(jsonBuffer)` funciona, yield e limpar buffer
5. **Falhou**: continuar acumulando (JSON parcial)
6. **Max buffer size**: se buffer > 1MB (configuravel), limpar e lancar erro

## Detalhes de implementacao

```typescript
let jsonBuffer = ""
const MAX_BUFFER_SIZE = 1_048_576 // 1MB

for await (const line of rl) {
  const trimmed = line.trim()
  if (!trimmed) continue

  // Skip non-JSON lines when not mid-parse
  if (!jsonBuffer && !trimmed.startsWith("{")) continue

  jsonBuffer += trimmed

  if (jsonBuffer.length > MAX_BUFFER_SIZE) {
    jsonBuffer = ""
    throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
  }

  try {
    const parsed = JSON.parse(jsonBuffer)
    jsonBuffer = ""
    yield parsed
  } catch {
    // Partial JSON — continue accumulating
    continue
  }
}
```

## Validacao

- JSON partido em 2 linhas deve ser reconstruido
- Linhas `[SandboxDebug]` devem ser ignoradas
- Buffer > 1MB deve lancar erro
- JSON valido em uma unica linha continua funcionando normalmente
