# openclaude-sdk - Documentacao das MCP Tool Factories no README

Documentar `tool()` e `createSdkMcpServer()` no README com exemplo end-to-end.

---

## Objetivo

Resolver D-048 (score 6): `tool()` e `createSdkMcpServer()` sao o caminho para MCP programatico inline, mas nao estao documentadas no README. Usuarios continuarao criando MCP servers externos desnecessariamente.

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `tool()` nao documentada | Factory de tools invisivel |
| 2 | `createSdkMcpServer()` nao documentada | Server in-process desconhecido |
| 3 | Tipos MCP nao documentados | `ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition` inacessiveis |

**Spec de referencia**: `sprints/sprint-8/2-specs/S-035-readme-mcp-tool-factories.md`

**Nota**: esta spec deve ser executada APOS S-038 a S-042 (fixes dos bugs), pois a documentacao deve refletir a API corrigida (async `createSdkMcpServer()`, transporte automatico).

---

## Implementacao

1. Nova secao "MCP Tool Factories" no README apos "MCP Servers"
2. Assinatura de `tool()` com generics Zod
3. Assinatura de `createSdkMcpServer()` — **async** (pos S-039)
4. Tabela dos tipos exportados (`ToolAnnotations`, `CallToolResult`, `SdkMcpToolDefinition`)
5. Exemplo end-to-end: definir tool com Zod, criar server, passar para query

```typescript
import { tool, createSdkMcpServer, query } from "openclaude-sdk"
import { z } from "zod"

const weatherTool = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text", text: `Weather in ${city}: 22C, sunny` }],
  }),
)

const server = await createSdkMcpServer({
  name: "my-tools",
  tools: [weatherTool],
})

const q = query({
  prompt: "What's the weather in London?",
  options: { mcpServers: { "my-tools": server } },
})
```

6. Nota sobre peerDependencies (`zod`, `@modelcontextprotocol/sdk`) — opcionais, so necessarias se usar MCP inline

---

## Criterios de Aceite

- [ ] Secao "MCP Tool Factories" no README
- [ ] `tool()` e `createSdkMcpServer()` documentadas com assinaturas
- [ ] Exemplo end-to-end compilavel
- [ ] Nota sobre peerDependencies
- [ ] `createSdkMcpServer()` documentada como **async** (refletindo S-039)
- [ ] Portugues no texto, ingles no codigo

---

## Rastreabilidade

| Componente | ID |
|------------|----|
| MCP Tool Factories docs | S-045 |
| Discovery | D-048 |
| Spec anterior | S-035 (sprint-8) |
| Dependencias | S-038, S-039, S-040, S-041, S-042 |
