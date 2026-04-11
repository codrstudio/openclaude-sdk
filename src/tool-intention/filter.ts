import type { SDKMessage, ToolResultBlock } from "../types/messages.js"
import type { ToolIntentionPayload } from "./types.js"
import { pickIntention } from "./picker.js"

/**
 * Returns true if all content blocks in a user message are `tool_result` blocks.
 * Used to detect tool-result-only messages that should be suppressed in intention mode.
 */
function isOnlyToolResult(msg: { message: { content: unknown } }): boolean {
  const content = msg.message.content
  if (!Array.isArray(content) || content.length === 0) return false
  return content.every(
    (block): block is ToolResultBlock =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "tool_result",
  )
}

/**
 * Applies the tool intention filter to an SDK message.
 *
 * - `assistant` messages: replaces `tool_use` block `input` with a `ToolIntentionPayload`,
 *   except for `mcp__display__*` tools which pass through unchanged.
 * - `user` messages whose content consists entirely of `tool_result` blocks: returns `null`
 *   (suppressed — the consumer should skip these).
 * - All other messages: returned unchanged.
 *
 * This function is 100% synchronous — no `await`, no I/O.
 */
export function applyToolIntentionFilter(
  msg: SDKMessage,
  locale: string | undefined,
): SDKMessage | null {
  // Suppress tool_result-only user messages
  if (msg.type === "user" && isOnlyToolResult(msg)) {
    return null
  }

  // Filter tool_use blocks in assistant messages
  if (msg.type === "assistant") {
    const newContent = msg.message.content.map((block) => {
      if (block.type !== "tool_use") return block
      // mcp__display__* tools bypass the filter — their input IS the visual content
      if (block.name.startsWith("mcp__display__")) return block

      const payload = {
        _intention: pickIntention(block.name, locale),
        _toolName: block.name,
        _toolUseId: block.id,
        _filtered: true,
      } satisfies ToolIntentionPayload

      return { ...block, input: payload }
    })

    return { ...msg, message: { ...msg.message, content: newContent } }
  }

  return msg
}
