---
name: shadcn
description: Referencia local de componentes shadcn/ui v4 com source code real. Use quando implementar UI com shadcn — consulte aqui antes de usar qualquer componente.
---

# shadcn/ui v4 — Referencia de Componentes

Referencia viva dos componentes shadcn/ui v4. **Nunca assuma** API de componente baseado em conhecimento de treinamento — o source code abaixo e a verdade.

## Configuracao do projeto

| Config         | Valor        |
|----------------|--------------|
| Style          | radix-nova   |
| Base color     | stone        |
| Icon library   | phosphor     |
| CSS variables  | sim          |
| RSC            | nao          |
| TSX            | sim          |

## Instalacao de novos componentes

```bash
npx shadcn@latest add <componente>
```

Componentes vao para `packages/ui/src/components/ui/` — nunca dentro de um app.

---

## Button

Variantes: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
Tamanhos: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`
Suporta `asChild` via Radix Slot.

```tsx
import { Button } from "@ui/components/ui/button"

// Variantes
<Button variant="default">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Link</Button>

// Tamanhos
<Button size="xs">Tiny</Button>
<Button size="icon"><PlusIcon /></Button>
<Button size="icon-sm"><PlusIcon /></Button>

// asChild (render as link)
<Button asChild><a href="/page">Go</a></Button>
```

Source:

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]",
        lg: "h-9 gap-1.5 px-2.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)]",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

---

## Card

Sub-componentes: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
Card aceita `size` prop: `"default"` | `"sm"`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@ui/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Titulo</CardTitle>
    <CardDescription>Descricao</CardDescription>
    <CardAction><Button size="icon-sm"><DotsThree /></Button></CardAction>
  </CardHeader>
  <CardContent>Conteudo</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

<Card size="sm">...</Card>
```

---

## Alert

Variantes: `default`, `destructive`
Sub-componentes: `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`

```tsx
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@ui/components/ui/alert"

<Alert variant="destructive">
  <WarningIcon />
  <AlertTitle>Erro</AlertTitle>
  <AlertDescription>Algo deu errado.</AlertDescription>
  <AlertAction><Button size="icon-sm"><X /></Button></AlertAction>
</Alert>
```

---

## Badge

Variantes: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`
Suporta `asChild`.

```tsx
import { Badge } from "@ui/components/ui/badge"

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

---

## Dialog

Sub-componentes: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogPortal`, `DialogOverlay`
`DialogContent` aceita `showCloseButton` prop (default: `true`).
`DialogFooter` aceita `showCloseButton` prop (default: `false`).

```tsx
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@ui/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild><Button>Abrir</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titulo</DialogTitle>
      <DialogDescription>Descricao</DialogDescription>
    </DialogHeader>
    <p>Conteudo</p>
    <DialogFooter>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Collapsible

Wrapper do Radix Collapsible. Sub-componentes: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`.

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@ui/components/ui/collapsible"

<Collapsible>
  <CollapsibleTrigger>Toggle</CollapsibleTrigger>
  <CollapsibleContent>Conteudo expansivel</CollapsibleContent>
</Collapsible>
```

---

## Progress

Prop principal: `value` (0-100).

```tsx
import { Progress } from "@ui/components/ui/progress"

<Progress value={66} />
```

---

## ScrollArea

Sub-componentes: `ScrollArea`, `ScrollBar`. Orientacao: `vertical` (default), `horizontal`.

```tsx
import { ScrollArea, ScrollBar } from "@ui/components/ui/scroll-area"

<ScrollArea className="h-72">
  {/* conteudo longo */}
  <ScrollBar orientation="vertical" />
</ScrollArea>
```

---

## Separator

Props: `orientation` (`horizontal` | `vertical`), `decorative` (default: `true`).

```tsx
import { Separator } from "@ui/components/ui/separator"

<Separator />
<Separator orientation="vertical" className="h-4" />
```

---

## Table

Sub-componentes: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`.

```tsx
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell, TableCaption,
} from "@ui/components/ui/table"

<Table>
  <TableCaption>Lista de itens</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Nome</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Item 1</TableCell>
      <TableCell>Ativo</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## Padrao `cn()` e `data-slot`

Todos os componentes usam `cn()` (clsx + tailwind-merge) e `data-slot` para CSS targeting:

```tsx
import { cn } from "@/lib/utils"

// cn() combina classes com merge inteligente
className={cn("base-classes", conditional && "extra", className)}

// data-slot permite targeting externo
<div data-slot="card-header" className={...}>
```
