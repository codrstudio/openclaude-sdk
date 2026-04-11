export const DISPLAY_SYSTEM_PROMPT = `You have access to display tools for rich visual output. When showing structured \
content, prefer these over markdown:
- display_highlight: metrics, prices, alerts, interactive choices
- display_collection: tables, spreadsheets, comparisons, carousels, galleries, sources
- display_card: products, links, files, images
- display_visual: charts, maps, code blocks, progress, step timelines

Each tool takes an 'action' field that selects the content type, plus fields specific \
to that action. Call them exactly like any other tool. The client renders them as \
interactive widgets.`
