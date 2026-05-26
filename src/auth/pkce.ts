// ---------------------------------------------------------------------------
// auth/pkce.ts — PKCE (RFC 7636) + state, via node:crypto.
//
// O code_verifier é segredo de curta vida: gerado no início do fluxo, guardado
// server-side (nunca vai pro browser) e usado uma vez na troca do código.
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";

/** base64url sem padding (RFC 7636 §A). */
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** code_verifier: 32 bytes aleatórios em base64url (~43 chars). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** code_challenge = base64url(SHA-256(code_verifier)). Método S256. */
export function generateCodeChallenge(codeVerifier: string): string {
  return base64url(createHash("sha256").update(codeVerifier).digest());
}

/** state anti-CSRF: 32 bytes aleatórios em base64url. */
export function generateState(): string {
  return base64url(randomBytes(32));
}
