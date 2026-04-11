# PRP-055 — Translate script e validacao: script de traducao e typecheck/build

## Objetivo

Implementar o script `scripts/translate-locale.ts` que gera dicionarios de novos locales usando o proprio SDK como tradutor, adicionar o comando `npm run translate` no `package.json`, e validar que typecheck e build passam com todas as mudancas do sprint.

Referencia: specs S-094 (D-134, D-135), S-095 (D-136).

## Execution Mode

`implementar`

## Contexto

O PRP-053 e PRP-054 implementam o Tool Intention Filter completo:
- Campo `toolOutputMode` em `Options` (F-139)
- Tipo `ToolIntentionPayload` (F-140)
- Dicionarios pt-BR/en-US/es-ES (F-141)
- `pickIntention` (F-142)
- `applyToolIntentionFilter` (F-143)
- Barrel e exports (F-144, F-145)
- Integracao no `lifecycleGenerator` (F-146)

Faltam:
1. **Script de traducao** — tooling para gerar novos locales sem traduzir 120+ strings manualmente
2. **Validacao final** — confirmar que typecheck e build passam com tudo integrado

Estado atual:
- `scripts/` — diretorio pode nao existir, verificar
- `package.json` — tem `tsx` como devDependency, NAO tem script `translate`
- `prompt()` helper em `src/session-v2.ts` — ja existe, aceita `systemPrompt` e `Options`

## Especificacao

### Feature F-147 — Script translate-locale.ts

Criar `scripts/translate-locale.ts`, invocado via `npm run translate -- xx-YY`.

Fluxo:

| Etapa | Acao |
|-------|------|
| 1 | Valida formato BCP 47 basico (`/^[a-z]{2}-[A-Z]{2}$/i`) — aborta com mensagem se invalido |
| 2 | Verifica se `src/tool-intention/locales/<locale>.json` ja existe — aborta sem `--force` |
| 3 | Carrega `src/tool-intention/locales/pt-BR.json` como origem |
| 4 | Para cada tool no dicionario: chama `prompt()` do SDK com prompt de traducao |
| 5 | Parseia resposta JSON, valida (array de exatamente 5 strings) |
| 6 | Monta objeto final e escreve em `src/tool-intention/locales/<locale>.json` |
| 7 | Imprime resumo: tools traduzidas, fallbacks, tempo total |

Prompt de traducao (system):

```
Voce e um tradutor especializado em strings curtas de UI para software.
Sua tarefa: traduzir narrativas de acao de agente de IA do portugues
brasileiro (pt-BR) para o idioma de destino.

REGRAS:
- Preserve o TOM: discreto, funcional, no gerundio ou forma equivalente.
- Preserve o TAMANHO: maximo 6 palavras, similar ao original.
- Nao traduza literalmente — use a forma idiomatica do idioma destino.
- Preserve a neutralidade: sem emoji, sem girias, sem antropomorfismo.
- Nao adicione pontuacao final nas frases.

FORMATO DE SAIDA:
JSON array com exatamente o mesmo numero de strings que o input, na ordem.
Nada alem do JSON. Sem explicacao, sem markdown fence.
```

Prompt de traducao (user):

```
Idioma destino: {locale}
Tool: {toolName}

Traduza estas 5 variantes do portugues para {locale}:
{JSON.stringify(ptBRVariants)}
```

Invocacao do SDK:

```typescript
import { prompt } from "../src/session-v2.js"

const result = await prompt(userPrompt, {
  systemPrompt: translatorSystemPrompt,
  permissionMode: "bypassPermissions",
  toolOutputMode: "full",
  presenceIntervalMs: 0,
  richOutput: false,
  mcpServers: {},
  locale: "en-US",
})
```

Regras de invocacao:
- `toolOutputMode: "full"` — evita recursao do filtro
- `presenceIntervalMs: 0` — desabilita heartbeats em batch
- `permissionMode: "bypassPermissions"` — sem prompts interativos
- `richOutput: false` — sem MCP display server
- `mcpServers: {}` — sem MCP servers

Tratamento de falhas:

| Situacao | Acao |
|----------|------|
| JSON invalido na resposta | Retry 1 vez |
| Numero errado de variantes (nao 5) | Retry 1 vez |
| Timeout | Retry 1 vez |
| Falha persistente apos retry | Usa entrada pt-BR como fallback |
| Tool individual falha | NAO aborta — continua para proxima tool |
| Resumo final | Lista entradas que precisam revisao manual |

Log por tool no stdout:
- Sucesso: `✓ Bash (5 variantes)`
- Falha com retry ok: `⟳ Edit (retry ok)`
- Falha permanente: `✗ FAILED: Grep (usando pt-BR como fallback)`

### Feature F-148 — Script translate no package.json

Adicionar em `package.json`, secao `scripts`:

```json
{
  "scripts": {
    "translate": "tsx scripts/translate-locale.ts"
  }
}
```

Uso: `npm run translate -- pt-PT`

Regras:
- `tsx` ja e devDependency — NAO adicionar dependencia nova
- Argumento passado via `--` do npm

### Feature F-149 — Validacao typecheck e build

Executar em sequencia apos todas as mudancas dos PRPs 053, 054 e 055:

```bash
npm run typecheck    # tsc --noEmit — zero erros
npm run build        # tsup — zero erros, dist/ atualizado
```

Pontos de atencao:

| Ponto | Risco | Mitigacao |
|-------|-------|-----------|
| `resolveJsonModule` em tsconfig | JSON imports falham sem ele | Verificar e adicionar se necessario |
| `with { type: "json" }` import assertions | Requer TS 5.3+ | Verificar versao do TS |
| `noUncheckedIndexedAccess` | `dict[toolName]` retorna `string[] \| undefined` | `pickIntention` ja trata com `if (!list)` |
| `satisfies ToolIntentionPayload` | Requer TS 4.9+ | Ja em uso no projeto |
| JSON files em `src/tool-intention/locales/` | tsup precisa incluir ou bundler copiar | Verificar config do tsup |
| Novo diretorio `src/tool-intention/` | Deve estar no glob de entrada do bundler | Verificar `tsup.config.ts` |

Regras:
- Ambos devem passar sem erro
- Nenhum `@ts-ignore` ou `as any` adicionado para contornar erros
- Se `resolveJsonModule` nao estiver ativo, adicionar em `tsconfig.json`
- Se falhar, corrigir antes de considerar PRP completo

### Comportamento por cenario

| Cenario | Resultado |
|---------|-----------|
| `npm run translate -- pt-PT` | Gera `src/tool-intention/locales/pt-PT.json` com 24 chaves, 5 variantes cada |
| `npm run translate -- pt-PT` (arquivo existe, sem --force) | Aborta com mensagem "arquivo ja existe, use --force" |
| `npm run translate -- pt-PT --force` (arquivo existe) | Sobrescreve |
| `npm run translate -- invalid` | Aborta com mensagem "formato invalido, esperado xx-YY" |
| `npm run translate -- ja-JP` (3 tools falham) | JSON gerado com 21 tools traduzidas + 3 em pt-BR como fallback |
| `npm run typecheck` | Passa sem erro |
| `npm run build` | Produz output em `dist/` sem erro |

## Features

| ID | Feature | Descricao |
|----|---------|-----------|
| F-147 | translateLocaleScript | Script `scripts/translate-locale.ts` — gera JSON de novo locale usando `prompt()` do SDK com fallback e log |
| F-148 | translateNpmScript | Script `"translate"` no `package.json` via `tsx` |
| F-149 | sprintValidation | Validacao `tsc --noEmit` e `tsup` passam sem erro com todas as mudancas do sprint |

## Limites

- NAO alterar dicionarios existentes (pt-BR, en-US, es-ES) — escopo de PRP-053
- NAO alterar `src/tool-intention/filter.ts` — escopo de PRP-054
- NAO alterar `src/query.ts` — escopo de PRP-054
- NAO adicionar testes unitarios (nao ha framework de teste configurado)
- NAO commitar o output de `npm run translate` — so provar que funciona
- NAO implementar traducao runtime por LLM — script e offline/batch
- NAO integrar com plataformas de traducao (Inlang, Lingo.dev) — overkill na escala atual

## Dependencias

Depende de **PRP-053** (dicionarios e picker existem) e **PRP-054** (integracao completa para validacao). Nenhum PRP depende deste — e o ultimo da cadeia para Tool Intention Filter.
