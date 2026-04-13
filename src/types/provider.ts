// ---------------------------------------------------------------------------
// Provider/Model Registry Types
// ---------------------------------------------------------------------------

export type ProviderType =
  | "anthropic"
  | "openai"
  | "gemini"
  | "github"
  | "bedrock"
  | "vertex"
  | "ollama"

export interface Provider {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
  apiKey?: string
}

export interface Model {
  id: string
  label: string
  provider: string // Provider.id
  contextWindow?: number
  supportsVision?: boolean
}

export interface ProviderRegistry {
  providers: Provider[]
  models: Model[]
  defaultModel: string
}

// ---------------------------------------------------------------------------
// Catalog — curated providers + models (static, no secrets)
// ---------------------------------------------------------------------------

export interface CatalogProvider {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
}

export interface CatalogModel {
  id: string
  label: string
  provider: string // CatalogProvider.id
  contextWindow?: number
  supportsVision?: boolean
}

export interface Catalog {
  providers: CatalogProvider[]
  models: CatalogModel[]
  defaultModel: string
}
