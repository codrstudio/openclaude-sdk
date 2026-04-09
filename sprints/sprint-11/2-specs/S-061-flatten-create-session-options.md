# openclaude-sdk - Flatten Ergonomia de CreateSessionOptions

Eliminar nesting desnecessario em `CreateSessionOptions` promovendo campos frequentes ao nivel raiz.

---

## Objetivo

Resolver D-069 (score 2): `CreateSessionOptions` tem `model` ao nivel raiz mas demais campos de `Options` ficam aninhados em `options?: Options`. Isso cria inconsistencia ergonomica:

```typescript
// Atual — model no raiz, o resto aninhado
createSession({ model: "claude-sonnet-4-6", options: { maxTurns: 5 } })

// Esperado — campos frequentes no raiz
createSession({ model: "claude-sonnet-4-6", maxTurns: 5 })
```

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `options` aninhado dentro de `CreateSessionOptions` | Ergonomia ruim para campos frequentes |
| 2 | `model` no raiz mas `maxTurns` um nivel abaixo | Inconsistencia na API |

---

## Estado Atual

**Arquivo**: `src/session-v2.ts`, linhas 38-43

```typescript
export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}
```

Mesma estrutura em `ResumeSessionOptions` (linhas 115-119) e `PromptOptions` (linhas 183-187).

---

## Implementacao

### 1. Redesenhar CreateSessionOptions

**Arquivo**: `src/session-v2.ts`

**Antes:**

```typescript
export interface CreateSessionOptions {
  model?: string
  registry?: ProviderRegistry
  options?: Options
  sessionId?: string
}
```

**Depois:**

```typescript
export interface CreateSessionOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
  sessionId?: string
}
```

### 2. Aplicar mesma mudanca a ResumeSessionOptions e PromptOptions

**Arquivo**: `src/session-v2.ts`

```typescript
export interface ResumeSessionOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
}

export interface PromptOptions extends Partial<Options> {
  model?: string
  registry?: ProviderRegistry
}
```

### 3. Ajustar corpo dos metodos

Onde antes se usava `opts.options`, agora extrair `model`, `registry`, `sessionId` e usar o restante como `Options`:

```typescript
export function createSession(opts: CreateSessionOptions = {}): SDKSession {
  const { model, registry, sessionId: providedSessionId, ...options } = opts
  const sid = providedSessionId ?? randomUUID()
  // usar `options` onde antes usava `opts.options`
  // usar `model` onde antes usava `opts.model`
  // usar `registry` onde antes usava `opts.registry`
}
```

### 4. Manter compatibilidade

Se `Options` tiver campos com nomes conflitantes com `model`, `registry` ou `sessionId`, resolver via prioridade do nivel raiz. Verificar que `Options` nao tem esses campos (atualmente nao tem — `model` e passado separado ao `query()`).

---

## Criterios de Aceite

- [ ] `createSession({ model: "...", maxTurns: 5 })` funciona sem nesting
- [ ] `resumeSession(id, { model: "...", maxTurns: 5 })` funciona sem nesting
- [ ] `prompt(text, { model: "...", maxTurns: 5 })` funciona sem nesting
- [ ] Tipagem correta — IntelliSense mostra campos de `Options` na raiz
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `CreateSessionOptions` | S-061 |
| `ResumeSessionOptions` | S-061 |
| `PromptOptions` | S-061 |
| `src/session-v2.ts` | S-061 |
| Discovery | D-069 |
