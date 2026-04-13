// ---------------------------------------------------------------------------
// Catalog Zod Schemas — validates catalog structure at boundaries
// ---------------------------------------------------------------------------

import { z } from "zod"

export const ProviderTypeSchema = z.enum([
  "anthropic",
  "openai",
  "gemini",
  "github",
  "bedrock",
  "vertex",
  "ollama",
])

export const CatalogProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: ProviderTypeSchema,
  baseUrl: z.string().url().optional(),
})

export const CatalogModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  contextWindow: z.number().int().positive().optional(),
  supportsVision: z.boolean().optional(),
})

export const CatalogSchema = z.object({
  providers: z.array(CatalogProviderSchema).min(1),
  models: z.array(CatalogModelSchema),
  defaultModel: z.string().min(1),
})

export type CatalogInput = z.input<typeof CatalogSchema>
