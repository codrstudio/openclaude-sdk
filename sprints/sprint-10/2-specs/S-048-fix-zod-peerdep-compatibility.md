# openclaude-sdk - Corrigir Incompatibilidade de peerDependency Zod v3/v4

Restringir peerDependency de Zod para `>=4.0.0` para alinhar com o codigo compilado contra Zod v4.

---

## Objetivo

Resolver D-056 (score 8): `package.json` declara `devDependencies: { "zod": "^4.3.6" }` mas `peerDependencies: { "zod": ">=3.0.0" }`. O TypeScript compila contra Zod v4 — usuarios com Zod v3 enfrentam incompatibilidades de tipo ao usar `tool()` porque `z.ZodRawShape` e `z.ZodObject<Schema>` diferem entre v3 e v4.

| # | Problema | Consequencia |
|---|----------|--------------|
| 1 | peerDep aceita Zod v3 | Tipos incompativeis em inferencia de `tool()` |
| 2 | Sem erro em runtime | Usuario descobre o problema apenas ao compilar TS |

---

## Estado Atual

**Arquivo**: `package.json`, linhas 46-49

```json
"devDependencies": {
  "zod": "^4.3.6"
},
"peerDependencies": {
  "zod": ">=3.0.0"
}
```

---

## Implementacao

### 1. Restringir peerDependency

**Arquivo**: `package.json`

**Antes:**

```json
"peerDependencies": {
  "@modelcontextprotocol/sdk": ">=1.0.0",
  "zod": ">=3.0.0"
}
```

**Depois:**

```json
"peerDependencies": {
  "@modelcontextprotocol/sdk": ">=1.0.0",
  "zod": ">=4.0.0"
}
```

### 2. Nenhuma mudanca em codigo

O codigo em `src/mcp.ts` ja usa APIs Zod v4. A unica mudanca necessaria e no `package.json`.

---

## Criterios de Aceite

- [ ] `peerDependencies.zod` e `>=4.0.0`
- [ ] `devDependencies.zod` permanece `^4.3.6`
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| peerDependency Zod | S-048 |
| `package.json` | S-048 |
| Discovery | D-056 |
