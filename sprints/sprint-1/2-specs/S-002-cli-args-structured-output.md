# openclaude-sdk - Completar buildCliArgs e Structured Output

Mapear todas as flags CLI ausentes em `buildCliArgs()` e implementar suporte a structured output via `--json-schema`.

---

## Objetivo

Resolver D-003 e D-004: varios campos do `Options` existem como tipos mas nao sao mapeados para flags CLI. O campo `outputFormat` (structured output via `--json-schema`) e critico para uso programatico.

---

## Flags Ausentes em buildCliArgs()

| Campo Options | Flag CLI | Tipo | Comportamento |
|---------------|----------|------|---------------|
| `additionalDirectories` | `--add-dir` | `string[]` | Um `--add-dir <path>` por diretorio |
| `betas` | `--beta` | `SdkBeta[]` | Um `--beta <name>` por beta |
| `effort` | `--effort` | `"low" \| "medium" \| "high" \| "max"` | `--effort <level>` |
| `thinking` | `--thinking` | `ThinkingConfig` | `--thinking enabled` ou `--thinking disabled` |
| `outputFormat` | `--output-format json-schema --json-schema <json>` | `{ type: "json_schema"; schema: unknown }` | Ver secao Structured Output |
| `maxBudgetUsd` | `--max-budget-usd` | `number` | `--max-budget-usd <value>` |
| `extraArgs` | (direto) | `Record<string, string \| null>` | Cada key vira `--key value` (ou so `--key` se value null) |

---

## Structured Output (--json-schema)

### Mecanica

Quando `options.outputFormat` esta definido:

1. Substituir `--output-format stream-json` por `--output-format json-schema`
2. Adicionar `--json-schema <serialized_json>`
3. O CLI retorna `SDKResultMessage` com campo `structured_output` contendo o objeto parseado

### Implementacao em buildCliArgs()

```typescript
// Antes (hardcoded):
const args = ["-p", "-", "--verbose", "--output-format", "stream-json"]

// Depois:
if (options.outputFormat?.type === "json_schema") {
  args.push("--output-format", "json-schema")
  args.push("--json-schema", JSON.stringify(options.outputFormat.schema))
} else {
  args.push("--output-format", "stream-json")
}
```

### Impacto em spawnAndStream()

Nenhum. O JSONL do stdout continua sendo parseado normalmente. O campo `structured_output` ja existe no tipo `SDKResultMessage` (subtype `success`).

---

## Implementacao de extraArgs

```typescript
if (options.extraArgs) {
  for (const [key, value] of Object.entries(options.extraArgs)) {
    args.push(`--${key}`)
    if (value !== null) {
      args.push(value)
    }
  }
}
```

**Regra**: `extraArgs` e adicionado por ultimo, depois de todas as flags nomeadas, para permitir override.

---

## Bug: permissionMode duplicado

O prototipo tem permissionMode mapeado duas vezes em `buildCliArgs()`:

```typescript
// Linha ~18: push se nao bypassPermissions
if (options.permissionMode) {
  args.push("--permission-mode", options.permissionMode)
}

// Linha ~64: push de novo se nao bypassPermissions
if (options.permissionMode && options.permissionMode !== "bypassPermissions") {
  args.push("--permission-mode", options.permissionMode)
}
```

**Correcao**: remover a segunda ocorrencia (linhas 64-66 do prototipo).

---

## Criterios de Aceite

- [ ] `buildCliArgs({ additionalDirectories: ["/a", "/b"] })` produz `["--add-dir", "/a", "--add-dir", "/b", ...]`
- [ ] `buildCliArgs({ betas: ["context-1m-2025-08-07"] })` produz `["--beta", "context-1m-2025-08-07", ...]`
- [ ] `buildCliArgs({ effort: "high" })` produz `["--effort", "high", ...]`
- [ ] `buildCliArgs({ outputFormat: { type: "json_schema", schema: { type: "object" } } })` produz `["--output-format", "json-schema", "--json-schema", '{"type":"object"}', ...]`
- [ ] `buildCliArgs({ extraArgs: { "custom-flag": "val", "bool-flag": null } })` produz `["--custom-flag", "val", "--bool-flag", ...]`
- [ ] `buildCliArgs({ permissionMode: "plan" })` inclui `--permission-mode plan` apenas **uma** vez
- [ ] `buildCliArgs({ maxBudgetUsd: 5.0 })` produz `["--max-budget-usd", "5", ...]`

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` em `process.ts` | S-002 |
| Structured output pipeline | S-002 |
| Bug permissionMode duplicado | S-002 |
| Discoveries | D-003, D-004 |
