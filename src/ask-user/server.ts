import { randomUUID } from "node:crypto"
import type { CallToolResult } from "../mcp.js"
import { tool, createSdkMcpServer } from "../mcp.js"
import type { McpSdkServerConfig } from "../types/options.js"
import type { AskUserRequest, AskUserAnswer } from "./types.js"
import { askUserSchema } from "./schema.js"
import type { AskUserInput } from "./schema.js"

export type AskUserEmitter = (request: AskUserRequest) => void

export async function createAskUserMcpServer(options: {
  onAskUser: AskUserEmitter
  pendingMap: Map<string, (answer: AskUserAnswer) => void>
  timeoutMs?: number
}): Promise<McpSdkServerConfig> {
  const handler = async (args: AskUserInput): Promise<CallToolResult> => {
    if (options.pendingMap.size > 0) {
      return {
        content: [{ type: "text", text: "Error: previous question not yet answered. Wait for the user to respond before asking another question." }],
        isError: true,
      }
    }

    const callId = randomUUID()

    const answer = await new Promise<AskUserAnswer>((resolve) => {
      options.pendingMap.set(callId, resolve)

      options.onAskUser({
        callId,
        question: args.question,
        context: args.context,
        inputType: args.inputType ?? "text",
        choices: args.choices,
        placeholder: args.placeholder,
      })

      if (options.timeoutMs !== undefined) {
        setTimeout(() => {
          if (options.pendingMap.has(callId)) {
            options.pendingMap.get(callId)!({ type: "cancelled" })
            options.pendingMap.delete(callId)
          }
        }, options.timeoutMs)
      }
    })

    options.pendingMap.delete(callId)

    return {
      content: [{ type: "text", text: formatAnswer(answer, options.timeoutMs) }],
    }
  }

  const askUserTool = tool(
    "ask_user",
    "Ask the user a question and wait for their response. Use when you need clarification, missing information, or explicit confirmation.",
    askUserSchema.shape,
    handler,
  )

  return createSdkMcpServer({
    name: "ask_user",
    tools: [askUserTool],
  })
}

export function formatAnswer(answer: AskUserAnswer, timeoutMs?: number): string {
  switch (answer.type) {
    case "text":
      return `User answered: ${answer.value}`
    case "number":
      return `User answered: ${answer.value}`
    case "boolean":
      return `User answered: ${answer.value ? "yes" : "no"}`
    case "choice":
      return `User chose: ${answer.id}`
    case "cancelled":
      if (timeoutMs !== undefined) {
        return `User did not respond within ${Math.round(timeoutMs / 1000)}s.`
      }
      return "User cancelled the question."
  }
}
