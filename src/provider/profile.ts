// ---------------------------------------------------------------------------
// provider/profile.ts — persistência do profile de provider que o hammer lê.
//
// Reimplementa, em TS puro e standalone, o formato do `/provider` do hammer
// (`src/utils/providerProfile.ts`). Grava `$CLAUDE_CONFIG_DIR/.hammer-profile.json`
// no formato `{ profile, env, createdAt }`. No startup o CLI lê esse arquivo,
// deriva o flag de compatibilidade (`CLAUDE_CODE_USE_*`) a partir do campo
// `profile` e aplica `env` — então aqui basta gravar `{ profile, env }`.
//
// Escrita atômica (temp+rename), arquivo 0600 — o `env` carrega API keys.
// ---------------------------------------------------------------------------

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveConfigDir } from "../auth/store.js";

export const PROFILE_FILE_NAME = ".hammer-profile.json";

/** Provider persistido. Espelha o subconjunto do hammer que o SDK reimplementa. */
export type ProviderProfile =
  | "anthropic"
  | "openai"
  | "gemini"
  | "mistral"
  | "ollama"
  | "codex"
  | "github";

/** Mapa de env que o CLI aplica no startup. Só as chaves que o SDK escreve. */
export interface ProfileEnv {
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_FORMAT?: "chat_completions" | "responses";
  OPENAI_AUTH_HEADER?: string;
  OPENAI_AUTH_SCHEME?: "bearer" | "raw";
  OPENAI_AUTH_HEADER_VALUE?: string;
  OPENAI_API_KEY?: string;
  CODEX_API_KEY?: string;
  CODEX_CREDENTIAL_SOURCE?: "oauth" | "existing";
  CHATGPT_ACCOUNT_ID?: string;
  CODEX_ACCOUNT_ID?: string;
  GEMINI_API_KEY?: string;
  GEMINI_AUTH_MODE?: "api-key" | "access-token" | "adc";
  GEMINI_ACCESS_TOKEN?: string;
  GEMINI_MODEL?: string;
  GEMINI_BASE_URL?: string;
  MISTRAL_BASE_URL?: string;
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string;
}

/** Arquivo persistido em `.hammer-profile.json`. */
export interface ProfileFile {
  profile: ProviderProfile;
  env: ProfileEnv;
  createdAt: string;
}

/** Status público do provider ativo — NUNCA expõe valores de secret. */
export interface ProviderStatus {
  active: boolean;
  provider?: ProviderProfile;
  model?: string;
  baseUrl?: string;
  /** Modo de auth do Gemini, quando aplicável. */
  authMode?: ProfileEnv["GEMINI_AUTH_MODE"];
  /** Origem da credencial Codex, quando aplicável. */
  credentialSource?: ProfileEnv["CODEX_CREDENTIAL_SOURCE"];
}

function profilePath(configDir?: string): string {
  return join(resolveConfigDir(configDir), PROFILE_FILE_NAME);
}

function isProviderProfile(value: unknown): value is ProviderProfile {
  return (
    value === "anthropic" ||
    value === "openai" ||
    value === "gemini" ||
    value === "mistral" ||
    value === "ollama" ||
    value === "codex" ||
    value === "github"
  );
}

/** Grava `{ profile, env, createdAt }` de forma atômica, com 0600. */
export function writeProfile(profile: ProviderProfile, env: ProfileEnv, configDir?: string): ProfileFile {
  const file: ProfileFile = { profile, env, createdAt: new Date().toISOString() };
  const target = profilePath(configDir);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2), { mode: 0o600 });
  renameSync(tmp, target);
  try {
    chmodSync(target, 0o600);
  } catch {
    // Windows ignora; em POSIX garante 0600.
  }
  return file;
}

/** Lê o profile persistido, ou null se ausente/inválido. */
export function readProfile(configDir?: string): ProfileFile | null {
  const target = profilePath(configDir);
  if (!existsSync(target)) return null;
  try {
    const parsed = JSON.parse(readFileSync(target, "utf8")) as Partial<ProfileFile>;
    if (!isProviderProfile(parsed.profile) || !parsed.env || typeof parsed.env !== "object") {
      return null;
    }
    return {
      profile: parsed.profile,
      env: parsed.env,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Remove o profile (volta ao startup normal / Anthropic). */
export function clearProfile(configDir?: string): void {
  const target = profilePath(configDir);
  try {
    rmSync(target, { force: true });
  } catch {
    /* noop */
  }
}

/** Status público do provider ativo — derivado do profile, sem secrets. */
export function getProviderStatus(configDir?: string): ProviderStatus {
  const file = readProfile(configDir);
  if (!file) return { active: false };
  return {
    active: true,
    provider: file.profile,
    model: file.env.OPENAI_MODEL ?? file.env.GEMINI_MODEL ?? file.env.MISTRAL_MODEL ?? file.env.ANTHROPIC_MODEL,
    baseUrl:
      file.env.OPENAI_BASE_URL ??
      file.env.GEMINI_BASE_URL ??
      file.env.MISTRAL_BASE_URL ??
      file.env.ANTHROPIC_BASE_URL,
    authMode: file.env.GEMINI_AUTH_MODE,
    credentialSource: file.env.CODEX_CREDENTIAL_SOURCE,
  };
}
