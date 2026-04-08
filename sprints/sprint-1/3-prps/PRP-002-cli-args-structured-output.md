# PRP-002 — Completar CLI Args & Structured Output

## Objetivo

Completar o mapeamento de `buildCliArgs()` para todas as flags CLI ausentes e implementar suporte a structured output via `--json-schema`.

Referencia: spec S-002 (D-003, D-004).

## Execution Mode

`implementar`

## Contexto

`buildCliArgs()` em `src/process.ts` mapeia o objeto `Options` para flags CLI do OpenClaude. Varios campos existem nos tipos mas nao sao mapeados. Alem disso, ha um bug de `permissionMode` duplicado.

## Especificacao

### 1. Mapear flags ausentes em buildCliArgs()

Adicionar mapeamento para cada campo:

| Campo Options | Flag CLI | Logica |
|---------------|----------|--------|
| `additionalDirectories` | `--add-dir` | Um `--add-dir <path>` por item do array |
| `betas` | `--beta` | Um `--beta <name>` por item do array |
| `effort` | `--effort` | `--effort <level>` (low/medium/high/max) |
| `thinking` | `--thinking` | `--thinking enabled` ou `--thinking disabled` |
| `maxBudgetUsd` | `--max-budget-usd` | `--max-budget-usd <value>` (converter number para string) |
| `extraArgs` | (direto) | Cada key vira `--key value` (ou so `--key` se value e `null`). Adicionar POR ULTIMO. |

### 2. Structured output (--json-schema)

Quando `options.outputFormat` esta definido com `type: "json_schema"`:

1. Substituir `--output-format stream-json` por `--output-format json-schema`
2. Adicionar `--json-schema <JSON.stringify(options.outputFormat.schema)>`

Quando `outputFormat` nao esta definido, manter o comportamento atual (`--output-format stream-json`).

```typescript
if (options.outputFormat?.type === "json_schema") {
  args.push("--output-format", "json-schema")
  args.push("--json-schema", JSON.stringify(options.outputFormat.schema))
} else {
  args.push("--output-format", "stream-json")
}
```

### 3. Corrigir bug permissionMode duplicado

O prototipo tem `permissionMode` mapeado em dois lugares dentro de `buildCliArgs()`. Remover a segunda ocorrencia. O resultado final deve incluir `--permission-mode <mode>` exatamente UMA vez.

### 4. Ordem dos args

Manter a ordem: flags core (`-p -`, `--verbose`, `--output-format`) → flags nomeadas (model, turns, permissions, etc.) → `extraArgs` (por ultimo, para permitir override).

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-004 | Array flags | Mapear `additionalDirectories` e `betas` para flags repetidas |
| F-005 | Scalar flags | Mapear `effort`, `thinking`, `maxBudgetUsd` |
| F-006 | Structured output | Implementar `outputFormat` → `--json-schema` |
| F-007 | Extra args | Implementar `extraArgs` como passagem direta (por ultimo) |
| F-008 | Fix permissionMode | Remover duplicacao de `--permission-mode` |

## Limites

- NAO alterar a interface de `Options` (os campos ja existem nos tipos)
- NAO modificar `spawnAndStream()` — apenas `buildCliArgs()`
- NAO adicionar testes unitarios (nao ha framework de teste configurado)

## Dependencias

- **PRP-001** — projeto precisa estar configurado e compilando
