# stdin-write-lock

**Severidade**: Medio
**Arquivo alvo**: `src/process.ts` — funcao `writeStdin()` (linhas 225-230)
**Referencia Python**: `ref/subprocess_cli.py` — metodo `write()` (linha 505-529), uso de `self._write_lock` (linha 61)

## Problema

`writeStdin()` verifica se o processo esta vivo (`proc.exitCode !== null || proc.killed`) e depois escreve. Sem lock, se `close()` for chamado entre o check e o write, ocorre EPIPE — o stdin ja foi fechado.

O Python resolve com `anyio.Lock()` que protege o check + write como operacao atomica. O `close()` tambem adquire o lock antes de fechar stdin e setar `_ready = false`.

## O que fazer

Como o TypeScript SDK usa I/O sincrono do Node.js (nao async), a race condition e menos provavel mas ainda possivel com o event loop. A solucao e:

### Opcao 1: Flag atomica com guard

```typescript
let stdinClosed = false

function writeStdin(data: string): void {
  if (stdinClosed) {
    throw new Error("writeStdin: stdin already closed")
  }
  if (proc.exitCode !== null || proc.killed) {
    throw new Error("writeStdin: process has already exited")
  }
  proc.stdin?.write(data)
}

function close(): void {
  stdinClosed = true
  proc.stdin?.end()
  // ... shutdown stages
}
```

### Opcao 2: Centralizar lifecycle

Encapsular `proc.stdin` em um wrapper que:
- Rastreia estado (open/closed)
- Previne writes apos close
- Lanca erro descritivo

A opcao 1 e suficiente dado que Node.js e single-threaded no event loop.

## Validacao

- `writeStdin()` apos `close()` deve lancar erro, nao EPIPE
- `close()` seguido imediatamente de `writeStdin()` deve lancar erro
- Operacao normal (write antes de close) continua funcionando
