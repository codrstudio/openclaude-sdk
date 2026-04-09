# openclaude-sdk - Suporte a SDKUserMessage em SDKSession.send()

Permitir que `SDKSession.send()` aceite `string | SDKUserMessage` para conteudo multi-modal em sessoes V2.

---

## Objetivo

Resolver D-067 (score 5): a interface `SDKSession.send()` aceita apenas `string`, mas o TASK.md especifica `string | SDKUserMessage`. Usuarios que queiram enviar conteudo multi-modal (imagens via `ContentBlock[]`) em sessoes V2 ficam bloqueados.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | `send()` aceita apenas `string` | Conteudo multi-modal impossivel via V2 API |
| 2 | `SDKUserMessage` ja exportado no SDK | Tipo existe mas nao e aceito onde deveria |

---

## Estado Atual

**Arquivo**: `src/session-v2.ts`, linhas 20-21

```typescript
export interface SDKSession {
  send(prompt: string, options?: Partial<Options>): Query
}
```

A implementacao em `createSession()` e `resumeSession()` tambem aceita apenas `string` no parametro `prompt`.

---

## Implementacao

### 1. Alterar interface SDKSession

**Arquivo**: `src/session-v2.ts`

**Antes:**

```typescript
send(prompt: string, options?: Partial<Options>): Query
```

**Depois:**

```typescript
send(prompt: string | SDKUserMessage, options?: Partial<Options>): Query
```

### 2. Alterar assinatura de collect()

**Arquivo**: `src/session-v2.ts`

**Antes:**

```typescript
collect(prompt: string, options?: Partial<Options>): Promise<{...}>
```

**Depois:**

```typescript
collect(prompt: string | SDKUserMessage, options?: Partial<Options>): Promise<{...}>
```

### 3. Extrair texto do SDKUserMessage no corpo de send()

Nos metodos `send()` de `createSession()` e `resumeSession()`, converter o prompt para string quando necessario:

```typescript
send(prompt: string | SDKUserMessage, turnOptions?: Partial<Options>): Query {
  const text = typeof prompt === "string"
    ? prompt
    : JSON.stringify(prompt.message.content)

  // ... resto do metodo usando `text` em vez de `prompt`
}
```

**Nota**: o `query()` subjacente aceita `prompt: string`. Para `SDKUserMessage` com `ContentBlock[]`, a serializacao JSON e a forma mais segura de passar conteudo estruturado ao CLI. Verificar se o CLI aceita content blocks como JSON inline — se sim, usar esse formato.

### 4. Importar tipo

**Arquivo**: `src/session-v2.ts`

Adicionar `SDKUserMessage` ao import de `./types/messages.js`.

---

## Criterios de Aceite

- [ ] `SDKSession.send()` aceita `string` (compatibilidade mantida)
- [ ] `SDKSession.send()` aceita `SDKUserMessage`
- [ ] `SDKSession.collect()` aceita ambos os tipos
- [ ] `createSession()` e `resumeSession()` implementam a nova assinatura
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `SDKSession.send()` | S-059 |
| `SDKSession.collect()` | S-059 |
| `src/session-v2.ts` | S-059 |
| Discovery | D-067 |
