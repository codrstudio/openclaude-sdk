// ---------------------------------------------------------------------------
// Built-in Catalog — curated providers and models
//
// Edit this file to add/remove curated models. These are suggestions only;
// users can pass any model ID string to the SDK regardless of what's here.
// ---------------------------------------------------------------------------

import type { Catalog } from "../types/provider.js"

export const BUILTIN_CATALOG: Catalog = {
  providers: [
    // Native — uses the user's own Anthropic subscription (Max, Pro, etc.)
    { id: "anthropic", name: "Anthropic", type: "anthropic" },

    // OpenAI-compatible aggregators
    { id: "openrouter", name: "OpenRouter", type: "openai", baseUrl: "https://openrouter.ai/api/v1" },
    { id: "groq", name: "Groq", type: "openai", baseUrl: "https://api.groq.com/openai/v1" },

    // Direct providers
    { id: "openai", name: "OpenAI", type: "openai" },
    { id: "ollama", name: "Ollama", type: "ollama" },
    { id: "gemini", name: "Google Gemini", type: "gemini" },
    { id: "github", name: "GitHub Models", type: "github" },
  ],

  models: [
    // ── Anthropic (aliases — openclaude CLI resolves to latest version) ──
    { id: "haiku",  label: "Claude Haiku",  provider: "anthropic" },
    { id: "sonnet", label: "Claude Sonnet", provider: "anthropic" },
    { id: "opus",   label: "Claude Opus",   provider: "anthropic" },

    // ── OpenRouter ──
    { id: "z-ai/glm-4.7-flash", label: "GLM 4.7 Flash", provider: "openrouter", contextWindow: 128000 },
  ],

  defaultModel: "z-ai/glm-4.7-flash",
}
