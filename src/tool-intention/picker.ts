import ptBR from "./locales/pt-BR.json" with { type: "json" }
import enUS from "./locales/en-US.json" with { type: "json" }
import esES from "./locales/es-ES.json" with { type: "json" }
import { normalizeLocale, type SupportedLocale } from "../locale/index.js"

const DICTS: Record<SupportedLocale, Record<string, string[]>> = {
  "pt-BR": ptBR as Record<string, string[]>,
  "en-US": enUS as Record<string, string[]>,
  "es-ES": esES as Record<string, string[]>,
}

export function pickIntention(
  toolName: string,
  locale: string | undefined,
): string {
  const normalized = normalizeLocale(locale)
  const dict = DICTS[normalized] ?? DICTS["en-US"]

  // Try full tool name first
  let list: string[] | undefined = dict[toolName]

  // MCP tools: "mcp__<server>__<tool>" — try last segment after __
  if (!list) {
    const lastSegment = toolName.split("__").pop()
    if (lastSegment && lastSegment !== toolName) {
      list = dict[lastSegment]
    }
  }

  // Fallback to _fallback entry
  if (!list || list.length === 0) list = dict["_fallback"] ?? []

  // Last resort
  if (list.length === 0) return "Usando uma ferramenta"

  return list[Math.floor(Math.random() * list.length)]!
}
