// ---------------------------------------------------------------------------
// provider/builders.ts — montagem do ProfileEnv por provider.
//
// Espelha os `build*ProfileEnv` do openclaude (`src/utils/providerProfile.ts`),
// mas puros: leem só os campos passados explicitamente (não tocam process.env),
// porque o caller é um backend que recebe os campos do formulário.
// ---------------------------------------------------------------------------

import type { ProfileEnv } from "./profile.js";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
export const DEFAULT_MISTRAL_MODEL = "devstral-latest";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

/** Placeholders que não devem ser aceitos como secret real. */
const PLACEHOLDER_PATTERNS = [
  /^sk-\.\.\.$/i,
  /sua[_\s-]?chave/i,
  /your[_\s-]?(api[_\s-]?)?key/i,
  /^<.*>$/,
  /^\.{3,}$/,
  /^aiza\.\.\.$/i,
  /^ya29\.\.\.$/i,
];

/** Trim + rejeita vazio/placeholder. Retorna undefined quando inválido. */
export function sanitizeApiKey(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed))) return undefined;
  return trimmed;
}

/** Trim genérico de valor de config (base URL, model). */
export function sanitizeValue(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface OpenAIProfileInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  model: string;
  apiFormat?: "chat_completions" | "responses" | null;
  authHeader?: string | null;
  authScheme?: "bearer" | "raw" | null;
  authHeaderValue?: string | null;
}

/**
 * Profile OpenAI-compatível. Cobre OpenAI e qualquer endpoint compatível
 * (xAI, Groq, DeepSeek, OpenRouter, NVIDIA, Together…) via base URL.
 * Exige apiKey ou authHeaderValue.
 */
export function buildOpenAIProfileEnv(input: OpenAIProfileInput): ProfileEnv | null {
  const key = sanitizeApiKey(input.apiKey);
  const headerValue = sanitizeApiKey(input.authHeaderValue);
  if (!key && !headerValue) return null;

  const model = sanitizeValue(input.model);
  if (!model) return null;

  return {
    OPENAI_BASE_URL: sanitizeValue(input.baseUrl) || DEFAULT_OPENAI_BASE_URL,
    OPENAI_MODEL: model,
    ...(input.apiFormat ? { OPENAI_API_FORMAT: input.apiFormat } : {}),
    ...(input.authHeader ? { OPENAI_AUTH_HEADER: input.authHeader } : {}),
    ...(input.authScheme ? { OPENAI_AUTH_SCHEME: input.authScheme } : {}),
    ...(headerValue ? { OPENAI_AUTH_HEADER_VALUE: headerValue } : {}),
    ...(key ? { OPENAI_API_KEY: key } : {}),
  };
}

export interface GeminiProfileInput {
  authMode?: "api-key" | "access-token" | "adc";
  apiKey?: string | null;
  accessToken?: string | null;
  model?: string | null;
  baseUrl?: string | null;
}

/** Profile Gemini. api-key exige chave; access-token exige token; adc usa ADC local. */
export function buildGeminiProfileEnv(input: GeminiProfileInput): ProfileEnv | null {
  const authMode = input.authMode ?? "api-key";
  const key = sanitizeApiKey(input.apiKey);
  const token = sanitizeApiKey(input.accessToken);

  if (authMode === "api-key" && !key) return null;
  if (authMode === "access-token" && !token) return null;

  const env: ProfileEnv = {
    GEMINI_AUTH_MODE: authMode,
    GEMINI_MODEL: sanitizeValue(input.model) || DEFAULT_GEMINI_MODEL,
    GEMINI_BASE_URL: sanitizeValue(input.baseUrl) || DEFAULT_GEMINI_BASE_URL,
  };
  if (authMode === "api-key" && key) env.GEMINI_API_KEY = key;
  if (authMode === "access-token" && token) env.GEMINI_ACCESS_TOKEN = token;
  return env;
}

export interface MistralProfileInput {
  apiKey?: string | null;
  model?: string | null;
  baseUrl?: string | null;
}

/** Profile Mistral. Exige apiKey. */
export function buildMistralProfileEnv(input: MistralProfileInput): ProfileEnv | null {
  const key = sanitizeApiKey(input.apiKey);
  if (!key) return null;
  const env: ProfileEnv = {
    MISTRAL_API_KEY: key,
    MISTRAL_MODEL: sanitizeValue(input.model) || DEFAULT_MISTRAL_MODEL,
  };
  const baseUrl = sanitizeValue(input.baseUrl);
  if (baseUrl) env.MISTRAL_BASE_URL = baseUrl;
  return env;
}

export interface OllamaProfileInput {
  baseUrl?: string | null;
  model: string;
}

/** Profile Ollama (OpenAI-compatível apontando pro daemon local). Exige model. */
export function buildOllamaProfileEnv(input: OllamaProfileInput): ProfileEnv | null {
  const model = sanitizeValue(input.model);
  if (!model) return null;
  return {
    OPENAI_BASE_URL: sanitizeValue(input.baseUrl) || DEFAULT_OLLAMA_BASE_URL,
    OPENAI_MODEL: model,
  };
}

export interface CodexProfileInput {
  apiKey?: string | null;
  accountId?: string | null;
  model?: string | null;
  baseUrl?: string | null;
  credentialSource?: "oauth" | "existing";
}

/** Profile Codex com credenciais existentes (CODEX_API_KEY + account id). */
export function buildCodexProfileEnv(input: CodexProfileInput): ProfileEnv | null {
  const key = sanitizeApiKey(input.apiKey);
  const accountId = sanitizeValue(input.accountId);
  if (!key || !accountId) return null;
  return {
    OPENAI_BASE_URL: sanitizeValue(input.baseUrl) || DEFAULT_CODEX_BASE_URL,
    OPENAI_MODEL: sanitizeValue(input.model) || "codexplan",
    CODEX_API_KEY: key,
    CHATGPT_ACCOUNT_ID: accountId,
    CODEX_CREDENTIAL_SOURCE: input.credentialSource ?? "existing",
  };
}

export interface GithubProfileInput {
  model?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
}

/** Profile GitHub Models (OpenAI-compatível; token via OPENAI_API_KEY). */
export function buildGithubProfileEnv(input: GithubProfileInput): ProfileEnv | null {
  const key = sanitizeApiKey(input.apiKey);
  if (!key) return null;
  const env: ProfileEnv = {
    OPENAI_MODEL: sanitizeValue(input.model) || "github:copilot",
    OPENAI_API_KEY: key,
  };
  const baseUrl = sanitizeValue(input.baseUrl);
  if (baseUrl) env.OPENAI_BASE_URL = baseUrl;
  return env;
}
