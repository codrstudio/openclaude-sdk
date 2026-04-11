# fix-path-encoding

**Severidade**: Critico
**Arquivo alvo**: `src/sessions.ts` — funcao `encodeCwd()` (linha 22-28)
**Referencia Python**: `ref/sessions.py` — funcoes `_sanitize_path()` (linha 92-102) e `_simple_hash()` (linha 69-89)

## Problema

`encodeCwd()` atual usa substituicoes de caracteres que causam colisoes:
- `/foo/bar` e `/foo-bar` geram a mesma string encoded
- Paths longos (>200 chars) nao sao truncados com hash suffix

Isso causa corrupcao silenciosa: sessoes de projetos diferentes mapeiam para o mesmo diretorio.

## O que fazer

Reimplementar `encodeCwd()` seguindo o algoritmo do Python:

1. **Sanitizar**: substituir todos os chars nao-alfanumericos por `-` (um unico regex `[^a-zA-Z0-9]`)
2. **Hash para paths longos**: se o resultado > 200 chars, truncar em 200 e concatenar `-{hash}`
3. **Hash**: implementar `simpleHash()` — hash de 32 bits compativel com JS (`(h << 5) - h + charCode`, coerce para signed 32-bit via `| 0`), converter para base36

O Python usa `_SANITIZE_RE = re.compile(r"[^a-zA-Z0-9]")` — sem distinção entre hifens, separadores, etc. Tudo vira hifen. A diferenciacao e feita pelo hash em caso de ambiguidade.

## Funcoes a criar/modificar

- `encodeCwd(dir: string): string` → renomear para `sanitizePath(name: string): string` para ficar alinhado
- `simpleHash(s: string): string` — nova funcao auxiliar

## Validacao

- `sanitizePath("/foo/bar")` !== `sanitizePath("/foo-bar")`
- `sanitizePath("a".repeat(300))` deve ter <= 200 + 1 + hash chars
- `simpleHash("test")` deve retornar o mesmo valor que a versao Python
