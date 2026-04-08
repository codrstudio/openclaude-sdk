# openclaude-sdk - Corrigir Colisoes de encodeCwd

Substituir encoding que causa colisoes por separador reversivel.

---

## Objetivo

Resolver D-015: `encodeCwd()` em `sessions.ts:22-24` substitui todos os caracteres nao-alfanumericos por `-`, causando colisoes entre paths distintos.

---

## Problema

```typescript
function encodeCwd(dir: string): string {
  return resolve(dir).replace(/[^a-zA-Z0-9]/g, "-")
}
```

Exemplos de colisao:
- `/foo/bar` → `-foo-bar`
- `/foo-bar` → `-foo-bar` (COLISAO)
- `/a/b` → `-a-b`
- `/a-b` → `-a-b` (COLISAO)
- `C:\Users\dev` → `C--Users-dev`
- `C:\Users-dev` → `C--Users-dev` (COLISAO)

Sessoes de projetos distintos podem sobrescrever-se mutuamente sem aviso.

---

## Correcao

Usar encoding que diferencia separadores de path de hifens literais:

```typescript
function encodeCwd(dir: string): string {
  const normalized = resolve(dir)
  return normalized
    .replace(/-/g, "_h_")      // hifens literais → _h_
    .replace(/[/\\:]/g, "_s_") // separadores de path → _s_
    .replace(/[^a-zA-Z0-9_]/g, "_")  // demais caracteres especiais → _
}
```

| Input | Output |
|-------|--------|
| `/foo/bar` | `_s_foo_s_bar` |
| `/foo-bar` | `_s_foo_h_bar` |
| `/a/b` | `_s_a_s_b` |
| `/a-b` | `_s_a_h_b` |
| `C:\Users\dev` | `C_s__s_Users_s_dev` |
| `C:\Users-dev` | `C_s__s_Users_h_dev` |

O encoding e reversivel e livre de colisoes porque `_h_` e `_s_` nunca ocorrem naturalmente em paths de arquivo.

---

## Compatibilidade

**Breaking change para sessoes existentes**: paths encoded com o algoritmo antigo nao serao encontrados pelo novo. Isso e aceitavel porque:
1. A SDK e pre-1.0 (v0.1.0)
2. Sessoes antigas continuam no disco — nao sao deletadas
3. Nao ha migracao automatica — sessoes existentes simplesmente nao aparecem em `listSessions()` para paths que colidiam

Se desejado, uma funcao de migracao pode ser adicionada futuramente, mas nao e escopo desta spec.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/sessions.ts` | 22-24 | Reimplementar `encodeCwd()` |

---

## Criterios de Aceite

- [ ] `/foo/bar` e `/foo-bar` produzem strings diferentes
- [ ] `/a/b` e `/a-b` produzem strings diferentes
- [ ] `C:\Users\dev` e `C:\Users-dev` produzem strings diferentes
- [ ] Output contem apenas caracteres seguros para nomes de diretorio (`a-z`, `A-Z`, `0-9`, `_`)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `encodeCwd()` em `sessions.ts` | S-012 |
| Discovery | D-015 |
