# openclaude-sdk - Corrigir Mutacao de options.env em query()

Eliminar a mutacao do objeto `options` passado pelo caller em `query()` quando registry e model sao fornecidos.

---

## Objetivo

Resolver D-030 (score 7): `query()` muta `options.env` diretamente, contaminando o objeto do caller. Se o mesmo objeto `options` for reutilizado entre multiplas queries com diferentes models/registries, o `env` acumula vars de cada chamada anterior.

---

## Estado Atual

**Arquivo**: `src/query.ts`, linhas 45-51

```typescript
export function query(params: {
  prompt: string
  model?: string
  registry?: ProviderRegistry
  options?: Options
}): Query {
  const { prompt, model, registry, options = {} } = params

  if (registry && model) {
    const envFromRegistry = resolveModelEnv(registry, model)
    options.env = { ...options.env, ...envFromRegistry }   // <— MUTA o objeto do caller
  }
  // ...
}
```

### Cenario do bug

```typescript
const opts: Options = { env: { MY_VAR: "value" } }

// Primeira query: opts.env agora tem MY_VAR + OPENROUTER_API_KEY + OPENAI_BASE_URL
query({ prompt: "A", model: "gpt-4o", registry: routerA, options: opts })

// Segunda query: opts.env acumula vars da primeira + vars da segunda
query({ prompt: "B", model: "claude-3", registry: routerB, options: opts })
```

---

## Implementacao

Criar copia local de `options` para evitar mutacao do objeto do caller.

**Antes:**

```typescript
const { prompt, model, registry, options = {} } = params

if (registry && model) {
  const envFromRegistry = resolveModelEnv(registry, model)
  options.env = { ...options.env, ...envFromRegistry }
}

const { command, prependArgs } = resolveExecutable(options)
const args = [...prependArgs, ...buildCliArgs(options)]
const abortController = options.abortController ?? new AbortController()
```

**Depois:**

```typescript
const { prompt, model, registry, options = {} } = params

let resolvedOptions = options
if (registry && model) {
  const envFromRegistry = resolveModelEnv(registry, model)
  resolvedOptions = { ...options, env: { ...options.env, ...envFromRegistry } }
}

const { command, prependArgs } = resolveExecutable(resolvedOptions)
const args = [...prependArgs, ...buildCliArgs(resolvedOptions)]
const abortController = resolvedOptions.abortController ?? new AbortController()
```

Substituir todas as referencias a `options` apos o bloco por `resolvedOptions`:

| Linha | Antes | Depois |
|-------|-------|--------|
| ~53 | `resolveExecutable(options)` | `resolveExecutable(resolvedOptions)` |
| ~54 | `buildCliArgs(options)` | `buildCliArgs(resolvedOptions)` |
| ~55 | `options.abortController` | `resolvedOptions.abortController` |
| ~57 | `options.cwd` | `resolvedOptions.cwd` |
| ~58 | `options.env` | `resolvedOptions.env` |
| ~59 | `options.permissionMode` | `resolvedOptions.permissionMode` |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/query.ts` | 45-62 | Substituir mutacao de `options` por copia local `resolvedOptions` |

---

## Criterios de Aceite

- [ ] Objeto `options` passado pelo caller nao e mutado apos `query()`
- [ ] Vars do registry sao corretamente passadas ao child process
- [ ] Multiplas queries com mesmo `options` e registries diferentes nao acumulam env vars
- [ ] `continueSession()` continua funcionando (delega para `query()`)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Immutabilidade de `options` em `query()` | S-019 |
| Discovery | D-030 |
