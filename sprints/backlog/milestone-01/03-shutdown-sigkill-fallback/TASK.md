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
