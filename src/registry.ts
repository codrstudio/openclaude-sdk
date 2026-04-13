// ---------------------------------------------------------------------------
// Provider/Model Registry — resolve env vars para openclaude CLI
// ---------------------------------------------------------------------------

import type { Provider, Model, ProviderRegistry, ProviderType } from "./types/provider.js"

// ---------------------------------------------------------------------------
// Modelo default recomendado (benchmark 2026-04-09: 92% media, menor custo)
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = {
  id: "z-ai/glm-4.7-flash",
  label: "GLM 4.7 Flash",
  contextWindow: 128000,
} as const

// ---------------------------------------------------------------------------
// resolveModelEnv() — mapeia provider type para env vars do openclaude
// ---------------------------------------------------------------------------

function envForProviderType(
  provider: Provider,
  modelId: string,
): Record<string, string> {
  switch (provider.type) {
    case "anthropic":
      // Native Anthropic — no env vars needed.
      // CLI uses the user's own subscription (Max, Pro, etc.).
      // Model is passed via --model flag, not env vars.
      return {}

    case "openai":
      return {
        CLAUDE_CODE_USE_OPENAI: "1",
        ...(provider.baseUrl ? { OPENAI_BASE_URL: provider.baseUrl } : {}),
        ...(provider.apiKey ? { OPENAI_API_KEY: provider.apiKey } : {}),
        OPENAI_MODEL: modelId,
      }

    case "ollama":
      return {
        CLAUDE_CODE_USE_OPENAI: "1",
        OPENAI_BASE_URL: provider.baseUrl ?? "http://localhost:11434/v1",
        OPENAI_API_KEY: provider.apiKey ?? "ollama",
        OPENAI_MODEL: modelId,
      }

    case "gemini":
      return {
        CLAUDE_CODE_USE_GEMINI: "1",
        ...(provider.apiKey ? { GEMINI_API_KEY: provider.apiKey } : {}),
        GEMINI_MODEL: modelId,
      }

    case "github":
      return {
        CLAUDE_CODE_USE_GITHUB: "1",
        OPENAI_MODEL: modelId,
      }

    case "bedrock":
      return { CLAUDE_CODE_USE_BEDROCK: "1" }

    case "vertex":
      return { CLAUDE_CODE_USE_VERTEX: "1" }

    default: {
      const _exhaustive: never = provider.type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}

/**
 * Resolve env vars for a given model within a registry.
 *
 * If the model ID is found in `registry.models`, uses its linked provider.
 * Otherwise, falls back to the first provider in the registry (allows free
 * model IDs that aren't in the curated catalog).
 */
export function resolveModelEnv(
  registry: ProviderRegistry,
  modelId: string,
): Record<string, string> {
  const model = registry.models.find((m) => m.id === modelId)

  let provider: Provider | undefined

  if (model) {
    provider = registry.providers.find((p) => p.id === model.provider)
    if (!provider) throw new Error(`Provider not found: ${model.provider}`)
  } else {
    // Model not in catalog — infer provider by prefix (e.g. "openrouter/..." → openrouter)
    const byPrefix = registry.providers.find(
      (p) => p.id !== "anthropic" && modelId.startsWith(p.id + "/"),
    )
    // Or fall back to the provider of the registry's defaultModel
    if (byPrefix) {
      provider = byPrefix
    } else {
      const defaultModel = registry.models.find(
        (m) => m.id === registry.defaultModel,
      )
      provider = defaultModel
        ? registry.providers.find((p) => p.id === defaultModel.provider)
        : registry.providers[0]
    }
    if (!provider) throw new Error(`Cannot infer provider for model: ${modelId}`)
  }

  return envForProviderType(provider, modelId)
}

// ---------------------------------------------------------------------------
// createOpenRouterRegistry() — convenience factory for OpenRouter
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `createRegistryFromCatalog()` from `./catalog/index.js` instead.
 */
export function createOpenRouterRegistry(config: {
  apiKey: string
  models: {
    id: string
    label: string
    contextWindow?: number
    supportsVision?: boolean
  }[]
}): ProviderRegistry {
  if (!config.apiKey) {
    throw new Error("createOpenRouterRegistry: apiKey must not be empty")
  }
  if (!config.models.length) {
    throw new Error("createOpenRouterRegistry: models array must not be empty")
  }
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
