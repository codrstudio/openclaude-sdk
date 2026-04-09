# openclaude-sdk - Shutdown de 3 Estagios em close()

Implementar shutdown gracioso em `close()` com 3 estagios sequenciais: fechar stdin (EOF), SIGTERM, SIGKILL.

---

## Objetivo

Resolver D-035 (score 9): a funcao `close()` em `src/process.ts` (linha 246-248) chama diretamente `proc.kill("SIGTERM")` sem fechar stdin antes e sem SIGKILL como fallback final.

Dois problemas:

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | Nao fecha stdin antes de enviar sinal | CLI nao recebe EOF, pode nao salvar sessao antes de morrer (issue #625 Python SDK) |
| 2 | Sem SIGKILL como fallback | Processo que ignora SIGTERM fica pendente indefinidamente |

Referencia: `ref/subprocess_cli.py`, metodo `close()` (linhas 451-499) implementa o padrao de 3 estagios.

---

## Estado Atual

**Arquivo**: `src/process.ts`, funcao `close()`, linha 246-248

```typescript
function close(): void {
  proc.kill("SIGTERM")
}
```

Uma unica linha. Nao fecha stdin, nao aguarda, nao escala para SIGKILL.

---

## Implementacao

### 1. Tornar `close()` assincrona

`close()` precisa retornar uma `Promise<void>` para que o chamador possa aguardar o shutdown completo. Isso altera a assinatura do retorno de `spawnAndStream()`.

**Tipo de retorno atualizado**:

```typescript
export function spawnAndStream(
  command: string,
  args: string[],
  prompt: string,
  options: { /* ... */ },
): {
  stream: AsyncGenerator<SDKMessage>
  writeStdin: (data: string) => void
  close: () => Promise<void>  // era () => void
}
```

### 2. Implementar os 3 estagios

```typescript
function close(): Promise<void> {
  stdinClosed = true  // flag de D-037 — setar ANTES de end()

  return new Promise<void>((resolve) => {
    // Se processo ja saiu, resolve imediatamente
    if (proc.exitCode !== null) {
      resolve()
      return
    }

    const onExit = () => {
      clearTimeout(sigtermTimer)
      clearTimeout(sigkillTimer)
      resolve()
    }
    proc.once("exit", onExit)

    // Estagio 1: fechar stdin (EOF)
    proc.stdin?.end()

    // Estagio 2: apos 5s sem exit, SIGTERM
    let sigkillTimer: ReturnType<typeof setTimeout>
    const sigtermTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill("SIGTERM")

        // Estagio 3: apos mais 5s, SIGKILL
        sigkillTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            proc.kill("SIGKILL")
          }
        }, 5000)
      }
    }, 5000)
  })
}
```

### 3. Helper `waitForExit()`

Para evitar duplicacao entre `close()` e possivel uso em `onAbort`, extrair o padrao de "aguardar exit com cleanup de timers" num helper local (nao exportado):

```typescript
function waitForExit(proc: ChildProcess, timers: ReturnType<typeof setTimeout>[]): Promise<void> {
  return new Promise<void>((resolve) => {
    if (proc.exitCode !== null) {
      timers.forEach(clearTimeout)
      resolve()
      return
    }
    proc.once("exit", () => {
      timers.forEach(clearTimeout)
      resolve()
    })
  })
}
```

Uso opcional — o helper simplifica mas nao e obrigatorio. A implementacao inline (secao 2) e igualmente aceitavel.

### Comportamento por cenario

| Cenario | Antes | Depois |
|---------|-------|--------|
| Processo sai apos EOF no stdin | ❌ SIGTERM imediato, sessao pode nao salvar | ✅ Stdin fechado, CLI salva sessao, exit gracioso |
| Processo ignora EOF, responde a SIGTERM | ❌ SIGTERM imediato (funciona, mas sem EOF) | ✅ EOF → 5s → SIGTERM, processo sai |
| Processo ignora EOF e SIGTERM | ❌ Processo fica pendente para sempre | ✅ EOF → 5s → SIGTERM → 5s → SIGKILL |
| Processo ja saiu antes de `close()` | ❌ `proc.kill("SIGTERM")` lanca ESRCH | ✅ Resolve imediatamente sem enviar sinais |
| `close()` chamado duas vezes | ❌ Dois SIGTERMs | ✅ Segunda chamada: `stdinClosed` ja true, stdin ja closed, timers idem |

---

## Propagacao da Mudanca de Assinatura

`close()` muda de `() => void` para `() => Promise<void>`. Arquivos afetados:

| Arquivo | Mudanca |
|---------|---------|
| `src/process.ts` | Implementacao de `close()` + tipo de retorno de `spawnAndStream()` |
| `src/query.ts` | Chamador de `close()` — adicionar `await` onde necessario |
| `src/types/index.ts` | Se o tipo `Query` expoe `close`, atualizar assinatura |

---

## Arquivos Afetados

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/process.ts` | 246-248 | Substituir `close()` por versao de 3 estagios |
| `src/process.ts` | 175-190 | Atualizar tipo de retorno de `spawnAndStream()` |
| `src/query.ts` | (chamadas de `close()`) | Adicionar `await` |

---

## Criterios de Aceite

- [ ] `close()` retorna `Promise<void>`
- [ ] Estagio 1: `proc.stdin?.end()` e chamado antes de qualquer sinal
- [ ] Estagio 2: SIGTERM enviado somente apos 5s se processo nao saiu
- [ ] Estagio 3: SIGKILL enviado somente apos mais 5s se processo nao saiu
- [ ] Processo que sai apos EOF nao recebe SIGTERM nem SIGKILL
- [ ] Processo que ja saiu antes de `close()` resolve imediatamente
- [ ] Flag `stdinClosed` e setada antes de `proc.stdin?.end()` (integracao com S-026)
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| Shutdown de 3 estagios em `close()` | S-024 |
| Assinatura assincrona de `close()` | S-024 |
| Discovery | D-035 |
| Dependencia direta | S-026 (flag `stdinClosed`) |
