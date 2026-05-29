// ---------------------------------------------------------------------------
// provider/save.ts — dispatcher: id do catálogo + campos → profile gravado.
//
// Aplica os defaults do catálogo, chama o builder do profile correspondente e
// persiste. Ponto único que o backend chama para "salvar provider X".
// ---------------------------------------------------------------------------

import {
  buildCodexProfileEnv,
  buildGeminiProfileEnv,
  buildGithubProfileEnv,
  buildMistralProfileEnv,
  buildOllamaProfileEnv,
  buildOpenAIProfileEnv,
} from "./builders.js";
import { getCatalogEntry } from "./catalog.js";
import { getProviderStatus, writeProfile, type ProfileEnv, type ProviderStatus } from "./profile.js";

export type ProviderFields = Record<string, string | undefined>;

/** Erro de validação de campos de provider (campo obrigatório ausente/ inválido). */
export class ProviderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderValidationError";
  }
}

/** Aplica os defaults do catálogo aos campos vindos do formulário. */
function withCatalogDefaults(id: string, fields: ProviderFields): ProviderFields {
  const entry = getCatalogEntry(id);
  if (!entry) return fields;
  const merged: ProviderFields = { ...fields };
  for (const field of entry.fields) {
    const current = merged[field.key]?.trim();
    if (!current && field.default) merged[field.key] = field.default;
  }
  return merged;
}

/**
 * Salva o profile do provider `id` com os `fields` do formulário.
 * Lança ProviderValidationError se faltar campo obrigatório.
 */
export function saveProvider(id: string, fields: ProviderFields, configDir?: string): ProviderStatus {
  const entry = getCatalogEntry(id);
  if (!entry) throw new ProviderValidationError(`Provider desconhecido: ${id}`);
  if (entry.kind === "oauth") {
    throw new ProviderValidationError(`"${id}" usa fluxo OAuth — use o login, não saveProvider.`);
  }

  const f = withCatalogDefaults(id, fields);
  let env: ProfileEnv | null = null;

  switch (entry.profile) {
    case "openai":
      env = buildOpenAIProfileEnv({ apiKey: f.apiKey, baseUrl: f.baseUrl, model: f.model ?? "" });
      break;
    case "gemini":
      env = buildGeminiProfileEnv({
        authMode: (f.authMode as "api-key" | "access-token" | "adc" | undefined) ?? "api-key",
        apiKey: f.apiKey,
        accessToken: f.accessToken,
        model: f.model,
        baseUrl: f.baseUrl,
      });
      break;
    case "mistral":
      env = buildMistralProfileEnv({ apiKey: f.apiKey, model: f.model, baseUrl: f.baseUrl });
      break;
    case "ollama":
      env = buildOllamaProfileEnv({ baseUrl: f.baseUrl, model: f.model ?? "" });
      break;
    case "codex":
      env = buildCodexProfileEnv({
        apiKey: f.apiKey,
        accountId: f.accountId,
        model: f.model,
        baseUrl: f.baseUrl,
        credentialSource: "existing",
      });
      break;
    case "github":
      env = buildGithubProfileEnv({ apiKey: f.apiKey, model: f.model, baseUrl: f.baseUrl });
      break;
    default:
      throw new ProviderValidationError(`Profile não suportado: ${entry.profile}`);
  }

  if (!env) {
    const required = entry.fields
      .filter((field) => field.required)
      .map((field) => field.label)
      .join(", ");
    throw new ProviderValidationError(
      required ? `Campos obrigatórios faltando ou inválidos: ${required}.` : "Credencial inválida.",
    );
  }

  writeProfile(entry.profile, env, configDir);
  return getProviderStatus(configDir);
}
