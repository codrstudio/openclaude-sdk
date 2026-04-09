# openclaude-sdk - Filtrar Opcoes Conflitantes em createSession

Limpar campos `resume`, `sessionId` e `continue` das options do caller em `createSession()`.

---

## Objetivo

Resolver D-060 (score 5): se o usuario passa `options: { resume: "old-session", sessionId: "old-id" }` para `createSession()`, essas opcoes sao mergeadas sem filtragem. O primeiro turno passa `sessionId: userSessionId` mas tambem `resume: "old-session"` do caller, criando comportamento ambiguo (o CLI pode tratar `--session-id` e `--resume` como conflitantes).

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `resume` do caller persiste | Primeiro turno pode resumir sessao errada |
| 2 | `sessionId` do caller conflita | CLI recebe dois `--session-id` diferentes |
| 3 | `continue` do caller persiste | Primeiro turno pode continuar sessao anterior em vez de criar nova |

---

## Estado Atual

**Arquivo**: `src/session-v2.ts`, funcao `createSession()`, linhas 45-81

```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const sessionId = opts.sessionId ?? randomUUID()
  // ...
  send(prompt: string, turnOptions?: Partial<Options>): Query {
    const mergedOptions: Options = {
      ...opts.options,      // ← pode conter resume, sessionId, continue
      ...turnOptions,       // ← idem
    }

    if (isFirstTurn) {
      activeQuery = query({
        options: { ...mergedOptions, sessionId },  // sessionId da session sobrescreve
      })
    } else {
      activeQuery = query({
        options: { ...mergedOptions, resume: sessionId },  // resume da session sobrescreve
      })
    }
  }
}
```

No primeiro turno, `mergedOptions` pode conter `resume` e `continue` do caller que nao sao removidos.

---

## Implementacao

**Arquivo**: `src/session-v2.ts`, funcao `send()` dentro de `createSession()`

**Antes:**

```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  const mergedOptions: Options = {
    ...opts.options,
    ...turnOptions,
  }

  if (isFirstTurn) {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, sessionId },
    })
    isFirstTurn = false
  } else {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...mergedOptions, resume: sessionId },
    })
  }

  return activeQuery
}
```

**Depois:**

```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  if (activeQuery) {
    activeQuery.close()
  }

  // Remover campos de session control que createSession gerencia internamente
  const { resume: _r, sessionId: _s, continue: _c, ...baseOptions } = {
    ...opts.options,
    ...turnOptions,
  }

  if (isFirstTurn) {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...baseOptions, sessionId },
    })
    isFirstTurn = false
  } else {
    activeQuery = query({
      prompt,
      model: opts.model,
      registry: opts.registry,
      options: { ...baseOptions, resume: sessionId },
    })
  }

  return activeQuery
}
```

A mesma filtragem deve ser aplicada em `resumeSession()` (linhas 126-145):

**Antes:**

```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  // ...
  const mergedOptions: Options = {
    ...opts.options,
    ...turnOptions,
    resume: sessionId,
  }
```

**Depois:**

```typescript
send(prompt: string, turnOptions?: Partial<Options>): Query {
  // ...
  const { resume: _r, sessionId: _s, continue: _c, ...baseOptions } = {
    ...opts.options,
    ...turnOptions,
  }
  const mergedOptions: Options = {
    ...baseOptions,
    resume: sessionId,
  }
```

---

## Criterios de Aceite

- [ ] `createSession({ options: { resume: "old" } })` — primeiro turno NAO passa `--resume old`
- [ ] `createSession({ options: { sessionId: "old" } })` — primeiro turno usa sessionId da session, nao do caller
- [ ] `createSession({ options: { continue: true } })` — primeiro turno NAO passa `--continue`
- [ ] `resumeSession()` aplica mesma filtragem
- [ ] Opcoes nao conflitantes (ex: `model`, `maxTurns`) sao preservadas normalmente
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `createSession().send()` | S-053 |
| `resumeSession().send()` | S-053 |
| Discovery | D-060 |
