// ---------------------------------------------------------------------------
// Provider/Model Registry Types
// ---------------------------------------------------------------------------

export interface Provider {
  id: string
  name: string
  type: "openai" | "gemini" | "github" | "bedrock" | "vertex"
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
