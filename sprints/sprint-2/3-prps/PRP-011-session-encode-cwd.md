# PRP-011 — Session encodeCwd Collision Fix

## Objetivo

Reimplementar `encodeCwd()` para eliminar colisoes entre paths distintos que mapeiam para a mesma string encoded.

Referencia: spec S-012 (D-015).

## Execution Mode

`implementar`

## Contexto

`encodeCwd()` em `sessions.ts:22-24` substitui todos os caracteres nao-alfanumericos por `-`, causando colisoes:
- `/foo/bar` → `-foo-bar`
- `/foo-bar` → `-foo-bar` (COLISAO)
- `C:\Users\dev` → `C--Users-dev`
- `C:\Users-dev` → `C--Users-dev` (COLISAO)

Sessoes de projetos distintos podem sobrescrever-se mutuamente sem aviso. Este e o bug de maior prioridade do sprint (score 9).

## Especificacao

### Reimplementar encodeCwd()

Substituir a implementacao atual por encoding que diferencia separadores de path de hifens literais:

```typescript
function encodeCwd(dir: string): string {
  const normalized = resolve(dir)
  return normalized
    .replace(/-/g, "_h_")           // hifens literais → _h_
    .replace(/[/\\:]/g, "_s_")      // separadores de path → _s_
    .replace(/[^a-zA-Z0-9_]/g, "_") // demais caracteres especiais → _
}
```

Resultados esperados:

| Input | Output |
|-------|--------|
| `/foo/bar` | `_s_foo_s_bar` |
| `/foo-bar` | `_s_foo_h_bar` |
| `/a/b` | `_s_a_s_b` |
| `/a-b` | `_s_a_h_b` |
| `C:\Users\dev` | `C_s__s_Users_s_dev` |
| `C:\Users-dev` | `C_s__s_Users_h_dev` |

### Compatibilidade

**Breaking change para sessoes existentes**: paths encoded com o algoritmo antigo nao serao encontrados pelo novo. Isso e aceitavel porque:
1. A SDK e pre-1.0 (v0.1.0)
2. Sessoes antigas continuam no disco — nao sao deletadas
3. Migracao automatica NAO e escopo deste PRP

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-029 | encodeCwd collision-free | Reimplementar `encodeCwd()` com encoding reversivel e livre de colisoes |

## Limites

- NAO criar funcao de migracao de sessoes antigas
- NAO alterar a interface publica de `listSessions()` ou `getSessionMessages()`
- NAO modificar nenhuma outra funcao de sessions.ts

## Dependencias

Nenhuma. Alteracao e auto-contida em `src/sessions.ts`.
