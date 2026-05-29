// ---------------------------------------------------------------------------
// provider/ollama.ts — descoberta real (best-effort) de modelos Ollama.
//
// Consulta o daemon local. Se inalcançável, devolve lista vazia (sem throw):
// a UI cai pro input manual de modelo. Não é mock — só tolerante a daemon off.
// ---------------------------------------------------------------------------

import { DEFAULT_OLLAMA_BASE_URL } from "./builders.js";

export interface OllamaModel {
  name: string;
  /** Tamanho em bytes, quando reportado pelo daemon. */
  size?: number;
}

export interface OllamaProbe {
  reachable: boolean;
  baseUrl: string;
  models: OllamaModel[];
  /** Mensagem de erro quando inalcançável. */
  error?: string;
}

/** Normaliza a base URL (`/v1` é p/ o shim OpenAI; a API de tags é na raiz). */
function toTagsUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  return `${root}/api/tags`;
}

/** Lista os modelos instalados no Ollama local. Tolerante a daemon off. */
export async function probeOllama(baseUrl?: string): Promise<OllamaProbe> {
  const resolved = baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL;
  const url = toTagsUrl(resolved);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { reachable: false, baseUrl: resolved, models: [], error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: Array<{ name?: string; size?: number }> };
    const models: OllamaModel[] = (data.models ?? [])
      .filter((m): m is { name: string; size?: number } => typeof m.name === "string")
      .map((m) => ({ name: m.name, size: m.size }));
    return { reachable: true, baseUrl: resolved, models };
  } catch (error) {
    return {
      reachable: false,
      baseUrl: resolved,
      models: [],
      error: error instanceof Error ? error.message : "inalcançável",
    };
  }
}
