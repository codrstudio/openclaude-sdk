# session-lite-read

**Severidade**: Alto
**Arquivo alvo**: `src/sessions.ts` — funcoes `readSessionFile()` (linha 41-88) e `listSessionsInDir()` (linha 94-132)
**Referencia Python**: `ref/sessions.py` — classe `_LiteSessionFile` (linha 319-328), funcao `_read_session_lite()` (linha 331-358), funcao `_extract_json_string_field()` (linha 183-204), funcao `_parse_session_info_from_lite()` (linha 399-485)

## Problema

`readSessionFile()` le o arquivo JSONL inteiro e faz parse de todas as linhas para extrair metadata (sessionId, firstPrompt, customTitle, tag). Para sessoes longas (centenas de MB de transcript), isso e extremamente lento e consome memoria desnecessariamente.

`listSessions()` chama `readSessionFile()` para cada sessao — O(n * tamanho_arquivo).

## O que fazer

Implementar lite read: ler apenas head (64KB) e tail (64KB) de cada arquivo, extrair campos via busca de string sem parse JSON completo.

### Passo 1: `readSessionLite(filePath)`

```typescript
const LITE_BUF_SIZE = 65536 // 64KB

interface LiteSessionFile {
  mtime: number
  size: number
  head: string
  tail: string
}
```

- Abrir o arquivo com `fs.open()`
- Ler `head` = primeiros 64KB
- Se `size > 64KB`, seek para `size - 64KB` e ler `tail`; senao `tail = head`
- Retornar `{ mtime, size, head, tail }`

### Passo 2: `extractJsonStringField(text, key)`

Busca de string para `"key":"value"` ou `"key": "value"` sem JSON.parse:
- Encontrar o pattern no texto
- Iterar char a char a partir do inicio do valor
- Tratar `\"` escaped
- Retornar o valor ate o `"` de fechamento

### Passo 3: Refatorar `listSessionsInDir()`

Substituir a chamada a `readSessionFile()` por `readSessionLite()` + extracao de campos via `extractJsonStringField()`.

Campos a extrair:
- `customTitle` (last occurrence no tail, fallback no head)
- `aiTitle` (idem)
- `firstPrompt` (primeira mensagem user no head)
- `tag` (last occurrence, apenas em linhas `{"type":"tag"...}`)
- `gitBranch` (tail, fallback head)
- `cwd` (head)
- `createdAt` (timestamp da primeira linha)

### Passo 4: Refatorar `getSessionInfo()`

Nao chamar `listSessions()` + find. Fazer lookup direto: abrir o arquivo, lite read, extrair campos. O(1) em vez de O(n).

## Validacao

- `listSessions()` com sessoes de 100MB+ deve completar em < 1s
- Todos os campos extraidos devem bater com o resultado do parse completo
- Sessoes sidechain (`"isSidechain":true` na primeira linha) devem ser filtradas
