# openclaude-sdk - Buffering Acumulativo de JSONL Parcial

Implementar buffer acumulativo no parser JSONL de `spawnAndStream()` para reconstruir mensagens JSON truncadas pelo OS pipe buffer.

---

## Objetivo

Resolver D-026: o parser JSONL atual em `src/process.ts` (linhas 244-261) usa `JSON.parse(trimmed)` por linha via readline. Se o CLI emitir um JSON partido em duas ou mais linhas (truncacao por OS pipe buffer), a mensagem e silenciosamente descartada — o `catch (SyntaxError)` ignora o fragmento sem acumula-lo.

Consequencias do bug atual:
1. Perda silenciosa de mensagens do agente
2. `result` nunca chega ao consumidor — query fica pendurada
3. Nenhuma indicacao de falha — stream incompleto sem aviso

---

## Algoritmo de Referencia (Python)

```python
# subprocess_cli.py — _read_messages_impl() (linhas 543-618)

json_buffer = ""

async for line in self._stdout_stream:
    line_str = line.strip()
    if not line_str:
        continue

    json_lines = line_str.split("\n")

    for json_line in json_lines:
        json_line = json_line.strip()
        if not json_line:
            continue

        # Skip non-JSON quando buffer vazio
        if not json_buffer and not json_line.startswith("{"):
            continue

        json_buffer += json_line

        if len(json_buffer) > self._max_buffer_size:
            json_buffer = ""
            raise SDKJSONDecodeError(...)

        try:
            data = json.loads(json_buffer)
            json_buffer = ""
            yield data
        except json.JSONDecodeError:
            continue
```

---

## Implementacao

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

### Diferencas em relacao ao Python

| Aspecto | Python | TypeScript (esta spec) | Justificativa |
|---------|--------|------------------------|---------------|
| `json_lines.split("\n")` | Sim | Nao | `readline` do Node ja divide por `\n` nativamente. `TextReceiveStream` do Python pode concatenar linhas; Node readline nao tem esse comportamento (D-027, score 3). |
| `MAX_BUFFER_SIZE` configuravel | Sim (`self._max_buffer_size`) | Nao (constante `1_048_576`) | 1 MB e suficiente para qualquer mensagem JSON real do CLI. Configurabilidade adiciona complexidade por pouco beneficio pratico (D-028, score 3). |
| Tipo de erro no overflow | `SDKJSONDecodeError` customizado | `Error` generico | SDK TypeScript nao tem `SDKJSONDecodeError`. O erro e re-wrapped pelo `catch` externo como `Stream read error:`. |
| Catch generico vs especifico | `json.JSONDecodeError` | `catch` sem tipo | No bloco de parse especulativo, qualquer erro indica JSON incompleto. O `catch` anterior (D-021) ja foi corrigido para `SyntaxError` especifico; aqui o catch generico e intencional pois estamos fazendo parse especulativo — se falhar por qualquer razao, acumular e tentar novamente. |

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| JSON valido em uma linha | ✅ Parse e yield | ✅ Parse e yield (sem mudanca) |
| JSON partido em 2 linhas | ❌ Descartado silenciosamente | ✅ Acumulado e parseado |
| JSON partido em 3+ linhas | ❌ Descartado silenciosamente | ✅ Acumulado e parseado |
| Linha `[SandboxDebug]` | ❌ Tentado como JSON, falha silenciosa | ✅ Ignorado (skip eficiente) |
| Buffer > 1 MB | N/A | ✅ Erro explicito lançado |
| Signal aborted mid-buffer | ✅ Break do loop | ✅ Break do loop (sem mudanca) |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | 244-261 | Substituir bloco de parse JSONL por versao com buffer acumulativo |

---

## Criterios de Aceite

- [ ] JSON valido em uma unica linha continua sendo parseado e yielded normalmente
- [ ] JSON partido em 2 linhas pelo pipe buffer e reconstruido e yielded
- [ ] JSON partido em 3+ linhas e reconstruido e yielded
- [ ] Linhas nao-JSON como `[SandboxDebug]` sao ignoradas sem tentar parse
- [ ] Linhas nao-JSON durante acumulo de buffer (mid-parse) sao concatenadas ao buffer (comportamento identico ao Python)
- [ ] Buffer > 1 MB (`1_048_576` bytes) limpa o buffer e lanca `Error`
- [ ] `options.signal?.aborted` interrompe o loop mesmo durante acumulo
- [ ] Nenhuma constante `MAX_BUFFER_SIZE` e exportada (variavel local)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Buffer acumulativo em `spawnAndStream()` | S-017 |
| Constante `MAX_BUFFER_SIZE` | S-017 |
| Skip de linhas nao-JSON | S-017 |
| Discovery | D-026 |
| Discoveries descartadas (baixo score) | D-027, D-028 |
