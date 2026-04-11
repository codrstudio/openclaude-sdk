import * as http from "node:http"
import type { z } from "zod"
import type { McpSdkServerConfig } from "./types/options.js"

type AnyToolSchema = z.ZodRawShape | z.ZodTypeAny

export interface ToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >
  isError?: boolean
}

export interface SdkMcpToolDefinition<Schema extends AnyToolSchema = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (
    args: Schema extends z.ZodTypeAny ? z.infer<Schema> : Schema extends z.ZodRawShape ? z.infer<z.ZodObject<Schema>> : never,
    extra: unknown,
  ) => Promise<CallToolResult>
  annotations?: ToolAnnotations
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createSdkMcpServer(options: {
  name: string
  version?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<SdkMcpToolDefinition<any>>
}): Promise<McpSdkServerConfig> {
  // Import dinamico para nao forcar dep em quem nao usa MCP
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")

  const server = new McpServer({
    name: options.name,
    version: options.version ?? "1.0.0",
  })

  if (options.tools) {
    for (const toolDef of options.tools) {
      server.registerTool(
        toolDef.name,
        {
          description: toolDef.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: toolDef.inputSchema as any,
          annotations: toolDef.annotations,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (args: unknown, extra: unknown) => {
          return toolDef.handler(args as any, extra) as any
        },
      )
    }
  }

  return {
    type: "sdk" as const,
    name: options.name,
    instance: server,
  }
}

export async function startSdkServerTransport(
  config: McpSdkServerConfig,
): Promise<{ port: number; close: () => Promise<void> }> {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  )

  // Stateless mode — no session management needed for local in-process use
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  const server = http.createServer(async (req, res) => {
    if (req.url === "/mcp") {
      // Collect body for POST requests
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(chunk as Buffer)
      }
      const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : undefined
      await transport.handleRequest(req, res, body)
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  // Bind to port 0 — OS assigns a random available port
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

  const address = server.address() as { port: number }

  // Connect the McpServer instance to the transport
  const mcpServer = config.instance as { connect: (transport: unknown) => Promise<void> }
  await mcpServer.connect(transport)

  return {
    port: address.port,
    close: async () => {
      await transport.close()
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    },
  }
}

export function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<z.ZodObject<Schema>>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>

export function tool<Schema extends z.ZodTypeAny>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<Schema>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tool(
  name: string,
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SdkMcpToolDefinition<any> {
  return {
    name,
    description,
    inputSchema,
    handler,
    annotations: extras?.annotations,
  }
}
