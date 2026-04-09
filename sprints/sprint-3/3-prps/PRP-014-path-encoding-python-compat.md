# PRP-014 — Path Encoding Python-Compatible

## Objetivo

Reimplementar o encoding de paths de sessao em `src/sessions.ts` para produzir resultados identicos ao Python SDK (`_sanitize_path()` + `_simple_hash()`), eliminando incompatibilidade cross-SDK e adicionando truncacao para paths longos.

Referencia: specs S-015 (D-023) e S-016 (D-022, D-024, D-025).

## Execution Mode

`implementar`

## Contexto

`encodeCwd()` em `sessions.ts:22-28` usa tokens `_h_`/`_s_` (implementacao sprint-2, F-029) que divergem do algoritmo Python. O Python usa um unico regex `[^a-zA-Z0-9]` substituindo tudo por `-`, com hash suffix para paths > 200 chars.

Resultado: a SDK TypeScript e o CLI Python produzem diretorios diferentes para o mesmo `cwd`. Sessoes criadas por um nao sao encontradas pelo outro.

Referencia Python em `ref/sessions.py`:
- `_simple_hash(s)` — hash djb2 32-bit, coerce signed, base36
- `_sanitize_path(name)` — regex + truncacao 200 chars + hash suffix

## Especificacao

### 1. Implementar `simpleHash()` (S-015)

Adicionar funcao interna (nao exportada) em `src/sessions.ts`:

```typescript
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  let n = Math.abs(h)
  if (n === 0) return "0"
  let out = ""
  while (n > 0) {
    out = "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36] + out
    n = Math.floor(n / 36)
  }
  return out
}
```

Equivalencia com Python:
- `| 0` em JS faz coerce para signed 32-bit (equivale a `h & 0xFFFFFFFF` + check `>= 0x80000000` do Python)
- `Math.abs(h)` equivale a `abs(h)` do Python
- Divisoes sucessivas por 36 com lookup em string de digitos — identico

### 2. Substituir `encodeCwd()` por `sanitizePath()` (S-016)

Remover `encodeCwd()` e substituir por:

```typescript
const SANITIZE_RE = /[^a-zA-Z0-9]/g
const MAX_SANITIZED_LENGTH = 200

function sanitizePath(name: string): string {
  const sanitized = name.replace(SANITIZE_RE, "-")
  if (sanitized.length <= MAX_SANITIZED_LENGTH) {
    return sanitized
  }
  return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${simpleHash(name)}`
}
```

### 3. Atualizar chamador `getSessionDir()`

Em `getSessionDir()` (sessions.ts:34-38), substituir `encodeCwd(...)` por `sanitizePath(resolve(dir))`. O `resolve(dir)` continua no chamador — `sanitizePath()` opera em string pura.

### Resultados esperados

| Input | sanitizePath() | Antigo encodeCwd() |
|-------|---------------|-------------------|
| `/foo/bar` | `-foo-bar` | `_s_foo_s_bar` |
| `/foo-bar` | `-foo-bar` | `_s_foo_h_bar` |
| `C:\Users\dev` | `C--Users-dev` | `C_s__s_Users_s_dev` |
| `abc123` | `abc123` | `abc123` |
| `""` | `""` | `""` |
| `"a".repeat(300)` | `aaa...aaa-{hash}` (201+ chars) | `aaa...aaa` (300 chars) |

Nota: `/foo/bar` e `/foo-bar` produzem a mesma string. Isso e **intencional** — identico ao comportamento Python. Para paths curtos, a probabilidade de colisao em paths reais e negligivel.

### Compatibilidade

**Breaking change** para sessoes criadas com encoding sprint-2. Aceitavel porque:
1. SDK e pre-1.0 — sem contrato de estabilidade
2. Encoding sprint-2 ja era incompativel com Python
3. Novo encoding alinha com a implementacao de referencia
4. Sessoes antigas permanecem no disco

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-035 | simpleHash | Implementar `simpleHash(s: string): string` — hash djb2 32-bit em base36, compativel com `_simple_hash()` do Python SDK |
| F-036 | sanitizePath | Substituir `encodeCwd()` por `sanitizePath()` com single regex `[^a-zA-Z0-9]` → `-` e truncacao > 200 chars com hash suffix. Atualizar `getSessionDir()`. |

## Limites

- NAO criar funcao de migracao de sessoes antigas
- NAO alterar a interface publica de `listSessions()` ou `getSessionMessages()`
- NAO modificar nenhuma outra funcao de sessions.ts alem de `encodeCwd` e `getSessionDir`
- NAO exportar `simpleHash()` — e helper interno
- NAO exportar `sanitizePath()` — e helper interno
- NAO adicionar testes (nao ha framework de teste configurado)

## Dependencias

Nenhuma dependencia externa. F-036 depende de F-035 (mesmo PRP, ordem sequencial).
