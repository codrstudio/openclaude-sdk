// ---------------------------------------------------------------------------
// provider — profiles de provider (OpenAI-compat, Gemini, Mistral, Ollama,
// Codex, GitHub) que o hammer lê no startup via `.hammer-profile.json`.
//
// Reimplementa, standalone, o `/provider` do CLI: grava o profile, e o hammer
// deriva o flag de compatibilidade do campo `profile` e aplica o `env`.
// O Anthropic OAuth (`/login`) vive em `../auth`.
// ---------------------------------------------------------------------------

export {
  PROFILE_FILE_NAME,
  writeProfile,
  readProfile,
  clearProfile,
  getProviderStatus,
  type ProviderProfile,
  type ProfileEnv,
  type ProfileFile,
  type ProviderStatus,
} from "./profile.js";

export {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MISTRAL_BASE_URL,
  DEFAULT_MISTRAL_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  sanitizeApiKey,
  sanitizeValue,
  buildOpenAIProfileEnv,
  buildGeminiProfileEnv,
  buildMistralProfileEnv,
  buildOllamaProfileEnv,
  buildCodexProfileEnv,
  buildGithubProfileEnv,
  type OpenAIProfileInput,
  type GeminiProfileInput,
  type MistralProfileInput,
  type OllamaProfileInput,
  type CodexProfileInput,
  type GithubProfileInput,
} from "./builders.js";

export {
  PROVIDER_CATALOG,
  getCatalogEntry,
  type ProviderKind,
  type CatalogField,
  type CatalogOAuthMode,
  type CatalogEntry,
} from "./catalog.js";

export { saveProvider, ProviderValidationError, type ProviderFields } from "./save.js";

export { probeOllama, type OllamaModel, type OllamaProbe } from "./ollama.js";
