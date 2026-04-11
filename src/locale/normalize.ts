import type { SupportedLocale } from "./types.js"

export function normalizeLocale(input: string | undefined): SupportedLocale {
  if (!input) return "pt-BR"

  const cleaned = input.trim().replace(/_/g, "-")
  if (!cleaned) return "pt-BR"

  const parts = cleaned.split("-")
  const lang = parts[0]?.toLowerCase()
  const region = parts[1]?.toUpperCase()

  if (!lang) return "pt-BR"

  const canonical = region ? `${lang}-${region}` : lang

  if (canonical === "pt-BR") return "pt-BR"
  if (canonical === "en-US") return "en-US"
  if (canonical === "es-ES") return "es-ES"

  if (lang === "pt") return "pt-BR"
  if (lang === "es") return "es-ES"
  if (lang === "en") return "en-US"

  return "en-US"
}
