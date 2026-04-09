# openclaude-sdk - Getter currentQuery em SDKSession

Expor getter readonly `currentQuery` em `SDKSession` para acesso externo a `Query` ativa.

---

## Objetivo

Resolver D-070 (score 2): consumidores nao conseguem acessar a `Query` ativa de uma `SDKSession` para operacoes avancadas (ex: `abort()` direto, inspecao de estado) sem usar `close()`. Um getter `currentQuery?: Query` permite acesso controlado.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `activeQuery` e variavel interna sem acesso | Impossivel abortar query sem fechar sessao inteira |
| 2 | `close()` fecha sessao e query juntos | Granularidade insuficiente para casos avancados |

---

## Estado Atual

**Arquivo**: `src/session-v2.ts`

A variavel `activeQuery` e local ao closure de `createSession()` e `resumeSession()`, sem getter publico:

```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  let activeQuery: Query | null = null
  // ...
  return { sessionId, send(...) { ... }, collect(...) { ... }, close() { ... } }
}
```

---

## Implementacao

### 1. Adicionar campo a interface SDKSession

**Arquivo**: `src/session-v2.ts`

```typescript
export interface SDKSession {
  readonly sessionId: string
  /** Query ativa (null se nenhuma query em andamento) */
  readonly currentQuery: Query | null
  send(prompt: string, options?: Partial<Options>): Query
  collect(prompt: string, options?: Partial<Options>): Promise<{...}>
  close(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}
```

### 2. Implementar getter em createSession()

**Arquivo**: `src/session-v2.ts`

Adicionar property ao objeto retornado:

```typescript
return {
  sessionId,
  get currentQuery() { return activeQuery },
  send(...) { ... },
  // ...
}
```

### 3. Implementar getter em resumeSession()

Mesma mudanca no objeto retornado por `resumeSession()`.

---

## Criterios de Aceite

- [ ] `session.currentQuery` retorna `Query | null`
- [ ] Retorna `null` antes de qualquer `send()`
- [ ] Retorna a `Query` ativa apos `send()`
- [ ] Retorna `null` apos `close()`
- [ ] Campo e readonly (nao permite atribuicao)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `SDKSession.currentQuery` | S-062 |
| `createSession()` | S-062 |
| `resumeSession()` | S-062 |
| `src/session-v2.ts` | S-062 |
| Discovery | D-070 |
