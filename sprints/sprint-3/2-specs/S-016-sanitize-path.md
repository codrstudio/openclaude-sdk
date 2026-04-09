# openclaude-sdk - Reimplementar encodeCwd como sanitizePath com Algoritmo Python

Substituir `encodeCwd()` por `sanitizePath()` usando single regex + truncacao com hash, identico a `_sanitize_path()` do Python SDK.

---

## Objetivo

Resolver D-022, D-024 e D-025:

| Discovery | Problema |
|-----------|----------|
| D-022 | `encodeCwd()` usa `_h_`/`_s_` tokens que divergem do Python (`[^a-zA-Z0-9]` → `-`). SDKs produzem encodings diferentes para o mesmo cwd. |
| D-024 | Paths sanitizados > 200 chars nao sao truncados. Risco de `ENAMETOOLONG` em filesystems com limite de 255 bytes por componente. |
| D-025 | Nome `encodeCwd(dir)` diverge do Python `_sanitize_path(name)`. Refactor de nomenclatura para alinhamento. |

Depende de S-015 (`simpleHash()`).

---

## Algoritmo de Referencia (Python)

```python
_SANITIZE_RE = re.compile(r"[^a-zA-Z0-9]")
MAX_SANITIZED_LENGTH = 200

def _sanitize_path(name: str) -> str:
    sanitized = _SANITIZE_RE.sub("-", name)
    if len(sanitized) <= MAX_SANITIZED_LENGTH:
        return sanitized
    h = _simple_hash(name)
    return f"{sanitized[:MAX_SANITIZED_LENGTH]}-{h}"
```

Comportamento:
1. Substituir **todo** caractere nao-alfanumerico por `-` (um unico regex)
2. Se resultado <= 200 chars, retornar diretamente
3. Se resultado > 200 chars, truncar em 200 e concatenar `-{simpleHash(name)}`

---

## Implementacao

### Substituir `encodeCwd()` em `src/sessions.ts:22-28`

```typescript
const SANITIZE_RE = /[^a-zA-Z0-9]/g
const MAX_SANITIZED_LENGTH = 200

/** Sanitiza nome para uso como diretorio de sessao. Compativel com _sanitize_path() do Python SDK. */
function sanitizePath(name: string): string {
  const sanitized = name.replace(SANITIZE_RE, "-")
  if (sanitized.length <= MAX_SANITIZED_LENGTH) {
    return sanitized
  }
  return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${simpleHash(name)}`
}
```

### Atualizar chamador `getSessionDir()` em `src/sessions.ts:34-38`

```typescript
function getSessionDir(dir?: string): string {
  if (dir) {
    return join(getProjectsDir(), sanitizePath(resolve(dir)))
  }
  return getProjectsDir()
}
```

O `resolve(dir)` continua sendo aplicado no chamador — `sanitizePath()` opera em string pura, nao em path.

### Exemplos de Encoding

| Input | Output (novo) | Output (sprint-2) |
|-------|---------------|-------------------|
| `/foo/bar` | `-foo-bar` | `_s_foo_s_bar` |
| `/foo-bar` | `-foo-bar` | `_s_foo_h_bar` |
| `C:\Users\dev` | `C--Users-dev` | `C_s__s_Users_s_dev` |
| `"a".repeat(300)` | `aaa...aaa-{hash}` (201+ chars) | `aaa...aaa` (300 chars, ENAMETOOLONG) |

**Nota sobre colisoes**: `/foo/bar` e `/foo-bar` produzem a mesma string (`-foo-bar`). Isso e **intencional** — o Python SDK tem o mesmo comportamento. A diferenciacao para paths longos e feita pelo hash suffix. Para paths curtos, a probabilidade de colisao em paths reais e negligivel (requer paths que diferem apenas em tipo de separador).

---

## Compatibilidade

**Breaking change para sessoes sprint-2**: paths encoded com `_h_`/`_s_` tokens nao serao encontrados pelo novo encoding. Isso e aceitavel porque:

1. A SDK e pre-1.0 — nao ha contrato de estabilidade
2. O encoding sprint-2 ja era incompativel com o Python SDK
3. O novo encoding alinha com o CLI Python, que e a implementacao de referencia
4. Sessoes antigas permanecem no disco — nao sao deletadas

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | 22-28 | Substituir `encodeCwd()` por `sanitizePath()` com constantes |
| `src/sessions.ts` | 34-38 | Atualizar `getSessionDir()`: chamar `sanitizePath(resolve(dir))` |

---

## Criterios de Aceite

- [ ] `sanitizePath("/foo/bar")` retorna `"-foo-bar"` (identico ao Python)
- [ ] `sanitizePath("C:\\Users\\dev")` retorna `"C--Users-dev"` (identico ao Python)
- [ ] `sanitizePath("a".repeat(300))` retorna string com <= 200 + 1 + hash chars
- [ ] `sanitizePath("a".repeat(300))` termina com `-{simpleHash("a".repeat(300))}`
- [ ] `sanitizePath("abc123")` retorna `"abc123"` (alfanumericos preservados)
- [ ] `sanitizePath("")` retorna `""` (string vazia)
- [ ] `getSessionDir("/some/path")` usa `sanitizePath(resolve(...))` internamente
- [ ] Nenhuma referencia a `encodeCwd` permanece no codigo
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `sanitizePath()` em `sessions.ts` | S-016 |
| Constantes `SANITIZE_RE`, `MAX_SANITIZED_LENGTH` | S-016 |
| Atualizacao de `getSessionDir()` | S-016 |
| Discoveries | D-022, D-024, D-025 |
| Dependencia | S-015 |
