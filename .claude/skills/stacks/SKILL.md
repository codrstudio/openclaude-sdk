---
name: stacks
description: Stack tecnologica do scaffold — backend (Node+Hono), frontend (Vite+React ou Next.js para landing pages). Use quando criar projetos, escolher dependencias ou validar stack.
---

# Stacks

## Backend (`@scaffold/backend`)

| Dependencia | Descricao |
|---|---|
| Node.js >= 20 | Runtime |
| TypeScript 5.9 | Tipagem estatica |
| Hono | Framework HTTP leve e performatico |
| @hono/node-server | Adapter Node.js para Hono |
| @hono/zod-validator | Middleware de validacao Hono + Zod |
| Zod | Schema validation |
| Pino | Logging estruturado (JSON) |
| pino-pretty | Formatacao legivel do Pino em dev |
| tsx | Dev runner com hot-reload (watch mode) |

## Frontend — App (`@scaffold/frontend`)

Stack padrao para aplicacoes (SPA/PWA):

| Dependencia | Descricao |
|---|---|
| React 19 | UI library |
| TypeScript 5.9 | Tipagem estatica |
| Vite 7 | Bundler e dev server |
| TanStack Router | Roteamento file-based com tipagem |
| Tailwind CSS 4 | Utility-first CSS |
| Radix UI | Primitivos de acessibilidade (base do shadcn) |
| shadcn/ui | Componentes prontos sobre Radix + Tailwind |
| Framer Motion | Animacoes declarativas |
| Vaul | Drawer mobile-first |
| class-variance-authority | Variantes de estilo para componentes |
| clsx + tailwind-merge | Composicao condicional de classes |
| tw-animate-css | Animacoes CSS para Tailwind |
| Phosphor Icons | Biblioteca de icones |
| vite-plugin-pwa | Service worker e manifest PWA |
| Fontsource | Inter, Plus Jakarta Sans, Lora, Roboto Mono |
| ESLint 9 + Prettier | Lint e formatacao |

## Frontend — Landing Page

Para landing pages, **trocamos Vite por Next.js**:

| Dependencia | Descricao |
|---|---|
| Next.js (App Router) | SSR, SEO, performance para paginas publicas |
| React 19 | UI library |
| TypeScript 5.9 | Tipagem estatica |
| Tailwind CSS 4 | Utility-first CSS |
| shadcn/ui | Componentes prontos |
| Framer Motion | Animacoes declarativas |
| Phosphor Icons | Biblioteca de icones |

**Quando usar Next.js:** paginas publicas, SEO-critical, landing pages, marketing.
**Quando usar Vite:** apps autenticados, dashboards, PWAs, SPAs.

## Monorepo

| Dependencia | Descricao |
|---|---|
| npm workspaces | Gerenciamento de pacotes (`apps/*`, `packages/*`) |
| concurrently | Execucao paralela de scripts (dev) |
| dotenv-cli | Injeta `.env` nos scripts |
| Playwright | Testes E2E |
| sharp | Processamento de imagens (scripts de build) |

## Observacoes

- **shadcn nao eh dependencia de runtime** — os componentes sao copiados para o projeto via `npx shadcn`. O pacote `shadcn` no package.json eh apenas a CLI.
- **Icones: Phosphor Icons apenas** — Lucide nao eh usado neste projeto.
- **Logging: Pino apenas** — `console.log` eh proibido no backend.
- **`@scaffold/ui`** eh um pacote interno (`packages/ui`) que exporta componentes, hooks e utilitarios compartilhados entre apps.
