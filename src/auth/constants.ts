// ---------------------------------------------------------------------------
// auth/constants.ts — configuração OAuth pública da Anthropic (claude.ai).
//
// Espelha os valores do CLI openclaude (`src/constants/oauth.ts`). São públicos:
// CLIENT_ID e URLs do fluxo OAuth do Claude Code, não são segredo. O segredo é
// o PKCE code_verifier (efêmero, por tentativa) e os tokens resultantes — esses
// nunca vivem aqui.
//
// Permite override por env para FedStart/staging, igual ao CLI.
// ---------------------------------------------------------------------------

export const CLAUDE_AI_PROFILE_SCOPE = "user:profile" as const;
export const CLAUDE_AI_INFERENCE_SCOPE = "user:inference" as const;
const CONSOLE_SCOPE = "org:create_api_key" as const;

/** Header beta exigido pelos endpoints OAuth do Claude Code. */
export const OAUTH_BETA_HEADER = "oauth-2025-04-20" as const;

/**
 * União de todos os escopos, na ordem do CLI (Console primeiro, depois claude.ai),
 * deduplicada. Pedir tudo no authorize cobre o redirect Console→claude.ai.
 * `user:inference` é o que habilita inferência no plano Pro/Max.
 */
export const ALL_OAUTH_SCOPES: readonly string[] = Array.from(
  new Set([
    CONSOLE_SCOPE,
    CLAUDE_AI_PROFILE_SCOPE,
    CLAUDE_AI_PROFILE_SCOPE,
    CLAUDE_AI_INFERENCE_SCOPE,
    "user:sessions:claude_code",
    "user:mcp_servers",
    "user:file_upload",
  ]),
);

/** Escopos persistidos no refresh (claude.ai), sem o escopo de Console. */
export const CLAUDE_AI_OAUTH_SCOPES: readonly string[] = [
  CLAUDE_AI_PROFILE_SCOPE,
  CLAUDE_AI_INFERENCE_SCOPE,
  "user:sessions:claude_code",
  "user:mcp_servers",
  "user:file_upload",
];

export interface OAuthEndpoints {
  clientId: string;
  /** Authorize claude.ai (assinantes Pro/Max/Team). Passa por claude.com/cai. */
  authorizeUrl: string;
  /** Authorize Console (billing por API). */
  consoleAuthorizeUrl: string;
  tokenUrl: string;
  /** redirect_uri do fluxo manual (contracódigo). A página exibe `code#state`. */
  manualRedirectUrl: string;
}

const PROD: OAuthEndpoints = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.com/cai/oauth/authorize",
  consoleAuthorizeUrl: "https://platform.claude.com/oauth/authorize",
  tokenUrl: "https://platform.claude.com/v1/oauth/token",
  manualRedirectUrl: "https://platform.claude.com/oauth/code/callback",
};

/**
 * Endpoints OAuth efetivos. `CLAUDE_CODE_OAUTH_CLIENT_ID` permite trocar o
 * client_id (ex.: integrações). Mantemos só prod aqui — staging/FedStart ficam
 * no CLI; o engine usa prod.
 */
export function getOAuthEndpoints(): OAuthEndpoints {
  const clientId = process.env.CLAUDE_CODE_OAUTH_CLIENT_ID || PROD.clientId;
  return { ...PROD, clientId };
}
