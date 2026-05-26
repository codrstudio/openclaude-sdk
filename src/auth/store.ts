// ---------------------------------------------------------------------------
// auth/store.ts — persistência de credenciais no formato do openclaude.
//
// Grava `$CLAUDE_CONFIG_DIR/.credentials.json` → `{ claudeAiOauth: {...} }`,
// idêntico ao que o CLI lê (`utils/auth.ts:1238`, `:1344`). Assim a sessão
// headless spawnada pelo SDK reusa as credenciais e auto-refresha sozinha.
//
// Escrita atômica (temp+rename) e arquivo 0600 — contém tokens.
// ---------------------------------------------------------------------------

import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { OAuthTokens } from "./oauth.js";

/** Forma do bloco `claudeAiOauth` dentro do `.credentials.json`. */
export interface StoredOAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
}

interface CredentialsFile {
  claudeAiOauth?: StoredOAuth;
  [k: string]: unknown;
}

/** Diretório de config efetivo: `CLAUDE_CONFIG_DIR` ou `~/.claude`. */
export function resolveConfigDir(configDir?: string): string {
  return configDir || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

function credentialsPath(configDir?: string): string {
  return join(resolveConfigDir(configDir), ".credentials.json");
}

function readFile(configDir?: string): CredentialsFile {
  try {
    return JSON.parse(readFileSync(credentialsPath(configDir), "utf8")) as CredentialsFile;
  } catch {
    return {};
  }
}

function writeFileAtomic(configDir: string | undefined, data: CredentialsFile): void {
  const target = credentialsPath(configDir);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, target);
  try {
    chmodSync(target, 0o600);
  } catch {
    // Windows ignora; em POSIX garante 0600.
  }
}

/** Persiste os tokens, preservando qualquer outra chave já no arquivo. */
export function saveCredentials(tokens: OAuthTokens, configDir?: string): void {
  const file = readFile(configDir);
  const prev = file.claudeAiOauth;
  file.claudeAiOauth = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    // Não sobrescreve assinatura válida com null em refresh transitório.
    subscriptionType: tokens.subscriptionType ?? prev?.subscriptionType ?? null,
    rateLimitTier: tokens.rateLimitTier ?? prev?.rateLimitTier ?? null,
  };
  writeFileAtomic(configDir, file);
}

export function readCredentials(configDir?: string): StoredOAuth | null {
  return readFile(configDir).claudeAiOauth ?? null;
}

export interface AuthStatus {
  loggedIn: boolean;
  /** true se o access token já passou de `expiresAt` (margem de 60s). */
  expired: boolean;
  expiresAt?: number;
  scopes?: string[];
  subscriptionType?: string | null;
}

export function getAuthStatus(configDir?: string): AuthStatus {
  const c = readCredentials(configDir);
  if (!c?.accessToken) return { loggedIn: false, expired: true };
  return {
    loggedIn: true,
    expired: Date.now() >= c.expiresAt - 60_000,
    expiresAt: c.expiresAt,
    scopes: c.scopes,
    subscriptionType: c.subscriptionType ?? null,
  };
}

/** Remove só o bloco OAuth, preservando o resto do arquivo. */
export function logout(configDir?: string): void {
  const file = readFile(configDir);
  if (!file.claudeAiOauth) return;
  delete file.claudeAiOauth;
  if (Object.keys(file).length === 0) {
    try {
      rmSync(credentialsPath(configDir));
    } catch {
      /* noop */
    }
    return;
  }
  writeFileAtomic(configDir, file);
}
