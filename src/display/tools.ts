import { z } from "zod"
import { tool } from "../mcp.js"
import type { SdkMcpToolDefinition } from "../mcp.js"
import {
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
} from "./schemas.js"

// display_highlight: metric, price, alert, choices
const highlightSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("metric"), ...DisplayMetricSchema.shape }),
  z.object({ action: z.literal("price"), ...DisplayPriceSchema.shape }),
  z.object({ action: z.literal("alert"), ...DisplayAlertSchema.shape }),
  z.object({ action: z.literal("choices"), ...DisplayChoicesSchema.shape }),
])

// display_collection: table, spreadsheet, comparison, carousel, gallery, sources
const collectionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("table"), ...DisplayTableSchema.shape }),
  z.object({ action: z.literal("spreadsheet"), ...DisplaySpreadsheetSchema.shape }),
  z.object({ action: z.literal("comparison"), ...DisplayComparisonSchema.shape }),
  z.object({ action: z.literal("carousel"), ...DisplayCarouselSchema.shape }),
  z.object({ action: z.literal("gallery"), ...DisplayGallerySchema.shape }),
  z.object({ action: z.literal("sources"), ...DisplaySourcesSchema.shape }),
])

// display_card: product, link, file, image
const cardSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("product"), ...DisplayProductSchema.shape }),
  z.object({ action: z.literal("link"), ...DisplayLinkSchema.shape }),
  z.object({ action: z.literal("file"), ...DisplayFileSchema.shape }),
  z.object({ action: z.literal("image"), ...DisplayImageSchema.shape }),
])

// display_visual: chart, map, code, progress, steps
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDisplayTools(): Array<SdkMcpToolDefinition<any>> {
  return [
    tool(
      "display_highlight",
      [
        "Destaca informacao importante na resposta.",
        "Actions: metric (KPI com valor e tendencia), price (preco em destaque),",
        "alert (banner info/warning/error/success), choices (opcoes clicaveis para o usuario).",
      ].join(" "),
      highlightSchema,
      async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }),
    ),

    tool(
      "display_collection",
      [
        "Apresenta colecao de itens organizados.",
        "Actions: table (tabela rica com colunas tipadas), spreadsheet (planilha exportavel),",
        "comparison (itens lado a lado), carousel (cards horizontais navegaveis),",
        "gallery (grid de imagens), sources (lista de fontes consultadas).",
      ].join(" "),
      collectionSchema,
      async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }),
    ),

    tool(
      "display_card",
      [
        "Apresenta item individual com detalhes visuais.",
        "Actions: product (card com imagem, preco, rating, badges),",
        "link (preview de URL com OG image), file (card de arquivo para download),",
        "image (imagem unica com caption e zoom).",
      ].join(" "),
      cardSchema,
      async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }),
    ),

    tool(
      "display_visual",
      [
        "Visualizacao especializada de dados ou fluxos.",
        "Actions: chart (grafico bar/line/pie/area/donut), map (mapa com pins),",
        "code (bloco com syntax highlighting), progress (barra de progresso com etapas),",
        "steps (timeline/checklist de etapas).",
      ].join(" "),
      visualSchema,
      async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }),
    ),
  ]
}
