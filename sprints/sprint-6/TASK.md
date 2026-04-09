# openclaude-sdk

Um SDK em TypeScript que permite usar o OpenClaude (fork open-source do Claude Code) de forma programática, dentro de aplicações Node.js.

## Problema que resolve

O OpenClaude CLI é uma ferramenta interativa de terminal — você digita prompts e o agente responde. Mas para quem quer **integrar um agente de código em seus próprios sistemas** (automações, pipelines, produtos), usar o terminal não serve. É preciso uma interface programática.

O openclaude-sdk faz essa ponte: transforma o CLI num componente controlável por código.

## O que permite fazer

- **Conversar com o agente** — enviar prompts e receber respostas em streaming, como um chat programático
- **Controlar permissões** — aprovar ou negar ações do agente (leitura de arquivos, execução de comandos) sem intervenção humana
- **Gerenciar sessões** — retomar conversas anteriores, listar histórico, organizar sessões com títulos e tags
- **Usar múltiplos providers** — rotear requests para OpenRouter ou qualquer API compatível com OpenAI, não ficando preso a um único provedor
- **Tratar erros de forma inteligente** — distinguir erros recuperáveis (rate limit, timeout) de fatais (autenticação, billing), permitindo lógica de retry automático

## Para quem é

Desenvolvedores que querem construir produtos ou automações em cima de agentes de código — orquestradores, plataformas de desenvolvimento assistido por IA, ferramentas internas, CI/CD com agentes.

## Relação com o ecossistema

É o equivalente open-source do `@anthropic-ai/claude-code` SDK oficial da Anthropic, mas voltado para o OpenClaude. Mesma ideia, mesmo estilo de API, ecossistema diferente.

---

# Run Prompt

# shutdown-sigkill-fallback

**Severidade**: Medio
**Arquivo alvo**: `src/process.ts` — funcao `spawnAndStream()`, funcao `close()` (linha 232-234) e abort handler (linhas 192-206)
**Referencia Python**: `ref/subprocess_cli.py` — metodo `close()` (linha 451-499)

## Problema

O shutdown atual tem 2 estagios:
1. SIGINT (ou Ctrl+C byte no Windows)
2. Apos 5s, SIGTERM

Faltam dois mecanismos:
- **Fechar stdin como primeiro sinal** (EOF sinaliza ao CLI para salvar sessao e sair)
- **SIGKILL como fallback final** (se SIGTERM nao funcionar, o processo fica pendente)

Sem fechar stdin primeiro, o CLI pode nao salvar a sessao corretamente (referencia: issue #625 no Python SDK).

## O que fazer

Implementar shutdown de 3 estagios, seguindo o Python:

### Funcao `close()`

```
1. Fechar stdin (proc.stdin.end()) — sinaliza EOF ao CLI
2. Aguardar 5s para o processo sair graciosamente
3. Se timeout: SIGTERM + aguardar 5s
4. Se timeout: SIGKILL (proc.kill("SIGKILL")) + aguardar
```

### Abort handler (`onAbort`)

Atualizar para seguir a mesma sequencia:

```typescript
const onAbort = () => {
  // Stage 1: close stdin
  proc.stdin?.end()

  // Stage 2: wait, then SIGTERM
  sigintFallbackTimer = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM")

      // Stage 3: wait, then SIGKILL
      setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill("SIGKILL")
        }
      }, 5000)
    }
  }, 5000)
}
```

Manter o SIGINT/Ctrl+C para interrupcoes do usuario (via `interrupt()`), mas usar stdin-close para shutdowns programaticos (via `close()`).

## Validacao

- `close()` deve fechar stdin antes de enviar sinais
- Processo que ignora SIGTERM deve ser morto por SIGKILL
- Processo que sai apos fechar stdin nao deve receber sinais adicionais