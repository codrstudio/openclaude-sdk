# Benchmark: Modelos para openclaude-sdk

**Data:** 2026-04-09
**Total de modelos testados:** 22
**Testes por modelo:** 3 (markdown, code generation, refactoring)
**Total de execucoes:** 66+

---

## Ranking Final (Top 10)

| # | Modelo | Provider | MD | Code | Refactor | Media | Preco in/out $/1M |
|---|--------|----------|-----|------|----------|-------|-------------------|
| 1 | **Gemini 2.5 Pro** | OpenRouter | 100% | 100% | 91% | **97%** | $1.25 / $10.00 |
| 2 | **GLM 4.7** | OpenRouter | 95% | 100% | 91% | **95%** | $0.39 / $1.75 |
| 3 | **GLM 4.7 Flash** | OpenRouter | 95% | 100% | 82% | **92%** | **$0.06 / $0.40** |
| 4 | **GLM 4.5 Air** | OpenRouter | 86% | 100% | 91% | **92%** | $0.13 / $0.85 |
| 5 | **Claude (controle)** | Anthropic | 100% | 85% | 91% | **92%** | baseline |
| 6 | **Qwen3 32B** | Groq | 86% | 92% | 91% | **90%** | ~$0.29 blend |
| 7 | Qwen3 235B | OpenRouter | 0%* | 100% | 91% | 64% | $0.18 / $0.72 |
| 8 | GPT-4o | OpenRouter | 0%* | 92% | 91% | 61% | $2.50 / $10.00 |
| 9 | GPT-OSS 20B | Groq | 0%* | 92% | 91% | 61% | barato |
| 10 | DeepSeek Chat | OpenRouter | 0%* | 100% | 0%* | 33% | $0.14 / $0.28 |

`*` Gerou conteudo correto na resposta de texto mas NAO usou tool Write para criar arquivo.

---

## Modelos que Falharam (0% em tudo)

| Modelo | Provider | Motivo |
|--------|----------|--------|
| Kimi K2 | Groq + OpenRouter | "Unknown assistant error" — tool calling incompativel |
| DeepSeek V3.2 | OpenRouter | "Unknown assistant error" |
| DeepSeek Chat v3-0324 | OpenRouter | "Unknown assistant error" |
| Llama 3.3 70B Versatile | Groq | "Unknown assistant error" no code gen e refactoring |
| Llama 4 Scout | Groq | "Unknown assistant error" |
| Llama 4 Maverick | OpenRouter | Sucesso na API mas 0% nos arquivos (nao usou tools) |
| Gemini 2.5 Flash Lite | OpenRouter | Sucesso na API mas 0% nos arquivos |
| GLM 4 32B | OpenRouter | Sucesso na API mas 0% nos arquivos |

---

## Analise por Dimensao

### Markdown Generation
Testa criacao de doc tecnico com todos os elementos markdown (tabelas, mermaid, footnotes, etc.)

| Score | Modelos |
|-------|---------|
| 100% | Claude, Gemini 2.5 Pro |
| 95% | **GLM 4.7, GLM 4.7 Flash** |
| 86% | GLM 4.5 Air, Qwen3 32B (Groq), Qwen3 32B (OR) |
| 77% | GPT-4.1 Nano |

### Code Generation
Testa criacao de task queue com prioridade em TypeScript.

| Score | Modelos |
|-------|---------|
| 100% | Gemini 2.5 Pro, **GLM 4.7, GLM 4.7 Flash, GLM 4.5 Air**, Devstral, Qwen3 235B, GPT-OSS 120B, DeepSeek Chat |
| 92% | Qwen3 32B (Groq), GPT-4o, GPT-OSS 20B, Mistral Small 3.2 |
| 85% | Claude (controle) |
| 83% | GPT-4.1 Nano |

### Refactoring
Testa refatoracao de god class com code smells. O mais dificil.

| Score | Modelos |
|-------|---------|
| 91% | Claude, Gemini 2.5 Pro, **GLM 4.7, GLM 4.5 Air**, Qwen3 32B (Groq), Qwen3 235B, GPT-4o, GPT-OSS 20B |
| 82% | **GLM 4.7 Flash** |

---

## Descoberta: Familia GLM (Z-AI / Zhipu)

Os modelos GLM foram a maior surpresa deste benchmark.

### GLM 4.7 — Segundo lugar geral
- 95% markdown, 100% code gen, 91% refactoring = **95% media**
- Tool calling excelente — criou arquivos em 3/3 testes
- $0.39 / $1.75 — caro para um "barato" mas entrega qualidade premium
- Quase no nivel do Gemini 2.5 Pro por 1/5 do preco

### GLM 4.7 Flash — O novo campeao custo-beneficio
- **$0.06 input / $0.40 output por 1M tokens**
- 95% markdown, 100% code gen, 82% refactoring = **92% media**
- Mais barato que QUALQUER modelo testado
- Tool calling consistente — criou arquivos em 3/3 testes
- Unico ponto fraco: refactoring ficou em 82% (vs 91% dos melhores)

### GLM 4.5 Air — Alternativa equilibrada
- $0.13 / $0.85 por 1M tokens
- 86% markdown, 100% code gen, 91% refactoring = **92% media**
- Refactoring no nivel do Claude
- Preco excelente

### GLM 4 32B — Falhou
- 0% em tudo — modelo menor nao consegue tool calling com openclaude

---

## Recomendacao Final

| Caso de Uso | Modelo | Provider | Preco | Porque |
|-------------|--------|----------|-------|--------|
| **Melhor qualidade absoluta** | Gemini 2.5 Pro | OpenRouter | $1.25/$10 | 97% media, excelente em tudo |
| **Melhor qualidade/preco** | GLM 4.7 | OpenRouter | $0.39/$1.75 | 95% media, 5x mais barato que Gemini |
| **Mais barato viavel** | **GLM 4.7 Flash** | OpenRouter | **$0.06/$0.40** | 92% media, mais barato de todos |
| **Equilibrio qualidade/custo** | GLM 4.5 Air | OpenRouter | $0.13/$0.85 | 92% media, refactoring 91% |
| **Velocidade (Groq)** | Qwen3 32B | Groq | ~$0.29 | 90% media, rapido |
| **Code generation pura** | Devstral Small | OpenRouter | $0.10/$0.30 | 100% code gen |
| **NAO recomendado** | Kimi K2, DeepSeek V3.2, Llamas | * | * | Tool calling falha |

### Configuracao sugerida por tier

```
Tier 1 (producao, qualidade maxima):
  → Gemini 2.5 Pro via OpenRouter

Tier 2 (producao, custo otimizado):
  → GLM 4.7 via OpenRouter (melhor qualidade)
  → GLM 4.5 Air via OpenRouter (melhor refactoring barato)
  → GLM 4.7 Flash via OpenRouter (mais barato de todos)

Tier 3 (dev/staging, velocidade):
  → Qwen3 32B via Groq (mais rapido)

Sub-agente (tarefas simples):
  → GLM 4.7 Flash via OpenRouter ($0.06 input!)
```

---

## Score Matrix Completa

| Modelo | Provider | MD | Code | Refactor | Media |
|--------|----------|-----|------|----------|-------|
| Gemini 2.5 Pro | OpenRouter | 100% | 100% | 91% | 97% |
| GLM 4.7 | OpenRouter | 95% | 100% | 91% | 95% |
| GLM 4.7 Flash | OpenRouter | 95% | 100% | 82% | 92% |
| GLM 4.5 Air | OpenRouter | 86% | 100% | 91% | 92% |
| Claude (controle) | Anthropic | 100% | 85% | 91% | 92% |
| Qwen3 32B | Groq | 86% | 92% | 91% | 90% |
| Qwen3 235B | OpenRouter | 0%* | 100% | 91% | 64% |
| GPT-4o | OpenRouter | 0%* | 92% | 91% | 61% |
| GPT-OSS 20B | Groq | 0%* | 92% | 91% | 61% |
| GPT-4.1 Nano | OpenRouter | 77% | 83% | 0%* | 53% |
| DeepSeek Chat | OpenRouter | 0%* | 100% | 0%* | 33% |
| GPT-OSS 120B | Groq | 0%* | 100% | 0%* | 33% |
| Devstral Small | OpenRouter | 0%* | 100% | 0%* | 33% |
| Mistral Small 3.2 | OpenRouter | 0%* | 92% | 0%* | 31% |
| Qwen3 32B | OpenRouter | 86% | 0%* | 0%* | 29% |
| Kimi K2 | Groq | 0% | 0% | 0% | 0% |
| Kimi K2 | OpenRouter | 0% | 0% | 0% | 0% |
| DeepSeek V3.2 | OpenRouter | 0% | 0% | 0% | 0% |
| DeepSeek Chat v3-0324 | OpenRouter | 0% | 0% | 0% | 0% |
| Llama 3.3 70B | Groq | 0% | 0% | 0% | 0% |
| Llama 4 Scout | Groq | 0% | 0% | 0% | 0% |
| Llama 4 Maverick | OpenRouter | 0% | 0% | 0% | 0% |
| Gemini 2.5 Flash Lite | OpenRouter | 0% | 0% | 0% | 0% |
| GLM 4 32B | OpenRouter | 0% | 0% | 0% | 0% |

---

## Notas sobre o benchmark

- **DeepSeek Coder** nao existe mais como modelo separado — foi merged no DeepSeek Chat
- **Code-Llama** so tem versao Solidity no OpenRouter (nicho)
- **Groq como provider** teve alta taxa de falha — apenas Qwen3 32B e GPT-OSS funcionaram
- **Tool calling e o gargalo principal** — maioria dos modelos gera texto otimo mas nao sabe chamar Write/Edit
- Os scores de 0%* nao significam que o modelo e ruim em gerar conteudo — significa que nao sabe operar como agente via openclaude-sdk
- O benchmark mede capacidade **agentica** (tool use + qualidade), nao apenas qualidade de texto
