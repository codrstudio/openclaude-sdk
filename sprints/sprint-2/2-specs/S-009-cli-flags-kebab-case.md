# openclaude-sdk - Corrigir Flags de Tools para kebab-case

Corrigir `--allowedTools` e `--disallowedTools` para `--allowed-tools` e `--disallowed-tools`.

---

## Objetivo

Resolver D-012: `buildCliArgs()` em `process.ts:74,79` usa `--allowedTools` (camelCase) e `--disallowedTools`, mas o Claude Code CLI espera kebab-case (`--allowed-tools`, `--disallowed-tools`). Com o flag errado, o CLI ignora silenciosamente as ferramentas configuradas.

---

## Problema

```typescript
// Atual — camelCase (INCORRETO)
if (options.allowedTools && options.allowedTools.length > 0) {
  args.push("--allowedTools", options.allowedTools.join(","))
}

if (options.disallowedTools && options.disallowedTools.length > 0) {
  args.push("--disallowedTools", options.disallowedTools.join(","))
}
```

O Claude Code CLI segue convencao Unix com kebab-case para flags. Flags desconhecidos sao ignorados silenciosamente, o que significa que `allowedTools` e `disallowedTools` nunca sao efetivamente passados.

---

## Correcao

### process.ts:73-79

```typescript
// Corrigido — kebab-case
if (options.allowedTools && options.allowedTools.length > 0) {
  args.push("--allowed-tools", options.allowedTools.join(","))
}

if (options.disallowedTools && options.disallowedTools.length > 0) {
  args.push("--disallowed-tools", options.disallowedTools.join(","))
}
```

**Nota**: os nomes das propriedades TypeScript (`allowedTools`, `disallowedTools`) permanecem em camelCase — a convencao se aplica apenas ao flag do CLI.

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | 74 | `--allowedTools` → `--allowed-tools` |
| `src/process.ts` | 79 | `--disallowedTools` → `--disallowed-tools` |

---

## Criterios de Aceite

- [ ] `buildCliArgs({ allowedTools: ["Bash"] })` produz `["--allowed-tools", "Bash"]`
- [ ] `buildCliArgs({ disallowedTools: ["Edit"] })` produz `["--disallowed-tools", "Edit"]`
- [ ] Nenhuma outra flag teve o formato alterado (as demais ja estao em kebab-case)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` em `process.ts` | S-009 |
| Discovery | D-012 |
