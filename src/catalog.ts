// ---------------------------------------------------------------------------
// catalog.ts — entrypoint público BROWSER-SAFE do hammer-sdk.
//
// Reexporta apenas o catálogo de providers, os builders de ProfileEnv e os tipos
// — tudo dado estático / lógica pura, ZERO import de Node (fs/os/path/spawn).
//
// Por quê: o entry principal (`@codrstudio/hammer-sdk`) é um bundle único que
// inclui o código Node do SDK (sessão, store, OAuth). Importar `PROVIDER_CATALOG`
// dele arrastava `fs`/`os`/`path`/`child_process` pro bundle do browser e quebrava
// `vite build` (ex.: AuthConfig do hammer-chat numa SPA/host federado). Este
// subpath dá à UI só o que ela precisa, sem o lastro Node.
//
//   import { PROVIDER_CATALOG } from "@codrstudio/hammer-sdk/catalog";
//
// Mantém uma única fonte da verdade do catálogo (os mesmos módulos do entry
// principal), só que isolada num grafo sem Node.
// ---------------------------------------------------------------------------

export { PROVIDER_CATALOG, getCatalogEntry } from "./provider/catalog.js";
export type {
  ProviderKind,
  CatalogField,
  CatalogOAuthMode,
  CatalogEntry,
} from "./provider/catalog.js";

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
} from "./provider/builders.js";
export type {
  OpenAIProfileInput,
  GeminiProfileInput,
  MistralProfileInput,
  OllamaProfileInput,
  CodexProfileInput,
  GithubProfileInput,
} from "./provider/builders.js";

// Tipos puros (type-only → apagados no build, não puxam runtime de profile.ts).
export type { ProviderProfile, ProfileEnv } from "./provider/profile.js";
