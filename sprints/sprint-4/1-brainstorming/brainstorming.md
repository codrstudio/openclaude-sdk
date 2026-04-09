# Brainstorming — openclaude-sdk (Sprint 4)

## Contexto

O TASK.md desta wave é `jsonl-partial-buffering` — implementar buffering acumulativo de linhas JSONL parciais em `src/process.ts`, função `spawnAndStream()`.

**Motivação**: o parser atual usa `JSON.parse(trimmed)` por linha via readline. Se o CLI emitir um JSON partido em duas ou mais linhas (truncação por OS pipe buffer), a mensagem é silenciosamente descartada — o `catch (SyntaxError)` engole o erro sem acumular o fragmento.

A referência Python (`_read_messages_impl()` em `subprocess_cli.py`) resolve isso com um buffer acumulativo (`json_buffer`):
1. Ignora linhas não-JSON quando buffer está vazio
2. Acumula fragmentos no buffer
3. Tenta parse especulativo a cada linha
4. Limita buffer a 1 MB e lança erro se excedido
5. Suporta múltiplos JSON numa linha via `split("\n")`

O comportamento atual (linhas 244-261 de `process.ts`) é funcionalmente correto para JSONs completos em uma linha, mas silencia falhas em JSONs partidos.

## Funcionalidades já implementadas

### Sprints 1, 2 e 3 (todos implementados — D-001 a D-025)

- **D-001 a D-010** (Sprint 1): Package configurado, README, buildCliArgs completo, structured output, hierarquia de erros, permission mid-stream, deep search, SIGINT, resolveExecutable unificado, continueSession.
- **D-011 a D-021** (Sprint 2): filterEnv, kebab-case flags, default nos switches, bedrock/vertex em resolveModelEnv, encodeCwd com _h_/_s_ (substituído), permission input validation, env merge filter, registry input validation, dynamic import estático, internals removidos do exports, catch específico para SyntaxError.
- **D-022 a D-025** (Sprint 3): encodeCwd reimplementado com algoritmo Python-compatível via `_SANITIZE_RE`, simpleHash djb2 base36, truncação com hash para paths >200 chars, renomeação encodeCwd→sanitizePath.

### Estado atual de `src/process.ts` (linhas 244-261)

```typescript
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
```

**Problema**: JSON partido em 2+ linhas pelo pipe buffer é descartado silenciosamente. Linhas `[SandboxDebug]` são tentadas como JSON (falham e são descartadas, mas desnecessariamente).

## Lacunas e Oportunidades

### Gap 26 — JSONL partial buffering ausente (CRÍTICO)

**Arquivo**: `src/process.ts`, linhas 244-261
**Referência Python**: `subprocess_cli.py`, método `_read_messages_impl()`, linhas 543-618

O parser readline atual não acumula fragmentos JSON entre iterações. JSONs truncados pelo OS pipe buffer são silenciosamente perdidos, causando:
1. Perda silenciosa de mensagens do agente
2. `result` nunca chega ao consumidor → query fica pendurada esperando
3. Nenhum indication de falha — o consumidor recebe stream incompleto sem aviso

O fix implementa `jsonBuffer = ""` persistente entre iterações, com:
- Skip de não-JSON quando buffer vazio
- Acumulação de fragmentos
- Parse especulativo por iteração
- Limite de 1 MB com erro explícito se excedido

### Gap 27 — `json_lines.split("\n")` ausente (MÉDIO)

**Arquivo**: `src/process.ts`
**Referência Python**: `subprocess_cli.py` linha 560-562

O Python faz `json_lines = line_str.split("\n")` antes de processar, tratando casos onde o stream entrega múltiplos JSONs concatenados numa única "linha" do readline. O TypeScript atual não faz esse split, podendo acumular dois JSONs num único buffer e nunca parsear nenhum.

Porém, o `readline` do Node.js já divide por `\n` por padrão, então esse cenário é menos provável que no Python com `TextReceiveStream`. Pode ser omitido com justificativa.

### Gap 28 — Configurabilidade de `MAX_BUFFER_SIZE` ausente (BAIXO)

**Arquivo**: `src/process.ts`
**Referência**: Run Prompt especifica `MAX_BUFFER_SIZE` como "configuravel"

O Run Prompt indica que `MAX_BUFFER_SIZE` deve ser configurável. A interface `Options` poderia receber um campo `maxBufferSize?: number` com default `1_048_576` (1 MB). Permite que consumidores com mensagens maiores ajustem o limite.

## Priorização

| ID | Descrição | Score | Justificativa |
|----|-----------|-------|---------------|
| D-026 | JSONL partial buffering — buffer acumulativo em spawnAndStream() | 10 | Gap crítico: JSONs partidos são perdidos silenciosamente. É o único item desta wave. |
| D-027 | Split de múltiplos JSONs por linha (json_lines.split) | 3 | Readline do Node já divide por \n; cenário improvável na prática. |
| D-028 | Configurabilidade de MAX_BUFFER_SIZE via Options | 3 | Mencionado no Run Prompt mas de baixo impacto — hardcode em 1 MB é razoável. |
