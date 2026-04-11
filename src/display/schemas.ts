import { z } from "zod"

// --- Primitivos reutilizaveis (internos) ---

const MoneySchema = z.object({
  value: z.number(),
  currency: z.string().default("BRL"),
})

const SourceRefSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  favicon: z.string().url().optional(),
})

const ImageItemSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
})

const BadgeSchema = z.object({
  label: z.string(),
  variant: z.enum(["default", "success", "warning", "error", "info"]).default("default"),
})

// --- Display Tools ---

// 1. METRICAS E DADOS

export const DisplayMetricSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: z.object({
    direction: z.enum(["up", "down", "neutral"]),
    value: z.string(),
  }).optional(),
  icon: z.string().optional(),
})

export const DisplayChartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area", "donut"]),
  title: z.string(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
  format: z.object({
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    locale: z.string().default("pt-BR"),
  }).optional(),
})

export const DisplayTableSchema = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "number", "money", "image", "link", "badge"]).default("text"),
    align: z.enum(["left", "center", "right"]).default("left"),
  })),
  rows: z.array(z.record(z.string(), z.unknown())),
  sortable: z.boolean().default(false),
})

export const DisplayProgressSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    label: z.string(),
    status: z.enum(["completed", "current", "pending"]),
    description: z.string().optional(),
  })),
})

// 2. PRODUTOS E COMERCIO

export const DisplayProductSchema = z.object({
  title: z.string(),
  image: z.string().url().optional(),
  price: MoneySchema.optional(),
  originalPrice: MoneySchema.optional(),
  rating: z.object({
    score: z.number().min(0).max(5),
    count: z.number(),
  }).optional(),
  source: SourceRefSchema.optional(),
  badges: z.array(BadgeSchema).optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
})

export const DisplayComparisonSchema = z.object({
  title: z.string().optional(),
  items: z.array(DisplayProductSchema),
  attributes: z.array(z.object({
    key: z.string(),
    label: z.string(),
  })).optional(),
})

export const DisplayPriceSchema = z.object({
  value: MoneySchema,
  label: z.string(),
  context: z.string().optional(),
  source: SourceRefSchema.optional(),
  badge: BadgeSchema.optional(),
})

// 3. MIDIA

export const DisplayImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export const DisplayGallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(ImageItemSchema),
  layout: z.enum(["grid", "masonry"]).default("grid"),
  columns: z.number().min(2).max(5).default(3),
})

export const DisplayCarouselSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    image: z.string().url().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    price: MoneySchema.optional(),
    url: z.string().url().optional(),
    badges: z.array(BadgeSchema).optional(),
  })),
})

// 4. REFERENCIAS E NAVEGACAO

export const DisplaySourcesSchema = z.object({
  label: z.string().default("Fontes consultadas"),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    favicon: z.string().url().optional(),
    snippet: z.string().optional(),
  })),
})

export const DisplayLinkSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  favicon: z.string().url().optional(),
  domain: z.string().optional(),
})

export const DisplayMapSchema = z.object({
  title: z.string().optional(),
  pins: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
    address: z.string().optional(),
  })),
  zoom: z.number().min(1).max(20).default(14),
})

// 5. DOCUMENTOS E ARQUIVOS

export const DisplayFileSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().optional(),
  url: z.string().url().optional(),
  preview: z.string().optional(),
})

export const DisplayCodeSchema = z.object({
  language: z.string(),
  code: z.string(),
  title: z.string().optional(),
  lineNumbers: z.boolean().default(true),
})

export const DisplaySpreadsheetSchema = z.object({
  title: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  format: z.object({
    moneyColumns: z.array(z.number()).optional(),
    percentColumns: z.array(z.number()).optional(),
  }).optional(),
})

// 6. INTERATIVO

export const DisplayStepsSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["completed", "current", "pending"]).default("pending"),
  })),
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
})

export const DisplayAlertSchema = z.object({
  variant: z.enum(["info", "warning", "error", "success"]),
  title: z.string().optional(),
  message: z.string(),
  icon: z.string().optional(),
})

export const DisplayChoicesSchema = z.object({
  question: z.string().optional(),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  })),
  layout: z.enum(["buttons", "cards", "list"]).default("buttons"),
})

// 7. REACT RICO

export const DisplayReactSchema = z.object({
  // Schema version — permite evoluir sem quebrar clientes antigos
  version: z.literal("1"),

  // UI chrome
  title: z.string().optional()
    .describe("Titulo exibido acima do componente"),
  description: z.string().optional()
    .describe("Subtitulo ou contexto curto"),

  // Codigo-fonte ESM com exactly one default export
  code: z.string()
    .describe(
      "ES module source. Must contain exactly one " +
      "`export default function Component(props) { ... }`. " +
      "Max 8 KB."
    ),

  language: z.enum(["jsx", "tsx"]).default("jsx")
    .describe("Source language — determines transpiler preset"),

  entry: z.literal("default").default("default")
    .describe("Reserved for future expansion; always 'default' in v1"),

  // Dependencias explicitas — cliente valida contra whitelist
  imports: z.array(
    z.object({
      module: z.enum(["react", "framer-motion"]),
      symbols: z.array(z.string()).min(1),
    })
  ).describe(
    "Every import used in `code` must be declared here. " +
    "Mismatch with actual imports rejects the payload."
  ),

  // Dados iniciais passados como props (separado do code pra nao inflar JSX)
  initialProps: z.record(z.string(), z.unknown()).optional()
    .describe("Props passed to the component on mount. Max 32 KB serialized."),

  // Dimensionamento — iframe/container precisa saber o alvo
  layout: z.object({
    height: z.union([z.number(), z.literal("auto")]).optional()
      .describe("Height in px, or 'auto' for ResizeObserver-driven"),
    aspectRatio: z.string().optional()
      .describe("CSS aspect-ratio string, e.g. '16/9'"),
    maxWidth: z.number().optional()
      .describe("Max width in px; default: 100% of container"),
  }).optional(),

  // Preferencia visual — cliente decide se respeita
  theme: z.enum(["light", "dark", "auto"]).optional(),
})

// --- Registry (mapa nome → schema) ---

export const DisplayToolRegistry = {
  display_metric: DisplayMetricSchema,
  display_chart: DisplayChartSchema,
  display_table: DisplayTableSchema,
  display_progress: DisplayProgressSchema,
  display_product: DisplayProductSchema,
  display_comparison: DisplayComparisonSchema,
  display_price: DisplayPriceSchema,
  display_image: DisplayImageSchema,
  display_gallery: DisplayGallerySchema,
  display_carousel: DisplayCarouselSchema,
  display_sources: DisplaySourcesSchema,
  display_link: DisplayLinkSchema,
  display_map: DisplayMapSchema,
  display_file: DisplayFileSchema,
  display_code: DisplayCodeSchema,
  display_spreadsheet: DisplaySpreadsheetSchema,
  display_steps: DisplayStepsSchema,
  display_alert: DisplayAlertSchema,
  display_choices: DisplayChoicesSchema,
} as const

export type DisplayToolName = keyof typeof DisplayToolRegistry

// --- Tipos inferidos ---

export type DisplayMetric = z.infer<typeof DisplayMetricSchema>
export type DisplayChart = z.infer<typeof DisplayChartSchema>
export type DisplayTable = z.infer<typeof DisplayTableSchema>
export type DisplayProgress = z.infer<typeof DisplayProgressSchema>
export type DisplayProduct = z.infer<typeof DisplayProductSchema>
export type DisplayComparison = z.infer<typeof DisplayComparisonSchema>
export type DisplayPrice = z.infer<typeof DisplayPriceSchema>
export type DisplayImage = z.infer<typeof DisplayImageSchema>
export type DisplayGallery = z.infer<typeof DisplayGallerySchema>
export type DisplayCarousel = z.infer<typeof DisplayCarouselSchema>
export type DisplaySources = z.infer<typeof DisplaySourcesSchema>
export type DisplayLink = z.infer<typeof DisplayLinkSchema>
export type DisplayMap = z.infer<typeof DisplayMapSchema>
export type DisplayFile = z.infer<typeof DisplayFileSchema>
export type DisplayCode = z.infer<typeof DisplayCodeSchema>
export type DisplaySpreadsheet = z.infer<typeof DisplaySpreadsheetSchema>
export type DisplaySteps = z.infer<typeof DisplayStepsSchema>
export type DisplayAlert = z.infer<typeof DisplayAlertSchema>
export type DisplayChoices = z.infer<typeof DisplayChoicesSchema>
export type DisplayReact = z.infer<typeof DisplayReactSchema>
