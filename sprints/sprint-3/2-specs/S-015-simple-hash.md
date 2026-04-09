# openclaude-sdk - Implementar simpleHash() Compativel com Python

Funcao auxiliar de hash 32-bit (djb2) com saida base36, identica a `_simple_hash()` do Python SDK.

---

## Objetivo

Resolver D-023: a SDK TypeScript nao possui funcao de hash compativel com o CLI Python. Sem hash identico, paths longos (>200 chars) produzem sufixos diferentes entre as duas SDKs, tornando sessoes inacessiveis cross-SDK.

Pre-requisito para S-016 (sanitizePath com truncacao).

---

## Algoritmo de Referencia (Python)

```python
def _simple_hash(s: str) -> str:
    h = 0
    for ch in s:
        char = ord(ch)
        h = (h << 5) - h + char
        h = h & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    h = abs(h)
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    n = h
    while n > 0:
        out.append(digits[n % 36])
        n //= 36
    return "".join(reversed(out)) if out else "0"
```

O Python simula o comportamento de signed 32-bit overflow do JavaScript. Em JS, o equivalente e direto com `| 0`.

---

## Implementacao

Adicionar em `src/sessions.ts`, antes de `encodeCwd()`:

```typescript
/** Hash djb2 de 32 bits, resultado em base36. Compativel com _simple_hash() do Python SDK. */
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

### Equivalencia JS vs Python

| Operacao | Python | JavaScript |
|----------|--------|------------|
| Shift + soma | `h = (h << 5) - h + char` | `h = ((h << 5) - h + charCode) \| 0` |
| Coerce signed 32-bit | `h & 0xFFFFFFFF` + check `>= 0x80000000` | `\| 0` (nativo) |
| Valor absoluto | `abs(h)` | `Math.abs(h)` |
| Base36 | divisoes sucessivas com lookup | idem |

O `| 0` do JavaScript faz coerce para signed 32-bit integer nativamente, eliminando a necessidade do mask + check que o Python precisa.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | (novo, antes de `encodeCwd`) | Adicionar funcao `simpleHash()` |

---

## Criterios de Aceite

- [ ] `simpleHash("test")` retorna o mesmo valor que `_simple_hash("test")` do Python
- [ ] `simpleHash("")` retorna `"0"`
- [ ] `simpleHash("a".repeat(300))` retorna string nao-vazia em base36
- [ ] Funcao nao e exportada (helper interno)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `simpleHash()` em `sessions.ts` | S-015 |
| Discovery | D-023 |
