# Skill: Commits temáticos

## Quando usar

Sempre que for solicitado a commitar, fazer commit, salvar mudanças no git, ou qualquer variação disso — **siga estas instruções obrigatoriamente**. Isso inclui:

- Pedidos diretos: "commita", "faz commit", "salva no git"
- Após concluir uma tarefa quando o usuário pedir para commitar
- Invocação do comando `/git-commit`

## **IMPORTANTE**
Ignore submodulos do GIT.

## Padrão de commits

Modelo **Conventional Commits**, mensagens em **pt-BR**, concisas e inequívocas.

### Estrutura da mensagem

```
<tipo>(<escopo>): <resumo direto da mudança>

- [opcional] bullets com decisões ou exemplos
```

### Tipos

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Estilo de código (sem impacto funcional) |
| `refactor` | Refatoração sem alterar funcionalidade |
| `perf` | Melhorias de performance |
| `test` | Testes |
| `build` | Build ou dependências |
| `ci` | CI/CD |
| `chore` | Manutenção geral |
| `revert` | Reverter commit anterior |

### Escopos recomendados

`system`, `commands`, `blueprint`, `template`, `domain`, `feature`, `task`, `docs`, `auth`, `api`, `ui`, `db`, `docker`, `deps`

## Modo de execução

### 1. Commits temáticos (padrão)

Agrupe mudanças por tema/contexto e faça commits separados:

1. **Analisar** todas as mudanças (`git status` + `git diff`)
2. **Agrupar** por tema relacionado
3. **Ordenar** por dependência lógica (base primeiro):
   - Dependências/build
   - Refatorações base
   - Features/fixes
   - Testes
   - Documentação/chore
4. **Para cada grupo**: `git add [arquivos]` + `git commit`

### 2. Commit único (quando solicitado com --one ou explicitamente)

Faz um único commit com todas as mudanças.

## Regras

- **Nunca** misture temas diferentes no mesmo commit (exceto --one)
- **Nunca** use termos vagos ("ajustes", "melhorias", "pequenas correções")
- **Declare o resultado**, não o passo a passo
- Cada commit deve ser **atômico e independente**
- Use `git add` **seletivo** por grupo (nunca `git add -A` em modo temático)
- Mensagens em **pt-BR**

## Exemplo de agrupamento

Mudanças detectadas: README.md, auth.js, login.css, api.test.js, package.json

```bash
# 1 - Dependências
git add package.json package-lock.json
git commit -m "build(deps): atualizar dependências do projeto"

# 2 - Refatoração
git add auth.js
git commit -m "refactor(auth): reorganizar módulo de autenticação"

# 3 - Estilos
git add login.css
git commit -m "style(auth): ajustar estilos do formulário de login"

# 4 - Testes
git add api.test.js
git commit -m "test(api): adicionar testes para endpoints de autenticação"

# 5 - Docs
git add README.md
git commit -m "docs(readme): atualizar instruções de instalação"
```

