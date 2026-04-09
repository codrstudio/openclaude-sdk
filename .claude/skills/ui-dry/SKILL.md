---
name: ui-dry
description: DRY em componentes de interface — criar em packages/ui e reusar em todas as apps. Use quando implementar qualquer componente de UI para garantir consistencia e reuso.
---

# DRY — Componentes de Interface

## Principio

Todo componente visual deve existir **uma unica vez** em `packages/ui/` e ser consumido por todas as apps via `@scaffold/ui` (ou `@{slug}/ui` apos rename). Duplicar componentes entre apps e proibido.

## Hierarquia de decisao

Antes de criar qualquer elemento visual, siga esta ordem:

1. **shadcn/ui** — consulte a skill `shadcn` e use o componente pronto
2. **Composicao** — componha a partir de componentes shadcn existentes
3. **Radix primitive** — quando shadcn nao cobre o caso
4. **HTML raw** — ultimo recurso, com justificativa

## Onde criar componentes

```
packages/ui/src/
  components/
    ui/              ← componentes shadcn (adicionados via npx shadcn add)
    {dominio}/       ← componentes de dominio compostos (ex: app-shell/, notifications/)
  hooks/             ← hooks compartilhados (ex: use-media-query, use-shortcuts)
  lib/
    utils.ts         ← cn() e utilitarios
```

**Regras de localizacao:**

| Tipo | Onde | Exemplo |
|------|------|---------|
| Componente shadcn | `packages/ui/src/components/ui/` | button.tsx, card.tsx |
| Componente composto reutilizavel | `packages/ui/src/components/{dominio}/` | app-nav-panel.tsx |
| Hook reutilizavel | `packages/ui/src/hooks/` | use-media-query.ts |
| Componente especifico de app | `apps/{app}/src/components/` | **somente se nao reutilizavel** |

## Quando criar em packages/ui vs app local

- **packages/ui**: componente sera usado em mais de um app, OU define um padrao visual do sistema
- **app local**: componente e especifico de uma unica rota/feature e nao faz sentido compartilhar

**Na duvida, crie em packages/ui.** E mais facil mover de shared para local do que o contrario.

## Adicionar componentes shadcn

Sempre instale no packages/ui, nunca dentro de um app:

```bash
cd packages/ui
npx shadcn@latest add <componente>
```

## Tailwind CSS 4 + monorepo

O Tailwind v4 so gera CSS para classes que encontra nos arquivos escaneados. `packages/ui/` esta fora do diretorio do app.

**Obrigatorio** no `index.css` de cada app:

```css
@source "../../../packages/ui/src";
```

Sem isso, classes que existem apenas em `packages/ui/` nao geram CSS — o HTML renderiza correto mas sem estilo.

## Responsive: mobile-first com useIsMobile()

O padrao e **inline switching** com `useIsMobile()`, nao wrappers genericos:

```tsx
import { useIsMobile } from "@ui/hooks/use-media-query"

export function MyPanel({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Drawer ...>...</Drawer>
  }

  return <Sheet ...>...</Sheet>
}
```

Consulte a skill `vaul` para os padroes drawer/popup responsivos.

## Regras

- **NUNCA** duplique componentes entre apps — se duas apps precisam, vai para packages/ui
- **NUNCA** crie variantes de estilo inline (cores, bordas, sombras) — use variantes CVA ou tokens CSS
- **NUNCA** use cores diretas — consulte a skill `semantic-colors` para tokens
- **NUNCA** use Lucide — apenas Phosphor Icons
- Componentes devem aceitar `className` para customizacao pontual via `cn()`
- Exporte tudo pelo barrel file de packages/ui
