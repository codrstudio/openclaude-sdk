// ---------------------------------------------------------------------------
// auth/oauth.ts — o dance OAuth 2.0 + PKCE (fluxo manual / contracódigo).
//
// Reimplementa, em TS puro, o que o CLI openclaude faz em
// `services/oauth/client.ts` — mas sem listener em localhost: só o fluxo MANUAL,
// que é o único que funciona headless/remoto (servidor) e por web UI.
//
// Não toca no openclaude. Usa `fetch` global (Node ≥ 20).
// ---------------------------------------------------------------------------

import { getOAuthEndpoints, ALL_OAUTH_SCOPES, CLAUDE_AI_OAUTH_SCOPES, OAUTH_BETA_HEADER } from "./constants.js";
import { generateCodeChallenge, generateCodeVerifier, generateState } from "./pkce.js";

/** Tokens normalizados (camelCase) prontos pra persistir. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms de expiração do access token. */
  expiresAt: number;
  scopes: string[];
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
}

/** Material efêmero de um fluxo de login. `state`+`codeVerifier` ficam server-side. */
export interface LoginFlow {
  /** URL que o usuário abre no browser pra logar (mostra o contracódigo no fim). */
  authorizeUrl: string;
  /** Anti-CSRF — confira contra o `state` colado no contracódigo. */
  state: string;
  /** Segredo PKCE — guarde server-side; nunca exponha ao browser. */
  codeVerifier: string;
}

export interface StartLoginOptions {
  /** true (default) = claude.ai (Pro/Max); false = Console (billing por API). */
  claudeAi?: boolean;
  /** Pré-popula o email no formulário de login. */
  loginHint?: string;
  /** Força método (ex.: 'sso'). */
  loginMethod?: string;
  /** Restringe a uma org. */
  orgUUID?: string;
}

/**
 * Inicia um login manual. Devolve a URL pro browser + o material efêmero
 * (state, codeVerifier) que o caller guarda até o `exchangeManualCode`.
 */
export function startLogin(options: StartLoginOptions = {}): LoginFlow {
  const { claudeAi = true, loginHint, loginMethod, orgUUID } = options;
  const ep = getOAuthEndpoints();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const url = new URL(claudeAi ? ep.authorizeUrl : ep.consoleAuthorizeUrl);
  url.searchParams.append("code", "true"); // sinaliza upsell do Claude Max na página
  url.searchParams.append("client_id", ep.clientId);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("redirect_uri", ep.manualRedirectUrl);
  url.searchParams.append("scope", ALL_OAUTH_SCOPES.join(" "));
  url.searchParams.append("code_challenge", codeChallenge);
  url.searchParams.append("code_challenge_method", "S256");
  url.searchParams.append("state", state);
  if (orgUUID) url.searchParams.append("orgUUID", orgUUID);
  if (loginHint) url.searchParams.append("login_hint", loginHint);
  if (loginMethod) url.searchParams.append("login_method", loginMethod);

  return { authorizeUrl: url.toString(), state, codeVerifier };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  account?: { uuid?: string; email_address?: string; organization_uuid?: string };
}

function parseScopes(scope?: string): string[] {
  return scope ? scope.split(" ").filter(Boolean) : [];
}

function toTokens(data: TokenResponse, prevRefresh?: string): OAuthTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? prevRefresh ?? "",
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: parseScopes(data.scope),
  };
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const ep = getOAuthEndpoints();
  const res = await fetch(ep.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-beta": OAUTH_BETA_HEADER },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      res.status === 401
        ? "Autenticação falhou: código de autorização inválido ou expirado."
        : `Troca de token falhou (${res.status}): ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Troca o contracódigo colado pelo usuário por tokens. O valor colado vem no
 * formato `authorizationCode#state` (igual ao CLI, `ConsoleOAuthFlow.tsx:179`).
 * Valida o `state` contra o que foi emitido no `startLogin`.
 */
export async function exchangeManualCode(
  pastedCode: string,
  flow: Pick<LoginFlow, "state" | "codeVerifier">,
): Promise<OAuthTokens> {
  const [code, returnedState] = pastedCode.trim().split("#");
  if (!code) throw new Error("Contracódigo vazio.");
  if (returnedState && flow.state && returnedState !== flow.state) {
    throw new Error("State não confere (possível CSRF). Reinicie o login.");
  }
  const ep = getOAuthEndpoints();
  const data = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: ep.manualRedirectUrl,
    client_id: ep.clientId,
    code_verifier: flow.codeVerifier,
    state: returnedState ?? flow.state,
  });
  return toTokens(data);
}

/** Renova o access token a partir do refresh token. */
export async function refreshTokens(refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
  const ep = getOAuthEndpoints();
  const data = await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: ep.clientId,
    scope: (scopes?.length ? scopes : CLAUDE_AI_OAUTH_SCOPES).join(" "),
  });
  return toTokens(data, refreshToken);
}
