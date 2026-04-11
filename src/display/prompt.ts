type SystemPromptInput =
  | string
  | { type: "preset"; preset: "claude_code"; append?: string }
  | undefined

type SystemPromptResult =
  | string
  | { type: "preset"; preset: "claude_code"; append?: string }

export function mergeSystemPromptAppend(
  existing: SystemPromptInput,
  append: string,
): SystemPromptResult {
  if (existing === undefined) {
    return { type: "preset", preset: "claude_code", append }
  }
  if (typeof existing === "string") {
    return `${existing}\n\n${append}`
  }
  return {
    type: "preset",
    preset: "claude_code",
    append: existing.append !== undefined ? `${existing.append}\n\n${append}` : append,
  }
}

export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured \
content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific \
to that action. Call them exactly like any other tool. The client renders them as \
interactive widgets.`
