import type { z } from "zod"
import type { McpSdkServerConfig } from "./types/options.js"

export interface ToolAnnotations {
  readOnly?: boolean
  destructive?: boolean
  idempotent?: boolean
  openWorld?: boolean
}

export interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >
  isError?: boolean
}

export interface SdkMcpToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: z.infer<z.ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
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
  const { z } = await import("zod")

  const server = new McpServer({
    name: options.name,
    version: options.version ?? "1.0.0",
  })

  if (options.tools) {
    for (const toolDef of options.tools) {
      const zodShape = z.object(toolDef.inputSchema)
      server.tool(
        toolDef.name,
        toolDef.description,
        { inputSchema: zodShape },
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

export function tool<Schema extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (
    args: z.infer<z.ZodObject<Schema>>,
    extra: unknown,
  ) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema> {
  return {
    name,
    description,
    inputSchema,
    handler,
    annotations: extras?.annotations,
  }
}
