---
name: app-shell
description: Sistema de layout, navegacao e responsividade do scaffold — sidebar, breadcrumbs, shortcuts mobile, menu hierarquico, tokens CSS. Use quando implementar ou modificar o shell de uma app autenticada.
---

# App Shell

O App Shell eh o sistema de layout, navegacao e responsividade do scaffold. Ele encapsula toda a experiencia autenticada: sidebar, breadcrumbs, shortcuts mobile, notificacoes, busca e menu de usuario.

## Conceito

O shell segue o principio **mobile-first com experiencia web otimizada**. Nao eh um layout mobile esticado para desktop — sao duas experiencias distintas:

- **Mobile (< 768px)**: shortcut bar fixa no bottom, drawer bottom (Vaul) para menu completo, titulo simples no header, busca expansivel, notificacoes em drawer.
- **Desktop (>= 768px)**: sidebar fixa colapsavel, breadcrumbs completos, busca sempre visivel, notificacoes em popover.

A transicao eh automatica via `useIsMobile()` (breakpoint 768px).

## Anatomia

```
Desktop                                     Mobile
┌──────────┬──────────────────────────┐     ┌─────────────────────────┐
│ Sidebar  │ BreadcrumbBar            │     │ BreadcrumbBar           │
│ 240/64px │ [=] Home / Page  [Q][B] │     │ [<] Titulo    [Q] [B]  │
│          ├──────────────────────────┤     ├─────────────────────────┤
│  Brand   │                          │     │                         │
│  Menu    │   <main>                 │     │   <main>                │
│  Widgets │     <Outlet />           │     │     <Outlet />          │
│  Avatar  │                          │     │                         │
│          │                          │     ├─────────────────────────┤
└──────────┴──────────────────────────┘     │ ShortcutBar  [= Menu]  │
                                            └─────────────────────────┘
```

Container raiz: `flex min-h-svh bg-background`. Conteudo principal usa `margin-left` animado (240px expandida, 64px colapsada, 0 mobile).

## Componentes

Todos em `packages/ui/src/components/`:

| Componente | Caminho | Papel |
|---|---|---|
| **AppShell** | `app-shell/app-shell.tsx` | Orquestrador |
| **Sidebar** | `app-shell/sidebar.tsx` | Container fixo lateral, desktop only (`hidden md:flex`) |
| **BreadcrumbBar** | `app-shell/breadcrumb-bar.tsx` | Header sticky `h-14` |
| **ShortcutBar** | `app-shell/shortcut-bar.tsx` | Barra de atalhos mobile only (`md:hidden`) |
| **ShortcutEditor** | `app-shell/shortcut-editor.tsx` | Drawer para editar atalhos |
| **AppNavPanel** | `app-nav-panel/app-nav-panel.tsx` | Painel de navegacao (5 areas) — reusado em Sidebar e Drawer |
| **AppNavBrand** | `app-nav-panel/app-nav-brand.tsx` | Logo responsivo |
| **AppNavWidgets** | `app-nav-panel/app-nav-widgets.tsx` | Cards de status |
| **AvatarMenu** | `app-nav-panel/avatar-menu.tsx` | Avatar + Popover |
| **AppMenu** | `app-menu/app-menu.tsx` | Menu hierarquico com drill-down |
| **AppMenuItem** | `app-menu/app-menu-item.tsx` | Item individual |
| **NotificationPanel** | `notifications/notification-panel.tsx` | Popover (desktop) / Drawer (mobile) |

## Fluxo de dados

O `AppShell` eh **headless quanto a estado** — nao faz fetch, nao gerencia rotas, nao armazena estado global. Tudo vem por props da rota `_shell.tsx`:

```
_shell.tsx (route layout)
  ├── menuRoot          <- config/menu.ts (arvore de navegacao)
  ├── activeRoute       <- router.state.location.pathname
  ├── breadcrumbs       <- construido a partir de useMatches() + staticData.breadcrumb
  ├── pageTitle         <- ultimo breadcrumb
  ├── shortcuts/available/isFull <- useShortcuts(menuRoot)
  ├── theme             <- useTheme()
  ├── user              <- dados do usuario autenticado
  ├── notifications     <- dados de notificacoes
  ├── menuOpen          <- search param ?menu=true (estado roteavel)
  ├── canGoBack         <- breadcrumbs.length > 1
  └── callbacks         <- router.navigate, setTheme, add/remove/reorder, etc
```

---

# Sidebar

Container lateral fixo do desktop que hospeda o `<AppNavPanel />`.

**Escopo**: somente desktop (`hidden md:flex`). No mobile a sidebar nao existe.

## Implementacao

`<aside>` com `fixed inset-y-0 left-0 z-30`, `bg-sidebar`, `transition-[width] duration-200 ease-in-out`. Largura via `style={{ width: collapsed ? 64 : 240 }}`.

## Dimensoes

| Estado | Largura | Logo | Menu | Widgets | Avatar |
|--------|---------|------|------|---------|--------|
| Expandida | 240px | `logo` (ReactNode) | icon + label | icon + label + value | avatar + nome + role |
| Colapsada | 64px | `logoCollapsed` | icon only + tooltip | icon + value + tooltip | avatar only + tooltip |

## Colapse

Hook `useSidebarState()`: persiste em `localStorage` (key: `sidebar:collapsed`). Trigger na BreadcrumbBar (botao hamburger). `<AppNavPanel />` recebe `collapsed={!isMobile && collapsed}`.

---

# BreadcrumbBar

Header sticky no topo. Presente em ambas plataformas com adaptacao responsiva.

`<header>` com `sticky top-0 z-10`, `h-14`, `border-b border-border bg-background`.

## Desktop (>= 768px)

| Area | Componente | Comportamento |
|------|-----------|---------------|
| Esquerda | Button ghost icon `<List />` | Toggle collapse da sidebar |
| Centro | nav com breadcrumbs separados por `/` | Niveis intermediarios clicaveis |
| Direita | Input (w-48, h-8) + NotificationPanel (popover) | Busca sempre visivel |

## Mobile (< 768px) — normal

| Area | Componente | Comportamento |
|------|-----------|---------------|
| Esquerda | Button `<CaretLeft />` (44x44 touch) | Navega para rota pai (NAO history.back()) |
| Centro | span com pageTitle | Titulo truncado |
| Direita | Button `<MagnifyingGlass />` + NotificationPanel (drawer) | Busca expansivel |

## Mobile — busca ativa

Input substitui o titulo com autoFocus. CaretLeft fecha a busca em vez de navegar.

## Breadcrumbs (construcao)

```typescript
const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
  const items = [{ label: "Home", route: "/" }]
  for (const match of matches) {
    const label = (match.staticData as { breadcrumb?: string })?.breadcrumb
    if (label) items.push({ label, route: match.pathname })
  }
  return items
}, [matches])
```

Cada rota define breadcrumb via `staticData`:

```typescript
export const Route = createFileRoute("/_shell/settings")({
  staticData: { breadcrumb: "Configuracoes" },
})
```

---

# ShortcutBar

Barra fixa na base do mobile com atalhos rapidos personalizaveis.

**Escopo**: somente mobile (`md:hidden`).

## Anatomia

```
┌─────────────────────────────────────────────────────┐
│  [Inicio]  [Config]  [...]   [...]   [...]  │ Menu │
└─────────────────────────────────────────────────────┘
 <---- ate 5 slots personalizaveis ------------>  fixo
```

- **5 slots**: preenchidos com MenuItem, personalizaveis pelo usuario.
- **Menu**: fixo na direita, separado por `border-l`. Abre Drawer bottom (Vaul).
- **Highlight**: slot de activeRoute recebe `text-primary`.
- Cada slot: `min-h-[56px]`, icone + label truncado (`text-[10px]`).
- `padding-bottom: env(safe-area-inset-bottom)` — safe area do iPhone.

## Estado do Drawer como search param

```typescript
const { menu: menuOpen } = Route.useSearch()
const handleMenuOpenChange = (open: boolean) => {
  router.navigate({
    search: (prev) => ({ ...prev, menu: open || undefined }),
    replace: true,
  })
}
```

F5 preserva estado, botao voltar fecha drawer, estado compartilhavel via URL.

## ShortcutEditor

Drawer nested (Vaul) para personalizar os 5 slots. Secao "Seus atalhos" com reorder/remove e secao "Adicionar" com itens disponiveis.

## useShortcuts hook

```typescript
useShortcuts(menuRoot: MenuContext, userId?: string)
// Retorna: { shortcuts, available, ids, add, remove, reorder, reset, isFull }
```

Persistencia em `localStorage`. Max 5 slots. Defaults via `menuRoot.defaultShortcuts`.

---

# Menu

Sistema de navegacao hierarquico com drill-down.

## Modelo de dados

```typescript
type Tier = "customer" | "attendant" | "manager" | "admin"

interface MenuItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>  // Phosphor icon
  route?: string          // leaf node
  children?: MenuContext  // drill-down
  minTier?: Tier
}

interface MenuGroup {
  id: string
  label: string
  items: MenuItem[]
}

interface MenuContext {
  id: string
  title?: string
  parent?: string
  groups: MenuGroup[]
  defaultShortcuts?: string[]
}
```

## Definicao por app

```typescript
// apps/{app}/config/menu.ts
export const menuRoot: MenuContext = {
  id: "root",
  groups: [
    {
      id: "main",
      items: [
        { id: "home", label: "Inicio", icon: House, route: "/" },
      ],
    },
  ],
  defaultShortcuts: ["home"],
}
```

## AppNavPanel: 5 areas

1. **Brand** — Logo responsivo ao colapse (`h-14`)
2. **Menu** — `<AppMenu />` scrollavel (`flex-1`)
3. **Widgets** — Cards de status opcionais (tooltip quando colapsado)
4. **Avatar Menu** — Popover com perfil, tema toggle (Claro/Escuro/Auto), logout
5. **"Editar atalhos"** — Link mobile-only

## AppMenu: drill-down

Context stack: `[root, child1, child2...]`. MenuItem com `children` faz push. "Voltar" faz pop.

## AppMenuItem

- `min-h-[44px]` — touch target minimo
- `active:scale-[0.98]` — feedback tactil
- Ativo: `bg-sidebar-accent font-medium text-sidebar-accent-foreground`
- Colapsado: `justify-center px-0` + `<Tooltip side="right">`
- Drill-down: `<CaretRight className="ml-auto opacity-50" />`

## Filtragem por tier

```
customer < attendant < manager < admin
```

Itens cujo `minTier` excede o do usuario devem ser filtrados.

---

# Styling

## Espacamento

- Shell: `p-0`. Conteudo de cada pagina decide seu padding.
- Mobile content: `<main>` recebe `pb-14` (nao ficar atras da shortcut bar).
- Transicao: `margin-left` animado com `transition-[margin-left] duration-200 ease-in-out`.

## Componentes e cores

Consulte as skills dedicadas:
- **`ui-dry`** — hierarquia de decisao, onde criar componentes, packages/ui
- **`semantic-colors`** — paleta semantica, tokens CSS, temas claro/escuro

### Tokens especificos do sidebar

O sidebar tem tokens proprios: `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`.
