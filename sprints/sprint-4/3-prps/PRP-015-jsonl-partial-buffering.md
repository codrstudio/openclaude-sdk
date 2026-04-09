# PRP-015 — JSONL Partial Buffering

## Objetivo

Substituir o parser JSONL linha-a-linha em `spawnAndStream()` por um parser com buffer acumulativo que reconstroi mensagens JSON truncadas pelo OS pipe buffer, eliminando perda silenciosa de mensagens.

Referencia: spec S-017 (D-026).

## Execution Mode

`implementar`

## Contexto

O parser JSONL atual em `src/process.ts` (linhas 244-261) usa `JSON.parse(trimmed)` por linha via `readline`. Quando o CLI emite um JSON partido em duas ou mais linhas (truncacao pelo OS pipe buffer), cada fragmento falha no parse e e descartado silenciosamente pelo `catch (SyntaxError)`.

Consequencias:
1. Perda silenciosa de mensagens do agente
2. `result` nunca chega ao consumidor — query fica pendurada
3. Nenhuma indicacao de falha — stream incompleto sem aviso

O algoritmo de referencia Python (`subprocess_cli.py`, metodo `_read_messages_impl()`, linhas 543-618) resolve isso com um buffer acumulativo (`json_buffer`) persistente entre iteracoes.

Diferencas intencionais em relacao ao Python (documentadas em S-017):
- Sem `json_lines.split("\n")` — `readline` do Node ja divide por `\n` nativamente (D-027, score 3, descartado)
- `MAX_BUFFER_SIZE` como constante local, nao configuravel — 1 MB e suficiente para qualquer mensagem real (D-028, score 3, descartado)
- `Error` generico no overflow em vez de `SDKJSONDecodeError` customizado — SDK nao tem essa classe; o erro e re-wrapped pelo catch externo como `Stream read error:`

## Especificacao

### Substituir bloco de parse JSONL em `src/process.ts` (linhas 244-261)

**Codigo atual** (a ser substituido):

```typescript
if (proc.stdout) {
  const rl = createInterface({ input: proc.stdout })

  try {
    for await (const line of rl) {
      if (options.signal?.aborted) break

      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const parsed = JSON.parse(trimmed) as SDKMessage
        yield parsed
      } catch (err) {
        if (err instanceof SyntaxError) continue
        throw err
      }
    }
  } catch (err) {
    if (!options.signal?.aborted) {
      throw new Error(`Stream read error: ${err}`)
    }
  }
}
```

**Codigo novo**:

```typescript
if (proc.stdout) {
  const rl = createInterface({ input: proc.stdout })
  let jsonBuffer = ""
  const MAX_BUFFER_SIZE = 1_048_576 // 1 MB

  try {
    for await (const line of rl) {
      if (options.signal?.aborted) break

      const trimmed = line.trim()
      if (!trimmed) continue

      // Skip non-JSON lines when not mid-parse (e.g. [SandboxDebug])
      if (!jsonBuffer && !trimmed.startsWith("{")) continue

      jsonBuffer += trimmed

      if (jsonBuffer.length > MAX_BUFFER_SIZE) {
        jsonBuffer = ""
        throw new Error(
          `JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`,
        )
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
  } catch (err) {
    if (!options.signal?.aborted) {
      throw new Error(`Stream read error: ${err}`)
    }
  }
}
```

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| JSON valido em uma linha | Parse e yield | Parse e yield (sem mudanca) |
| JSON partido em 2 linhas | Descartado silenciosamente | Acumulado e parseado |
| JSON partido em 3+ linhas | Descartado silenciosamente | Acumulado e parseado |
| Linha `[SandboxDebug]` | Tentado como JSON, falha silenciosa | Ignorado via skip eficiente |
| Buffer > 1 MB | N/A | Erro explicito lancado |
| Signal aborted mid-buffer | Break do loop | Break do loop (sem mudanca) |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-037 | jsonlPartialBuffering | Substituir bloco de parse JSONL em `spawnAndStream()` por versao com buffer acumulativo: `jsonBuffer` persistente entre iteracoes, skip de linhas nao-JSON quando buffer vazio, limite 1 MB com erro explicito |

## Limites

- NAO adicionar `json_lines.split("\n")` — readline do Node ja divide por `\n` (D-027 descartado)
- NAO tornar `MAX_BUFFER_SIZE` configuravel via Options — constante local e suficiente (D-028 descartado)
- NAO criar classe de erro customizada para overflow — usar `Error` generico
- NAO exportar `MAX_BUFFER_SIZE` — e variavel local dentro da funcao
- NAO alterar nenhum outro trecho de `process.ts` alem do bloco de parse JSONL (linhas 244-261)
- NAO alterar a interface publica de `spawnAndStream()` nem de `Options`
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia externa. Nenhuma dependencia de outros PRPs.
