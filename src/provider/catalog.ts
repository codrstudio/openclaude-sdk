// ---------------------------------------------------------------------------
// provider/catalog.ts — catálogo estático de métodos de auth/provider.
//
// É o contrato que dirige a UI: cada entrada descreve um método (Anthropic OAuth
// ou um provider via credencial) e os campos do formulário. Não contém secrets.
// O backend serve esse catálogo; a UI renderiza forms a partir dele.
// ---------------------------------------------------------------------------

import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MISTRAL_BASE_URL,
  DEFAULT_MISTRAL_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENAI_BASE_URL,
} from "./builders.js";
import type { ProviderProfile } from "./profile.js";

export type ProviderKind = "oauth" | "apiKey" | "local";

export interface CatalogField {
  key: string;
  label: string;
  type: "password" | "text" | "select";
  required?: boolean;
  placeholder?: string;
  default?: string;
  options?: { value: string; label: string }[];
  /** Mostra o campo só quando outro campo tem certo valor (ex.: Gemini authMode). */
  showIf?: { field: string; equals: string };
  help?: string;
}

export interface CatalogOAuthMode {
  value: "claudeai" | "console" | "sso";
  label: string;
  description?: string;
}

export interface CatalogEntry {
  /** Id único do método (ex.: "openai", "xai", "gemini"). */
  id: string;
  label: string;
  description?: string;
  kind: ProviderKind;
  /** Qual profile é gravado quando este método é salvo. Ignorado p/ kind "oauth". */
  profile: ProviderProfile;
  docsUrl?: string;
  fields: CatalogField[];
  /** Modos OAuth (só para o método Anthropic). */
  oauthModes?: CatalogOAuthMode[];
}

const MODEL_FIELD = (defaultModel: string, placeholder?: string): CatalogField => ({
  key: "model",
  label: "Modelo",
  type: "text",
  default: defaultModel,
  placeholder: placeholder ?? defaultModel,
});

const BASE_URL_FIELD = (defaultUrl: string): CatalogField => ({
  key: "baseUrl",
  label: "Base URL",
  type: "text",
  default: defaultUrl,
  placeholder: defaultUrl,
});

const API_KEY_FIELD = (placeholder: string): CatalogField => ({
  key: "apiKey",
  label: "API Key",
  type: "password",
  required: true,
  placeholder,
});

/** Catálogo curado. A ordem é a ordem de exibição. */
export const PROVIDER_CATALOG: CatalogEntry[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude.ai (Pro/Max), Console (API) ou SSO corporativo.",
    kind: "oauth",
    profile: "anthropic",
    docsUrl: "https://claude.ai",
    fields: [],
    oauthModes: [
      { value: "claudeai", label: "Claude.ai (Pro/Max)", description: "Assinatura Claude.ai." },
      { value: "console", label: "Console (API)", description: "Billing por API da Anthropic." },
      { value: "sso", label: "SSO corporativo", description: "Single Sign-On da organização." },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI ou qualquer endpoint compatível.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://platform.openai.com/api-keys",
    fields: [API_KEY_FIELD("sk-..."), MODEL_FIELD("gpt-4o"), BASE_URL_FIELD(DEFAULT_OPENAI_BASE_URL)],
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    description: "Grok via API compatível com OpenAI.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://console.x.ai",
    fields: [API_KEY_FIELD("xai-..."), MODEL_FIELD("grok-2-latest"), BASE_URL_FIELD("https://api.x.ai/v1")],
  },
  {
    id: "groq",
    label: "Groq",
    description: "Inferência rápida via API compatível com OpenAI.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://console.groq.com/keys",
    fields: [
      API_KEY_FIELD("gsk_..."),
      MODEL_FIELD("llama-3.3-70b-versatile"),
      BASE_URL_FIELD("https://api.groq.com/openai/v1"),
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek via API compatível com OpenAI.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://platform.deepseek.com",
    fields: [API_KEY_FIELD("sk-..."), MODEL_FIELD("deepseek-chat"), BASE_URL_FIELD("https://api.deepseek.com/v1")],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Roteador de modelos via API compatível com OpenAI.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://openrouter.ai/keys",
    fields: [
      API_KEY_FIELD("sk-or-..."),
      MODEL_FIELD("openai/gpt-4o"),
      BASE_URL_FIELD("https://openrouter.ai/api/v1"),
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    description: "NVIDIA NIM via API compatível com OpenAI.",
    kind: "apiKey",
    profile: "openai",
    docsUrl: "https://build.nvidia.com",
    fields: [
      API_KEY_FIELD("nvapi-..."),
      MODEL_FIELD("nvidia/llama-3.1-nemotron-70b-instruct"),
      BASE_URL_FIELD("https://integrate.api.nvidia.com/v1"),
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "API key, access token ou ADC local.",
    kind: "apiKey",
    profile: "gemini",
    docsUrl: "https://aistudio.google.com/apikey",
    fields: [
      {
        key: "authMode",
        label: "Modo de autenticação",
        type: "select",
        default: "api-key",
        options: [
          { value: "api-key", label: "API Key" },
          { value: "access-token", label: "Access Token" },
          { value: "adc", label: "ADC (gcloud local)" },
        ],
      },
      { ...API_KEY_FIELD("AIza..."), required: false, showIf: { field: "authMode", equals: "api-key" } },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "ya29....",
        showIf: { field: "authMode", equals: "access-token" },
      },
      MODEL_FIELD(DEFAULT_GEMINI_MODEL),
      BASE_URL_FIELD(DEFAULT_GEMINI_BASE_URL),
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    description: "Mistral AI.",
    kind: "apiKey",
    profile: "mistral",
    docsUrl: "https://console.mistral.ai/api-keys",
    fields: [API_KEY_FIELD("..."), MODEL_FIELD(DEFAULT_MISTRAL_MODEL), BASE_URL_FIELD(DEFAULT_MISTRAL_BASE_URL)],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    description: "Modelos locais via daemon Ollama.",
    kind: "local",
    profile: "ollama",
    docsUrl: "https://ollama.com",
    fields: [
      { key: "model", label: "Modelo", type: "text", required: true, placeholder: DEFAULT_OLLAMA_MODEL },
      BASE_URL_FIELD(DEFAULT_OLLAMA_BASE_URL),
    ],
  },
  {
    id: "codex",
    label: "Codex (ChatGPT)",
    description: "Backend Codex com credenciais existentes.",
    kind: "apiKey",
    profile: "codex",
    docsUrl: "https://chatgpt.com",
    fields: [
      { ...API_KEY_FIELD("CODEX_API_KEY"), label: "Codex API Key" },
      { key: "accountId", label: "ChatGPT Account ID", type: "text", required: true, placeholder: "acct_..." },
      {
        key: "model",
        label: "Modelo",
        type: "select",
        default: "codexplan",
        options: [
          { value: "codexplan", label: "codexplan (GPT-5.4, mais raciocínio)" },
          { value: "codexspark", label: "codexspark (mais rápido)" },
        ],
      },
      BASE_URL_FIELD(DEFAULT_CODEX_BASE_URL),
    ],
  },
  {
    id: "github",
    label: "GitHub Models",
    description: "Modelos via GitHub Models (token GitHub).",
    kind: "apiKey",
    profile: "github",
    docsUrl: "https://github.com/marketplace/models",
    fields: [
      { ...API_KEY_FIELD("ghp_..."), label: "GitHub Token" },
      MODEL_FIELD("gpt-4o"),
      BASE_URL_FIELD("https://models.github.ai/inference"),
    ],
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return PROVIDER_CATALOG.find((e) => e.id === id);
}
