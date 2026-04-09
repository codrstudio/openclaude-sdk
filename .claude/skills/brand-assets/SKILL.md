---
name: brand-assets
description: Inventario e pipeline de brand assets — SVGs fonte, derivacao de PNGs/ICO, publicacao em apps. Use quando criar ou modificar assets de marca, favicons, icones PWA.
---

# Brand Assets — Inventario e Pipeline

Referencia de todos os assets visuais derivados do brand.

## Fonte (Brand Slots)

12 SVGs organizados em `data/brand/` (dark + light):

| Nome base | Dark | Light | Uso |
|-----------|------|-------|-----|
| Icon | `icon-dark.svg` | `icon-light.svg` | Fonte para derivacao de PNGs externos |
| Logo | `logo-dark.svg` | `logo-light.svg` | Logo compacto (sidebar collapsed) |
| Logo H | `logo-h-dark.svg` | `logo-h-light.svg` | Header horizontal (sidebar, dashboard) |
| Logo V | `logo-v-dark.svg` | `logo-v-light.svg` | Logo vertical (login) |
| Creative H | `creative-h-dark.svg` | `creative-h-light.svg` | Banner horizontal |
| Creative V | `creative-v-dark.svg` | `creative-v-light.svg` | Banner vertical |

Servidos via API: `GET /api/v1/borracharia/config/brand/svg/:slot`

## Assets Externos (1 set — nao varia por tema)

Derivados de `icon-dark` ou `icon-light` (operador escolhe). Gerados em `data/brand/derived/`, copiados para `public/` de cada app.

| Asset | Tamanho |
|-------|---------|
| `favicon.ico` | 32x32 |
| `favicon-16x16.png` | 16x16 |
| `favicon-32x32.png` | 32x32 |
| `apple-touch-icon.png` | 180x180 |
| `icon-72.png` a `icon-512.png` | 72, 96, 128, 144, 152, 192, 384, 512 |
| `maskable-192.png` | 192x192 |
| `maskable-512.png` | 512x512 |

**Total:** 14 assets x N apps

### Specs de geracao

- **PWA icons:** sharp resize direto do SVG
- **Maskable:** 10% safe zone padding, fundo `#111827`, sharp composite
- **favicon.ico:** 32x32 PNG salvo como .ico
- **apple-touch-icon:** 180x180 PNG

## Assets In-App (2 sets — dark E light)

Servidos dinamicamente via API. O frontend seleciona dark/light conforme o tema ativo do usuario. **Nao sao PNGs derivados** — sao os proprios SVGs dos slots.

## Pipeline de Derivacao

Endpoint: `POST /api/v1/borracharia/setup/brand/derive`

1. **Fonte:** busca `icon-dark` ou `icon-light` (conforme escolha do operador)
2. **Gera:** 14 PNGs + 1 ICO em `data/brand/derived/`
3. **Publica:** copia para `apps/*/public/`

## Estrutura local de seeds

Seeds SVG ficam em `assets/brand/{projeto}/dark/` e `assets/brand/{projeto}/light/` com os 6 tipos base (icon, logo, logo-h, logo-v, creative-h, creative-v).
