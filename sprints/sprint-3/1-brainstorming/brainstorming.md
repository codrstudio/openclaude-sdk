# Brainstorming — openclaude-sdk (Sprint 3)

## Contexto

O TASK.md desta wave é `fix-path-encoding` — reimplementar `encodeCwd()` em `src/sessions.ts` para alinhar com o algoritmo exato do Python SDK (`_sanitize_path()` + `_simple_hash()`).

**Motivação**: o sprint-2 (F-029) resolveu a colisão de paths com uma estratégia diferente (`_h_`/`_s_` para substituição distinta de hifens vs separadores). Essa abordagem resolve o problema de colisão localmente, mas:
1. Não é compatível com o algoritmo Python — cria diretórios com encoding diferente do que o CLI espera
2. Não trata paths longos (>200 chars) com hash suffix
3. Usa lógica de múltiplos regex que diverge da referência

A paridade algoritmica com o Python SDK é necessária para que a SDK TypeScript interopere corretamente com instâncias que usam o CLI Python como backend — ambos devem resolver o mesmo `cwd` para o mesmo diretório de sessão.

A referência Python está disponível em:
`D:/aw/context/workspaces/openclaude-sdk/repo/sprints/backlog/00-fix-path-encoding/ref/sessions.py`

Algoritmo Python relevante:
```python
_SANITIZE_RE = re.compile(r"[^a-zA-Z0-9]")
MAX_SANITIZED_LENGTH = 200

def _simple_hash(s: str) -> str:
    h = 0
    for ch in s:
        char = ord(ch)
        h = (h << 5) - h + char
        h = h & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    h = abs(h)
    # JS toString(36)
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    n = h
    while n > 0:
        out.append(digits[n % 36])
        n //= 36
    return "".join(reversed(out)) if out else "0"

def _sanitize_path(name: str) -> str:
    sanitized = _SANITIZE_RE.sub("-", name)
    if len(sanitized) <= MAX_SANITIZED_LENGTH:
        return sanitized
    h = _simple_hash(name)
    return f"{sanitized[:MAX_SANITIZED_LENGTH]}-{h}"
```

## Funcionalidades já implementadas

### Sprints 1 e 2 (todos implementados)

- **D-001 a D-010** (Sprint 1): Package configurado, README, buildCliArgs completo, structured output, hierarquia de erros, permission mid-stream, deep search, SIGINT, resolveExecutable unificado, continueSession.
- **D-011**: filterEnv — filtra undefined de options.env antes do spawn (F-022)
- **D-012**: Kebab-case flags — `--allowed-tools`, `--disallowed-tools` (F-024)
- **D-013**: Default no switch de msg.subtype em collectMessages() (F-025)
- **D-014**: Default no switch de msg.error em collectMessages() (F-026)
- **D-015**: encodeCwd com distinção _h_/_s_ — colisão resolvida mas incompatível com Python (F-029)
- **D-016**: Permission input validation + stdin guard (F-030, F-031)
- **D-017**: Env merge filter em query.ts (F-023)
- **D-018**: Registry input validation (F-028)
- **D-019**: Static appendFile import em sessions.ts (F-032)
- **D-020**: Internals removidos da API pública (F-033)
- **D-021**: Specific SyntaxError catch em process.ts (F-034)

### Estado atual de `encodeCwd()` (sessions.ts:22-28)

```typescript
function encodeCwd(dir: string): string {
  const normalized = resolve(dir)
  return normalized
    .replace(/-/g, "_h_")            // hifens literais → _h_
    .replace(/[/\\:]/g, "_s_")       // separadores de path → _s_
    .replace(/[^a-zA-Z0-9_]/g, "_")  // demais caracteres especiais → _
}
```

Resultado com sprint-2:
- `/foo/bar` → `_s_foo_s_bar`
- `/foo-bar` → `_s_foo_h_bar`
- Colisão resolvida, mas encoding incompatível com Python CLI (`-foo-bar` vs `-foo-bar` esperado)

## Lacunas e Oportunidades

### Gap 22 — `encodeCwd` usa algoritmo incompatível com Python (CRÍTICO)

**Arquivo**: `sessions.ts:22-28`

A implementação sprint-2 usa `_h_`/`_s_` como tokens de distinção. O Python usa um único regex `[^a-zA-Z0-9]` → `-`. Para os mesmos paths, produzem strings completamente diferentes. Isso significa que a SDK TypeScript e a SDK Python nunca encontrarão as mesmas sessões no disco.

Fix: substituir pela lógica Python (single regex + hash suffix para long paths).

### Gap 23 — Sem função `simpleHash()` compatível com o hash do CLI (CRÍTICO)

**Arquivo**: `sessions.ts` (nova função)

O Python SDK usa `_simple_hash()` — hash djb2 de 32 bits com coerce para signed int, convertido para base36 — que replica o algoritmo do CLI. A SDK TypeScript não tem equivalente. Para paths longos, o hash suffix deve ser idêntico ao produzido pelo CLI, caso contrário a SDK não encontrará sessões de projetos com paths >200 chars.

Fix: implementar `simpleHash(s: string): string` com as mesmas operações bitwise.

### Gap 24 — Paths longos (>200 chars) sem truncation + hash suffix (CRÍTICO)

**Arquivo**: `sessions.ts:22-28`

Paths com 200+ caracteres não são tratados. Filesystems como ext4, APFS e NTFS têm limite de 255 bytes por componente. Paths longos sanitizados podem exceder esse limite, causando erro de `ENOENT` ou `ENAMETOOLONG` silencioso.

Fix: após sanitizar, verificar `sanitized.length > 200` → truncar em 200 e concatenar `-{simpleHash(originalName)}`.

### Gap 25 — Nome e assinatura da função divergem do Python (BAIXO)

**Arquivo**: `sessions.ts:22`, `sessions.ts:37` (chamador `getSessionDir`)

O TASK.md especifica renomear `encodeCwd(dir)` → `sanitizePath(name)` para alinhar com o Python (`_sanitize_path(name)`). O parâmetro também muda de `dir` para `name` — a função opera em uma string já resolvida, não necessariamente em um path de diretório. A chamada em `getSessionDir()` deve continuar usando `resolve(dir)` antes de chamar `sanitizePath()`.

Fix: renomear função e atualizar chamadores.

## Priorização

| ID | Discovery | Score | Justificativa |
|----|-----------|-------|---------------|
| D-023 | Implementar `simpleHash()` compatível com Python | 10 | Pré-requisito para D-024. Sem hash correto, paths longos não encontram sessões existentes no disco. |
| D-022 | Reimplementar `sanitizePath()` com algoritmo Python | 10 | Incompatibilidade cross-SDK: SDK TypeScript e Python produzem diretórios diferentes para o mesmo cwd. Bug silencioso de correctness. |
| D-024 | Adicionar truncação com hash para paths > 200 chars | 9 | ENAMETOOLONG em filesystems com limite de 255 bytes. Paths de projetos com workspaces profundos são comuns em monorepos. |
| D-025 | Renomear `encodeCwd` → `sanitizePath` e atualizar chamadores | 6 | Alinhamento com Python para legibilidade e consistência. Sem impacto funcional — é refactor de nomenclatura. |
