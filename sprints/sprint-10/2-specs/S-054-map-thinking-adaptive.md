# openclaude-sdk - Mapear thinking: adaptive em buildCliArgs

Adicionar mapeamento de `thinking: { type: "adaptive" }` para flag CLI.

---

## Objetivo

Resolver D-061 (score 5): `buildCliArgs()` trata apenas `enabled` e `disabled` para `thinking`. O valor `"adaptive"` (auto-selecionar baseado no modelo) e silenciosamente ignorado — nenhuma flag e passada ao CLI.

---

## Estado Atual

**Arquivo**: `src/process.ts`, linhas 128-132

```typescript
// Thinking
if (options.thinking?.type === "enabled") {
  args.push("--thinking", "enabled")
} else if (options.thinking?.type === "disabled") {
  args.push("--thinking", "disabled")
}
```

O tipo `ThinkingConfig` em `src/types/options.ts` (linha 200-203) define tres opcoes:

```typescript
export type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens?: number }
  | { type: "disabled" }
```

---

## Implementacao

**Arquivo**: `src/process.ts`, substituir bloco thinking (linhas 128-132)

**Antes:**

```typescript
if (options.thinking?.type === "enabled") {
  args.push("--thinking", "enabled")
} else if (options.thinking?.type === "disabled") {
  args.push("--thinking", "disabled")
}
```

**Depois:**

```typescript
if (options.thinking) {
  args.push("--thinking", options.thinking.type)
}
```

Simplifica o bloco — o tipo `ThinkingConfig` ja garante que `type` e `"adaptive" | "enabled" | "disabled"`, entao basta passar o valor diretamente. Todos os tres valores sao flags validas do CLI.

---

## Criterios de Aceite

- [ ] `thinking: { type: "adaptive" }` gera `--thinking adaptive`
- [ ] `thinking: { type: "enabled" }` gera `--thinking enabled` (regressao)
- [ ] `thinking: { type: "disabled" }` gera `--thinking disabled` (regressao)
- [ ] Sem `thinking`: nenhuma flag (regressao)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` — thinking | S-054 |
| `ThinkingConfig` | S-054 |
| Discovery | D-061 |
