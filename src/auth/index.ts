// ---------------------------------------------------------------------------
// auth — autenticação Anthropic (claude.ai Pro/Max + Console) standalone.
//
// Reimplementa o fluxo do `/login` do Claude Code SEM depender do CLI openclaude
// nem de listener em localhost: só o fluxo MANUAL (contracódigo), que funciona
// headless (servidor) e dirigido por web UI.
//
// Camadas:
//   - startLogin()          → URL pro browser + {state, codeVerifier} efêmeros
//   - exchangeManualCode()  → contracódigo `code#state` → tokens
//   - refreshTokens()       → renova via refresh token
//   - saveCredentials()/getAuthStatus()/logout() → .credentials.json (formato CLI)
//
// Conveniências de alto nível pro backend (ex.: agent-engine):
//   - completeLogin()    → troca + persiste numa tacada
//   - ensureFreshToken() → refresha se perto de expirar e repersiste
// ---------------------------------------------------------------------------

export {
  startLogin,
  exchangeManualCode,
  refreshTokens,
  type OAuthTokens,
  type LoginFlow,
  type StartLoginOptions,
} from "./oauth.js";

export {
  saveCredentials,
  readCredentials,
  getAuthStatus,
  logout,
  resolveConfigDir,
  type StoredOAuth,
  type AuthStatus,
} from "./store.js";

export {
  ALL_OAUTH_SCOPES,
  CLAUDE_AI_OAUTH_SCOPES,
  CLAUDE_AI_INFERENCE_SCOPE,
  getOAuthEndpoints,
  type OAuthEndpoints,
} from "./constants.js";

import { exchangeManualCode, refreshTokens, type LoginFlow, type OAuthTokens } from "./oauth.js";
import { getAuthStatus, readCredentials, saveCredentials, type AuthStatus } from "./store.js";

/**
 * Completa um login: troca o contracódigo por tokens e persiste no config dir.
 * Retorna o status resultante. O `flow` ({state, codeVerifier}) é o que o backend
 * guardou desde o `startLogin`.
 */
export async function completeLogin(
  pastedCode: string,
  flow: Pick<LoginFlow, "state" | "codeVerifier">,
  configDir?: string,
): Promise<AuthStatus> {
  const tokens = await exchangeManualCode(pastedCode, flow);
  saveCredentials(tokens, configDir);
  return getAuthStatus(configDir);
}

/**
 * Garante um access token válido. Se está perto de expirar (ou já expirou) e há
 * refresh token, renova e repersiste. Retorna os tokens correntes, ou null se
 * não há credencial / refresh falhou irrecuperavelmente.
 */
export async function ensureFreshToken(configDir?: string): Promise<OAuthTokens | null> {
  const stored = readCredentials(configDir);
  if (!stored?.accessToken) return null;

  const fresh = Date.now() < stored.expiresAt - 60_000;
  if (fresh) {
    return {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      expiresAt: stored.expiresAt,
      scopes: stored.scopes,
      subscriptionType: stored.subscriptionType,
      rateLimitTier: stored.rateLimitTier,
    };
  }
  if (!stored.refreshToken) return null;

  const renewed = await refreshTokens(stored.refreshToken, stored.scopes);
  // Preserva assinatura/tier que o refresh não devolve.
  renewed.subscriptionType = stored.subscriptionType ?? null;
  renewed.rateLimitTier = stored.rateLimitTier ?? null;
  saveCredentials(renewed, configDir);
  return renewed;
}
