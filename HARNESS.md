# Harness — Agentic Workflow

Voce esta sendo executado como agente autonomo dentro de um pipeline de workflow gerenciado pelo **agentic-workflow harness**. Siga estas instrucoes obrigatoriamente.

## Contexto de execucao

- Voce recebe uma tarefa por vez (step) e deve executa-la completamente.
- Seu `cwd` e um git worktree isolado — commite livremente sem afetar outras branches.
- Ao concluir, responda com o JSON estruturado solicitado no prompt.

## Git

- Commits seguem **Conventional Commits** em **pt-BR**.
- Use a skill `git-commit` quando precisar commitar.
- Commits devem ser **atomicos e tematicos** (um tema por commit).
- Use `git add` seletivo — **nunca** `git add -A` ou `git add .`.
- **Nunca** use comandos destrutivos: `git reset --hard`, `git checkout -- .`, `git clean -f`.

## Codigo

- **Portugues** no texto, **ingles** no codigo (variaveis, tipos, SQL).
- **Phosphor Icons** — nunca Lucide.
- **Pino** para logging — `console.log` proibido no backend.
- **SSE** para realtime — polling e WebSocket sao proibidos.
- **Cores semanticas** — nunca classes de cor direta. Consulte skill `semantic-colors`.
- **DRY em UI** — componentes em `packages/ui/`, reusar em todas as apps. Consulte skill `ui-dry`.
- **Mobile-first**: drawer no mobile, dialog/sheet no desktop via `useIsMobile()`.

## Skills disponiveis

As skills em `.claude/skills/` contem referencia detalhada para tecnologias especificas. Consulte-as antes de implementar na area correspondente:

| Skill | Quando consultar |
|-------|-----------------|
| `dev-launch` | Ao levantar o app para testar/validar |
| `git-commit` | Ao commitar |
| `rocim` | Ao criar/otimizar prompts |
| `prp` | Ao escrever ou validar PRPs |
| `specs` | Ao escrever ou validar specs |
| `stacks` | Ao escolher dependencias ou criar projeto |
| `ui-dry` | Ao criar/modificar componentes de interface |
| `semantic-colors` | Ao aplicar cores em qualquer componente |
| `shadcn` | Ao usar componentes shadcn/ui |
| `vaul` | Ao implementar drawers/popups responsivos |
| `framer-motion` | Ao adicionar animacoes |
| `app-shell` | Ao implementar layout/navegacao |
| `realtime-sse` | Ao implementar realtime |
| `env-pattern` | Ao configurar .env |
| `enc-encryption` | Ao gerenciar secrets |
| `brand-assets` | Ao trabalhar com assets de marca |

## Limites

- Nao adicione comentarios, docstrings ou type annotations em codigo que nao alterou.
- Nao crie abstractions especulativas ou helpers para operacoes unicas.
- Nao mate processos pelo nome — sempre identifique pelo PID.
