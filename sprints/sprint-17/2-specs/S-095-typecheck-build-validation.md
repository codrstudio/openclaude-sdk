# openclaude-sdk - Validacao typecheck e build

Spec dos criterios de validacao final: typecheck e build devem passar com todas as mudancas do sprint.

---

## Objetivo

Resolve D-136.

| Problema | Consequencia |
|----------|-------------|
| Novos arquivos e imports podem quebrar typecheck | SDK nao compila — regressao |
| JSON imports com `with { type: "json" }` podem exigir config TS | Build falha se `resolveJsonModule` nao estiver ativo |

---

## Implementacao

### 1. Verificar configuracao TypeScript

| Opcao | Valor esperado | Motivo |
|-------|---------------|--------|
| `resolveJsonModule` | `true` | Necessario para `import ptBR from "./locales/pt-BR.json" with { type: "json" }` |
| `esModuleInterop` | `true` | Default import de JSON |
| `strict` | `true` | Ja configurado |
| `noUncheckedIndexedAccess` | `true` | Ja configurado — afeta acesso a `dict[toolName]` |

Se `resolveJsonModule` nao estiver ativo, adicionar em `tsconfig.json`.

### 2. Validar typecheck

```bash
npm run typecheck
```

Deve passar sem erros. Pontos de atencao:

| Ponto | Risco |
|-------|-------|
| `dict[toolName]` retorna `string[] \| undefined` por causa de `noUncheckedIndexedAccess` | `pickIntention` ja trata com `if (!list)` |
| `msg.message.content.map(...)` — types de `ContentBlock` | O spread `{ ...block, input: {...} }` deve preservar discriminant |
| `satisfies ToolIntentionPayload` | Garante que o objeto literal corresponde ao tipo |
| JSON import assertions (`with { type: "json" }`) | Suportado desde TS 5.3+ — verificar versao |

### 3. Validar build

```bash
npm run build
```

Deve produzir output em `dist/` sem erros. Pontos de atencao:

| Ponto | Risco |
|-------|-------|
| JSON files em `src/tool-intention/locales/` | tsup deve incluir ou bundler deve copiar |
| Import paths com `.js` extension | Padrao ESM ja em uso no projeto |
| Novo diretorio `src/tool-intention/` | Deve ser incluido no glob de entrada do bundler |

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `tsconfig.json` | Possivelmente `resolveJsonModule: true` (se nao estiver) |

---

## Criterios de Aceite

- [ ] `npm run typecheck` passa sem erro com todos os arquivos novos
- [ ] `npm run build` produz output sem erro
- [ ] Nenhum `@ts-ignore` ou `as any` adicionado para contornar erros de tipo
- [ ] JSON imports funcionam com `with { type: "json" }` ou alternativa compativel

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| Validacao typecheck | S-095 |
| Validacao build | S-095 |
| D-136 | S-095 |
