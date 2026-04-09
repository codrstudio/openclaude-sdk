# openclaude-sdk - Corrigir Mapeamento de systemPrompt Preset

Adicionar tratamento do caso `{ type: "preset", preset: "claude_code" }` em `buildCliArgs()`.

---

## Objetivo

Resolver D-062 (score 6): o tipo `Options.systemPrompt` aceita `{ type: "preset"; preset: "claude_code"; append?: string }` mas `buildCliArgs()` so trata `string` e `{ append }`. O caso preset cai no `else if` sem `append`, nao gerando nenhuma flag — o preset nao e ativado.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Preset ignorado | CLI roda sem system prompt preset, comportamento errado |
| 2 | Sem erro | Usuario nao sabe que a opcao nao funcionou |

---

## Estado Atual

**Arquivo**: `src/process.ts`, linhas 78-84

```typescript
// System prompt
if (options.systemPrompt) {
  if (typeof options.systemPrompt === "string") {
    args.push("--system-prompt", options.systemPrompt)
  } else if (options.systemPrompt.append) {
    args.push("--append-system-prompt", options.systemPrompt.append)
  }
}
```

O caso `{ type: "preset", preset: "claude_code" }` sem `append` nao gera nenhuma flag.

---

## Implementacao

**Arquivo**: `src/process.ts`, substituir bloco de system prompt (linhas 78-84)

**Antes:**

```typescript
if (options.systemPrompt) {
  if (typeof options.systemPrompt === "string") {
    args.push("--system-prompt", options.systemPrompt)
  } else if (options.systemPrompt.append) {
    args.push("--append-system-prompt", options.systemPrompt.append)
  }
}
```

**Depois:**

```typescript
if (options.systemPrompt) {
  if (typeof options.systemPrompt === "string") {
    args.push("--system-prompt", options.systemPrompt)
  } else {
    if (options.systemPrompt.type === "preset") {
      args.push("--system-prompt-preset", options.systemPrompt.preset)
    }
    if (options.systemPrompt.append) {
      args.push("--append-system-prompt", options.systemPrompt.append)
    }
  }
}
```

Isso trata tres cenarios:
1. `{ type: "preset", preset: "claude_code" }` → `--system-prompt-preset claude_code`
2. `{ type: "preset", preset: "claude_code", append: "..." }` → `--system-prompt-preset claude_code --append-system-prompt ...`
3. `{ append: "..." }` (sem type) → `--append-system-prompt ...` (compativel com comportamento atual)

---

## Criterios de Aceite

- [ ] `systemPrompt: { type: "preset", preset: "claude_code" }` gera `--system-prompt-preset claude_code`
- [ ] `systemPrompt: { type: "preset", preset: "claude_code", append: "extra" }` gera ambas as flags
- [ ] `systemPrompt: "texto"` continua gerando `--system-prompt texto`
- [ ] `systemPrompt: { append: "extra" }` continua gerando `--append-system-prompt extra`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| `buildCliArgs()` — systemPrompt | S-051 |
| Discovery | D-062 |
