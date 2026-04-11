# openclaude-sdk - Script translate-locale para gerar novos dicionarios

Spec do script `scripts/translate-locale.ts` que gera dicionarios de novos locales usando o proprio SDK como tradutor.

---

## Objetivo

Resolve D-134, D-135.

| Problema | Consequencia |
|----------|-------------|
| Adicionar novo locale requer traduzir 120 strings manualmente | Barreira alta para expansao de locales |
| Nao existe tooling de i18n no projeto | Processo manual, propenso a erros e inconsistencias |

---

## Implementacao

### 1. Criar `scripts/translate-locale.ts`

Invocado via `npm run translate -- xx-YY`.

### Fluxo

| Etapa | Acao |
|-------|------|
| 1 | Valida formato BCP 47 basico (`/^[a-z]{2}-[A-Z]{2}$/i`) |
| 2 | Verifica se arquivo destino ja existe — aborta ou `--force` |
| 3 | Carrega `src/tool-intention/locales/pt-BR.json` como origem |
| 4 | Para cada tool: chama `prompt()` do SDK com prompt de traducao |
| 5 | Parseia resposta JSON, valida (array de 5 strings) |
| 6 | Monta objeto final e escreve em `src/tool-intention/locales/<locale>.json` |
| 7 | Imprime resumo: tools traduzidas, fallbacks, tempo total |

### Prompt de traducao (system)

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

### Prompt de traducao (user)

```
Idioma destino: {locale}
Tool: {toolName}

Traduza estas 5 variantes do portugues para {locale}:
{JSON.stringify(ptBRVariants)}
```

### Invocacao do SDK

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

### Tratamento de falhas

| Situacao | Acao |
|----------|------|
| JSON invalido na resposta | Retry 1 vez |
| Numero errado de variantes | Retry 1 vez |
| Timeout | Retry 1 vez |
| Falha persistente | Usa pt-BR como fallback, marca com TODO |
| Nao aborta | Continua para proxima tool |
| Resumo final | Lista entradas que precisam revisao manual |

### 2. Adicionar script no `package.json`

```json
{
  "scripts": {
    "translate": "tsx scripts/translate-locale.ts"
  }
}
```

### Regras

- `pt-BR.json` e **sempre** a origem — nao traduz entre locales arbitrarios
- `--force` permite sobrescrever arquivo existente
- Sem `--force` e arquivo existe → aborta com mensagem clara
- Log por tool: `✓ Bash (5 variantes)` ou `✗ FAILED: Edit (retry...)`
- Arquivo de saida sempre e JSON valido, mesmo com fallbacks em pt-BR
- `prompt()` e chamado com `toolOutputMode: "full"` para evitar recursao do filtro
- `presenceIntervalMs: 0` para desabilitar heartbeats em batch
- `tsx` ja e devDependency do projeto

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `scripts/translate-locale.ts` | Novo arquivo — script de traducao |
| `package.json` | Novo script `"translate"` |

---

## Criterios de Aceite

- [ ] `scripts/translate-locale.ts` implementado
- [ ] Validacao de formato BCP 47 no argumento
- [ ] Check de arquivo existente (aborta sem `--force`)
- [ ] Usa `prompt()` do SDK para traduzir
- [ ] Fallback para pt-BR em caso de falha com marcacao TODO
- [ ] Log de progresso por tool no stdout
- [ ] Resumo final com contagem de sucessos e falhas
- [ ] `npm run translate -- pt-PT` gera JSON valido em `src/tool-intention/locales/pt-PT.json`
- [ ] `package.json` tem script `"translate": "tsx scripts/translate-locale.ts"`
- [ ] `tsc --noEmit` passa sem erro

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `scripts/translate-locale.ts` | S-094 |
| `package.json` script `translate` | S-094 |
| D-134 | S-094 |
| D-135 | S-094 |
