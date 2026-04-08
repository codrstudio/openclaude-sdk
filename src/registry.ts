// ---------------------------------------------------------------------------
// Provider/Model Registry — resolve env vars para openclaude CLI
// ---------------------------------------------------------------------------

import type { Provider, Model, ProviderRegistry } from "./types/provider.js"

// ---------------------------------------------------------------------------
// resolveModelEnv() — mapeia provider type para env vars do openclaude
// ---------------------------------------------------------------------------

export function resolveModelEnv(
  registry: ProviderRegistry,
  modelId: string,
): Record<string, string> {
  const model = registry.models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Model not found: ${modelId}`)

  const provider = registry.providers.find((p) => p.id === model.provider)
  if (!provider) throw new Error(`Provider not found: ${model.provider}`)

  switch (provider.type) {
    case "openai":
      return {
        CLAUDE_CODE_USE_OPENAI: "1",
        ...(provider.baseUrl ? { OPENAI_BASE_URL: provider.baseUrl } : {}),
        ...(provider.apiKey ? { OPENAI_API_KEY: provider.apiKey } : {}),
        OPENAI_MODEL: modelId,
      }
    case "gemini":
      return {
        CLAUDE_CODE_USE_GEMINI: "1",
        ...(provider.apiKey ? { GEMINI_API_KEY: provider.apiKey } : {}),
        OPENAI_MODEL: modelId,
      }
    case "github":
      return {
        CLAUDE_CODE_USE_GITHUB: "1",
        OPENAI_MODEL: modelId,
      }
    case "bedrock":
      throw new Error(
        `Provider type 'bedrock' is not supported by openclaude-sdk`,
      )
    case "vertex":
      throw new Error(
        `Provider type 'vertex' is not supported by openclaude-sdk`,
      )
    default: {
      const _exhaustive: never = provider.type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// createOpenRouterRegistry() — factory para OpenRouter
// ---------------------------------------------------------------------------

export function createOpenRouterRegistry(config: {
  apiKey: string
  models: {
    id: string
    label: string
    contextWindow?: number
    supportsVision?: boolean
  }[]
}): ProviderRegistry {
  return {
    providers: [
      {
        id: "openrouter",
        name: "OpenRouter",
        type: "openai",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: config.apiKey,
      },
    ],
    models: config.models.map((m) => ({ ...m, provider: "openrouter" })),
    defaultModel: config.models[0]?.id || "",
  }
}

// ---------------------------------------------------------------------------
// resolveCommand() — sempre "openclaude" (nao usamos claude CLI)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use resolveExecutable() from process.ts instead.
 */
export function resolveCommand(
  _registry: ProviderRegistry,
  _modelId: string,
): string {
  return "openclaude"
}
