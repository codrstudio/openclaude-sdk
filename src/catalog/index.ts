// ---------------------------------------------------------------------------
// Catalog — public API
// ---------------------------------------------------------------------------

export { BUILTIN_CATALOG } from "./data.js"
export {
  CatalogSchema,
  CatalogProviderSchema,
  CatalogModelSchema,
  ProviderTypeSchema,
} from "./schema.js"
export type { CatalogInput } from "./schema.js"

import { CatalogSchema } from "./schema.js"
import { BUILTIN_CATALOG } from "./data.js"
import type {
  Catalog,
  CatalogProvider,
  Provider,
  Model,
  ProviderRegistry,
} from "../types/provider.js"

// ---------------------------------------------------------------------------
// validateCatalog — Zod parse (throws ZodError on invalid input)
// ---------------------------------------------------------------------------

export function validateCatalog(data: unknown): Catalog {
  return CatalogSchema.parse(data) as Catalog
}

// ---------------------------------------------------------------------------
// createRegistryFromCatalog — builds a ProviderRegistry from a Catalog
// ---------------------------------------------------------------------------

export interface CreateRegistryOptions {
  /** Catalog to use. Defaults to BUILTIN_CATALOG. */
  catalog?: Catalog
  /** API keys keyed by provider id (e.g. { openrouter: "sk-or-..." }). */
  apiKeys?: Record<string, string>
  /** Override catalog's defaultModel. */
  defaultModel?: string
}

export function createRegistryFromCatalog(
  options: CreateRegistryOptions = {},
): ProviderRegistry {
  const catalog = options.catalog ?? BUILTIN_CATALOG
  const apiKeys = options.apiKeys ?? {}

  const providers: Provider[] = catalog.providers.map(
    (cp: CatalogProvider): Provider => ({
      id: cp.id,
      name: cp.name,
      type: cp.type,
      baseUrl: cp.baseUrl,
      apiKey: apiKeys[cp.id],
    }),
  )

  const models: Model[] = catalog.models.map((cm) => ({
    id: cm.id,
    label: cm.label,
    provider: cm.provider,
    contextWindow: cm.contextWindow,
    supportsVision: cm.supportsVision,
  }))

  return {
    providers,
    models,
    defaultModel: options.defaultModel ?? catalog.defaultModel,
  }
}
