---
name: specs
description: Como escrever specs/ — 6 tipos de documento de especificacao (requirements, user stories, ER, design, UI/UX, feature) com formato padronizado. Use quando precisar escrever ou validar specs.
---

# Spec Patterns — Como Escrever specs/

Guia de escrita para os documentos de especificacao em `specs/`. Leia, entenda, reproduza.

---

## Convencoes de Formato

**Tudo abaixo e obrigatorio.**

| Regra | Detalhe |
|-------|---------|
| Nome do arquivo | `{projeto}-{topico}.md` |
| Idioma do texto | Portugues (PT-BR) |
| Idioma de codigo | Ingles (variaveis, tabelas SQL, tipos TS) |
| Tom | Direto, declarativo, sem floreio |
| Formato primario | Tabelas markdown |
| Paragrafos | Evite. Se precisa explicar, use lista ou tabela |
| Hierarquia | H1 titulo, H2 secoes, H3 subsecoes |
| Separadores | `---` entre secoes H2 |
| Exemplos | `✅` correto e `❌` proibido quando houver regras |
| Rastreabilidade | Secao final mapeando componentes/modulos -> IDs |

### Abertura Padrao

Toda spec comeca assim:

```markdown
# {Projeto} - {Titulo Descritivo}

{Uma unica frase descrevendo o proposito do documento.}
```

---

## Tipo 1: Requirements

**Arquivo**: `{projeto}-requirements.md`

Statements atomicas no padrao OSD ("O Sistema Deve").

### Formato

```markdown
## {Modulo}

### RF - Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| OSD001 | O sistema deve permitir login com email e senha |

### RNF - Requisitos Nao Funcionais

| ID | Requisito |
|----|-----------|
| RNF001 | O sistema deve usar HTTP-only cookies no web |
```

### Regras

- Prefixo `OSD` para funcionais, `RNF` para nao-funcionais
- IDs sequenciais, agrupados por modulo com faixa reservada
- Cada requisito: uma frase, um verbo no infinitivo, uma capacidade testavel
- Requisitos vagos como "deve ser rapido" nao existem — use metricas
- Quando envolver permissoes, inclua **Matriz de Permissoes** como tabela

---

## Tipo 2: User Stories

**Arquivo**: `{projeto}-user-stories.md`

### Formato

```markdown
## {Tipo de Usuario}

### US001 - {Titulo curto}
**Como** {papel}
**Quero** {acao}
**Para** {beneficio}

**Criterios de Aceite:**
- [ ] Formulario solicita email e senha
- [ ] Validacao de formato de email

**Requisitos:** OSD001, OSD002
```

### Regras

- Prefixo `US` com IDs sequenciais
- Faixas de IDs por role
- Criterios de aceite como checklist — cada um verificavel
- Sempre referencia IDs OSD do requirements
- Agrupar por tipo de usuario, do menos privilegiado ao mais

---

## Tipo 3: Modelo de Dados (ER)

**Arquivo**: `{projeto}-er.md`

### Regras

- Diagrama Mermaid no topo (visao macro)
- Uma subsecao por entidade com tabela de campos
- Tabelas e campos em snake_case (ingles)
- Valores de enum em portugues quando user-facing
- Enums e indices em blocos SQL
- Relacionamentos como lista numerada com cardinalidade

---

## Tipo 4: Design e Arquitetura

**Arquivo**: `{projeto}-design.md`

### Regras

- Stack como tabela com justificativa (nao so tecnologia — por que ela)
- Fluxos em listas numeradas ou diagramas ASCII
- Bibliotecas com versao
- Ambientes (dev/staging/prod) como tabela comparativa
- Performance com metricas concretas e ferramenta de medicao
- Decisoes tecnicas sao vinculantes — se esta aqui, implementa assim

---

## Tipo 5: Guia de UI/UX

**Arquivo**: `{projeto}-ui-guide.md`

### Regras

- Principio fundamental em uma frase bold
- Tokens como tabela com uso e exemplo concreto
- Exemplos JSX com ✅/❌ para regras de estilo
- Catalogo de componentes por categoria (Layout, Forms, Acoes, Feedback, Dados, Sobreposicoes)
- Templates JSX para padroes de pagina (Lista, Form, Detalhe, Dashboard)
- Acessibilidade como checklist

---

## Tipo 6: Feature Spec

**Arquivo**: `{projeto}-{feature}.md`

Para features complexas que precisam de documentacao propria.

### Regras

- Secoes numeradas sequencialmente
- IDs proprios com prefixo da feature (OB para onboarding, EV para eventos, etc.)
- Componentes com: localizacao exata, interface TS de props, lista de comportamentos
- Schema SQL completo com tipos, FK, constraints
- Server Actions como assinaturas (nao implementacao)
- Hook com interface de retorno completa
- Integracao mostra JSX de como usar no app existente
- Metricas com valores numericos

### Quando Criar

Crie uma feature spec quando a feature:
- Tem fluxos diferentes por perfil de usuario
- Precisa de componentes UI dedicados
- Precisa de tabelas proprias no banco
- E complexa demais para caber numa user story

---

## Checklist de Qualidade

Antes de finalizar qualquer spec, verifique:

- [ ] Titulo segue `# {Projeto} - {Titulo}` com frase descritiva
- [ ] Tabelas onde poderia ter paragrafos
- [ ] IDs sequenciais com prefixo consistente
- [ ] Cada requisito e atomico e testavel
- [ ] Exemplos de codigo quando aplicavel
- [ ] ✅/❌ para regras de estilo
- [ ] Secao de Rastreabilidade no final
- [ ] Sem duplicacao com outros specs
- [ ] Portugues no texto, ingles no codigo
