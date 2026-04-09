---
name: prp
description: Formato PRP (Product Requirements Prompt) — especificacao declarativa para execucao autonoma por IA. Use quando precisar escrever, validar ou entender PRPs.
---

# PRP — Product Requirements Prompt

Um artefato declarativo de especificacao escrito para orientar a execucao autonoma de uma IA.

## O que e

PRP e o equivalente operacional de um Product Requirements Document, porem otimizado para modelos de linguagem, nao para humanos.

Ele nao descreve intencoes vagas nem ideias em aberto. Ele define limites, decisoes e forma de execucao.

**Definicao curta:** PRP e um contrato operacional entre humano e IA, onde todas as decisoes relevantes ja estao tomadas e a IA atua apenas como executora dentro de limites explicitos.

## Caracteristicas essenciais

| # | Caracteristica | Descricao |
|---|----------------|-----------|
| 1 | **Declarativo** | Afirma o que e, o que nao e e como deve ser feito. Nao e conversacional. |
| 2 | **Modular** | Cada secao tem funcao clara e previsivel. Estrutura padronizada. |
| 3 | **Decisoes explicitas** | Nada fica implicito para a IA "decidir depois". |
| 4 | **Limites rigidos** | Define o que a IA nao pode fazer. |
| 5 | **Sem ambiguidade** | Usa exemplos quando necessario para evitar interpretacoes livres. |
| 6 | **Execution Mode** | Deixa claro como a IA deve atuar. |
| 7 | **Orientado a execucao** | Existe para produzir saida previsivel, nao para discussao. |

## Execution Modes

O PRP deve declarar explicitamente o modo de execucao esperado:

- `implementar` — gerar codigo/artefato funcional
- `documentar` — apenas descrever sem implementar
- `simular` — executar dry-run ou walkthrough
- `gerar mock` — criar versao simplificada/placeholder
- `nao inferir` — seguir estritamente o descrito, sem extrapolar

## O que um PRP nao e

- Nao e um prompt criativo
- Nao e um brainstorm
- Nao e uma conversa
- Nao e um manifesto
- Nao delega decisoes estrategicas a IA

## Estrutura sugerida

```markdown
# [Nome do PRP]

## Objetivo
[O que deve ser produzido]

## Execution Mode
[implementar | documentar | simular | gerar mock | nao inferir]

## Contexto
[Estado atual, inputs disponiveis]

## Especificacao
[Requisitos detalhados, regras, formato esperado]

## Limites
[O que a IA NAO deve fazer]

## Exemplos
[Input/Output esperado, se necessario]
```

## Checklist de validacao

Um PRP esta bem escrito se:

- [ ] Todas as decisoes de negocio estao tomadas (nao ha "a criterio da IA")
- [ ] O Execution Mode esta explicito
- [ ] Os limites de escopo estao definidos
- [ ] Nao ha linguagem vaga ("talvez", "pode ser", "idealmente")
- [ ] Exemplos cobrem casos ambiguos
- [ ] A estrutura e previsivel e modular
