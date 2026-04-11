import { createSdkMcpServer } from "../mcp.js"
import type { McpSdkServerConfig } from "../types/options.js"
import { createDisplayTools } from "./tools.js"

export async function createDisplayMcpServer(): Promise<McpSdkServerConfig> {
  return createSdkMcpServer({
    name: "display",
    tools: createDisplayTools(),
  })
}
