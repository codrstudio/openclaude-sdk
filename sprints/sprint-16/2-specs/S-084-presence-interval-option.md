# openclaude-sdk - presenceIntervalMs: opcao de configuracao do heartbeat

Spec do campo `presenceIntervalMs` em `Options` para controlar o intervalo de heartbeat.

---

## Objetivo

Resolve D-113.

| Problema | Consequencia |
|----------|-------------|
| Nao existe forma de configurar o intervalo de heartbeat | Consumidores nao podem ajustar frequencia para debug (intervalo curto) ou desabilitar (batch jobs) |
| Sem semantica clara para desabilitacao | Timer roda desnecessariamente em cenarios batch/script |

---

## Estado Atual

### `src/types/options.ts`

- Interface `Options` (linha 268) tem 47 campos opcionais
- Ultimo campo adicionado: `locale?: string` (wave 15)
- Nao existe nenhum campo relacionado a heartbeat ou presence

---

## Implementacao

### 1. Adicionar `presenceIntervalMs` em `Options`

Apos o campo `locale` e antes de `sandbox`:

```typescript
export interface Options {
  // ... campos existentes ...
  locale?: string
  /**
   * Intervalo entre heartbeats de presenca em ms. Default: 15000 (15s).
   * Setar para 0 ou valor negativo desabilita o heartbeat.
   *
   * Heartbeats sao emitidos como `SDKMessage` do tipo "presence" e servem
   * pra manter conexoes SSE vivas em UIs de chat. Consumidores que so
   * fazem `collectMessages()` podem ignorar.
   */
  presenceIntervalMs?: number
  sandbox?: SandboxSettings
  // ... resto ...
}
```

### Regras

- Tipo `number | undefined` — nao aceita string, nao aceita boolean
- `undefined` = default 15000ms (15s)
- `0` = desabilitado — timer nao e criado
- Valor negativo = tratado como desabilitado (mesmo efeito de 0)
- Valores positivos menores que 1000ms sao aceitos (sem floor) — consumidor avancado pode querer 1s para debug
- O campo NAO gera flag CLI — e puramente SDK-side (analogia: `richOutput`, `locale`)
- JSDoc obrigatorio com semantica completa

### Semantica de ativacao no `query()`

```
presenceIntervalMs === undefined → timer com 15000ms
presenceIntervalMs === 0        → sem timer
presenceIntervalMs < 0          → sem timer
presenceIntervalMs > 0          → timer com esse valor
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/options.ts` | Novo campo `presenceIntervalMs?: number` em `Options` |

---

## Criterios de Aceite

- [ ] Campo `presenceIntervalMs?: number` existe em `Options`
- [ ] JSDoc descreve default (15000), semantica de 0 (desabilita), e proposito
- [ ] Campo posicionado apos `locale`, antes de `sandbox`
- [ ] `tsc --noEmit` passa
- [ ] Campo NAO aparece em `buildCliArgs()` de `src/process.ts`

---

## Rastreabilidade

| Componente | Spec |
|------------|------|
| `presenceIntervalMs` em Options | S-084 |
| D-113 | S-084 |
