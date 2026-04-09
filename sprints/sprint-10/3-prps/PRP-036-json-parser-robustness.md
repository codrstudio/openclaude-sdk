# PRP-036 — JSON Parser Robustness

## Objetivo

Corrigir falha do parser JSON ao receber multiplos objetos concatenados na mesma linha e tornar o limite de buffer configuravel via `Options.maxBufferSize`.

Referencia: specs S-057 (D-065), S-058 (D-066).

## Execution Mode

`implementar`

## Contexto

O parser JSON em `src/process.ts`, funcao `spawnAndStream()` → `streamGen()` (linhas 311-371), acumula linhas de stdout em `jsonBuffer` e tenta `JSON.parse()`. Dois problemas:

1. **JSONs concatenados** (S-057): Se o CLI emitir `{"type":"a"}{"type":"b"}` numa unica linha, `JSON.parse()` falha (JSON invalido). O buffer continua acumulando linhas subsequentes ate atingir `MAX_BUFFER_SIZE` e lanca erro. Re-introducao do gap do sprint-8.

2. **Buffer fixo** (S-058): `MAX_BUFFER_SIZE` esta hardcoded em `1_048_576` (1MB) na linha 323. Prompts com imagens base64 ou ferramentas com respostas binarias extensas podem exceder 1MB legitimamente. Nao ha como o usuario configurar este limite.

## Especificacao

### Feature F-084 — Tratar JSONs concatenados na mesma linha

**1. Adicionar funcao helper `splitConcatenatedJson()` em `src/process.ts`, antes de `spawnAndStream()`:**

```typescript
function splitConcatenatedJson(text: string): object[] | null {
  const objects: object[] = []
  let depth = 0
  let start = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === "\\") {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        try {
          objects.push(JSON.parse(slice))
        } catch {
          return null // parse failure — not valid concatenated JSON
        }
      }
    }
  }

  // If depth != 0, text contains incomplete JSON
  if (depth !== 0) return null

  return objects.length > 1 ? objects : null
}
```

Notas:
- Usa rastreamento de profundidade de chaves com tratamento de strings (aspas e escape)
- Retorna `null` se nao for um caso de concatenacao valida (1 ou 0 objetos, parse error, JSON incompleto)
- Trata corretamente `{` e `}` dentro de strings JSON (via flag `inString`)

**2. Alterar o bloco try/catch do parser em `streamGen()` (linhas 342-349):**

Estado atual:
```typescript
try {
  const parsed = JSON.parse(jsonBuffer) as SDKMessage
  jsonBuffer = ""
  yield parsed
} catch {
  // Partial JSON — continue accumulating
  continue
}
```

Novo:
```typescript
try {
  const parsed = JSON.parse(jsonBuffer) as SDKMessage
  jsonBuffer = ""
  yield parsed
} catch {
  // Try splitting concatenated JSONs before continuing accumulation
  const parts = splitConcatenatedJson(jsonBuffer)
  if (parts) {
    jsonBuffer = ""
    for (const obj of parts) {
      yield obj as SDKMessage
    }
  }
  // else: partial JSON — continue accumulating
}
```

Mudancas:
- Quando `JSON.parse()` falha, tentar `splitConcatenatedJson()` antes de continuar acumulando
- Se split retorna objetos, yield cada um e limpar buffer
- Se split retorna `null`, manter comportamento original (partial JSON, continuar acumulando)

### Feature F-085 — Tornar MAX_BUFFER_SIZE configuravel

**1. Adicionar campo `maxBufferSize` a interface `Options` em `src/types/options.ts`:**

Adicionar apos `maxBudgetUsd` (linha 293):
```typescript
maxBufferSize?: number
```

**2. Alterar assinatura de `spawnAndStream()` em `src/process.ts` (linhas 183-197):**

Estado atual:
```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: {
    cwd?: string
    env?: Record<string, string | undefined>
    signal?: AbortSignal
    timeoutMs?: number
    permissionMode?: string
  } = {},
): {
```

Novo:
```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: {
    cwd?: string
    env?: Record<string, string | undefined>
    signal?: AbortSignal
    timeoutMs?: number
    permissionMode?: string
    maxBufferSize?: number
  } = {},
): {
```

**3. Alterar `streamGen()` em `src/process.ts` (linha 323):**

Estado atual:
```typescript
const MAX_BUFFER_SIZE = 1_048_576 // 1MB
```

Novo:
```typescript
const MAX_BUFFER_SIZE = options.maxBufferSize ?? 1_048_576
```

**4. Atualizar mensagem de erro (linha 339):**

Estado atual:
```typescript
throw new Error(`JSON message exceeded max buffer size of ${MAX_BUFFER_SIZE} bytes`)
```

Nenhuma mudanca — ja usa a variavel `MAX_BUFFER_SIZE`, que agora reflete o valor configurado.

**5. Passar `maxBufferSize` de `query()` para `spawnAndStream()` em `src/query.ts` (linhas 217-223):**

Estado atual:
```typescript
const { stream, writeStdin, close: closeProc } = spawnAndStream(command, args, prompt, {
  cwd: resolvedOptions.cwd,
  env: resolvedOptions.env,
  signal: abortController.signal,
  permissionMode: resolvedOptions.permissionMode,
  timeoutMs: resolvedOptions.timeoutMs,
})
```

Novo:
```typescript
const { stream, writeStdin, close: closeProc } = spawnAndStream(command, args, prompt, {
  cwd: optionsForCli.cwd,
  env: optionsForCli.env,
  signal: abortController.signal,
  permissionMode: optionsForCli.permissionMode,
  timeoutMs: optionsForCli.timeoutMs,
  maxBufferSize: optionsForCli.maxBufferSize,
})
```

**Nota**: se PRP-035 (F-081) ja foi implementado, a variavel sera `optionsForCli`. Caso contrario, usar `resolvedOptions`. Ambas as variaveis contem o mesmo campo `maxBufferSize` — a diferenca e apenas nos configs de MCP.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Linha com 1 JSON valido | Parse OK, yield | Parse OK, yield (identico) |
| Linha `{"a":1}{"b":2}` | Parse falha, buffer cresce, eventual erro MAX_BUFFER | Split em 2 objetos, yield ambos |
| Linha `{"a":1}{"b":2}{"c":3}` | Parse falha, erro eventual | Split em 3 objetos, yield todos |
| JSON parcial `{"a":` | Parse falha, continua acumulando | Parse falha, split retorna null, continua acumulando (identico) |
| Sem `maxBufferSize` | Limite fixo 1MB | Limite 1MB (identico, default) |
| `maxBufferSize: 10_485_760` | Limite fixo 1MB | Limite 10MB |
| Buffer excede limite configurado | Erro "exceeded 1048576 bytes" | Erro "exceeded 10485760 bytes" |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-084 | splitConcatenatedJson | Helper `splitConcatenatedJson()` + integracao no catch do parser para tratar JSONs concatenados |
| F-085 | configurableMaxBufferSize | `Options.maxBufferSize` opcional, propagado de `query()` ate `streamGen()`, default 1MB |

## Limites

- NAO alterar o readline parser — manter `createInterface()` como mecanismo de leitura de linhas
- NAO alterar o fluxo normal de JSON unico por linha — split so e tentado apos `JSON.parse()` falhar
- NAO adicionar testes (nao ha framework de teste configurado)
- NAO alterar `buildCliArgs()` — `maxBufferSize` nao e uma flag CLI, e apenas configuracao interna do SDK

## Dependencias

F-085 depende que `query()` propague a opcao para `spawnAndStream()`. Se PRP-035 (F-081) for implementado primeiro, a variavel em `lifecycleGenerator()` sera `optionsForCli`; caso contrario, sera `resolvedOptions`. Ambos funcionam — nao ha dependencia sequencial obrigatoria.
