---
name: vaul
description: Padroes responsivos Drawer/Popup com shadcn/ui. Use quando implementar modais, drawers, paineis laterais ou qualquer sobreposicao responsiva mobile-first.
---

# Drawer & Popup Patterns (shadcn)

Padroes responsivos: Drawer (mobile) -> Popup, Popover ou Right Drawer (web).

Todos os componentes vem do shadcn/ui. O `Drawer` do shadcn usa Vaul internamente —
nao e necessario instalar ou importar Vaul diretamente. Todas as props avancadas do Vaul
(snap points, nested drawers, dismissible controlado) sao acessiveis via componente shadcn.

---

## ESTRATEGIA GERAL

```
Mobile (< 768px)          Desktop (>= 768px)
┌───────────────┐         ┌──────────────────────────┐
│               │         │                    ┌─────┤
│   CONTENT     │         │   CONTENT          │ RD  │
│               │         │                    │     │
├───────────────┤         │                    └─────┤
│ ░░░░░░░░░░░░░ │ Bottom  └──────────────────────────┘
│ ░ DRAWER    ░ │ Drawer        Right Drawer (Sheet)
│ ░░░░░░░░░░░░░ │
└───────────────┘              OU
                          ┌──────────────────────────┐
                          │        ┌────────┐        │
                          │        │ POPUP  │        │
                          │        │        │        │
                          │        └────────┘        │
                          └──────────────────────────┘
                                 Dialog/Modal
```

No mobile, sempre bottom Drawer (animacao spring, swipe-to-dismiss, snap points, scale background).
No desktop, Dialog/Modal para acoes pontuais ou Sheet (side=right) para conteudo extenso.

---

## CRITERIO DE ESCOLHA: POPUP vs RIGHT DRAWER

### Usar POPUP (Dialog/Modal) quando:

| Criterio | Exemplo |
|----------|---------|
| Acao pontual e curta | Confirmar exclusao, rename |
| Formulario simples (1-5 campos) | Editar titulo, add comentario |
| Decisao binaria | Sim/Nao, Salvar/Descartar |
| Sem necessidade de ver conteudo atras | Alertas, confirmacoes |
| Conteudo de tamanho fixo/previsivel | Settings rapidos, selecao de opcao |
| Fluxo que interrompe a tarefa atual | Logout, troca de conta |

### Usar RIGHT DRAWER (Sheet) quando:

| Criterio | Exemplo |
|----------|---------|
| Conteudo longo/scrollavel | Detalhes de registro, historico |
| Precisa ver conteudo principal ao lado | Editar item da lista, preview |
| Formulario complexo (6+ campos) | Cadastro, edicao completa |
| Painel de propriedades/config | Sidebar de settings, filtros |
| Navegacao drill-down | Master -> Detail |
| Conteudo que usuario consulta enquanto age | Docs, referencia, chat |
| Multiplas abas/secoes internas | Perfil com abas (info, historico, notas) |

### Cheat Sheet Rapido

```
Pergunta-se:                                    -> Resultado
─────────────────────────────────────────────────────────────
O usuario precisa ver o que esta atras?          SIM -> Right Drawer
                                                 NAO -> Popup

O conteudo cabe em 400px de altura?              SIM -> Popup
                                                 NAO -> Right Drawer

E uma acao de < 10 segundos?                     SIM -> Popup
                                                 NAO -> Right Drawer

Tem scroll interno ou tabs?                      SIM -> Right Drawer
                                                 NAO -> Popup

E um fluxo de "inspecionar/detalhar"?            SIM -> Right Drawer
                                                 NAO -> Popup
```

---

## COMPONENTES shadcn

```bash
npx shadcn@latest add drawer dialog sheet
```

| Cenario | Mobile | Desktop | Componentes shadcn |
|---------|--------|---------|-------------------|
| Bottom drawer | Drawer | — | `drawer` |
| Modal/popup | Drawer | Dialog | `drawer` + `dialog` |
| Right panel | Drawer | Sheet (side=right) | `drawer` + `sheet` |
| Confirmacao | Drawer | AlertDialog | `drawer` + `alert-dialog` |
| Menu contextual | Drawer | Popover | `drawer` + `popover` |

---

## PADRAO DE IMPLEMENTACAO

O padrao do projeto e **inline switching com `useIsMobile()`**: nao abstrair num componente wrapper generico, e sim fazer o switch direto em cada componente que precisa de responsividade.

### Hook de deteccao

Ja existe em `@ui/hooks/use-media-query`:

```tsx
import { useIsMobile } from "@ui/hooks/use-media-query"
```

### Exemplo: Drawer mobile -> Sheet desktop

```tsx
import { useIsMobile } from "@ui/hooks/use-media-query"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@ui/components/ui/drawer"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@ui/components/ui/sheet"
import { ScrollArea } from "@ui/components/ui/scroll-area"

interface DetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailPanel({ open, onOpenChange }: DetailPanelProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="mb-4 p-0 px-4 pt-4">
            <DrawerTitle>Detalhes</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {/* conteudo */}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="p-4">
          <SheetTitle>Detalhes</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {/* conteudo */}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

### Exemplo: Drawer mobile -> Popover desktop

```tsx
import { useIsMobile } from "@ui/hooks/use-media-query"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@ui/components/ui/drawer"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@ui/components/ui/popover"

export function NotificationPanel() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{trigger}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Notificacoes</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              {/* conteudo */}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* conteudo */}
      </PopoverContent>
    </Popover>
  )
}
```

### Exemplo: Drawer mobile -> Dialog desktop

```tsx
import { useIsMobile } from "@ui/hooks/use-media-query"
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@ui/components/ui/drawer"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@ui/components/ui/dialog"

export function ConfirmDelete({ open, onOpenChange, onConfirm }: Props) {
  const isMobile = useIsMobile()

  const content = (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Tem certeza? Esta acao nao pode ser desfeita.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant="destructive" onClick={onConfirm}>Excluir</Button>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirmar exclusao</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirmar exclusao</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
```

---

## FEATURES AVANCADAS DO DRAWER

O componente shadcn Drawer repassa todas as props para o Vaul interno.
Importar sempre do shadcn (`@ui/components/ui/drawer`), nunca do vaul diretamente.

### Snap Points (paradas intermediarias)

```tsx
<Drawer snapPoints={[0.4, 0.8, 1]} open={open} onOpenChange={setOpen}>
  <DrawerContent>
    {/* 40% -> preview, 80% -> conteudo, 100% -> fullscreen */}
    {children}
  </DrawerContent>
</Drawer>
```

### Nested Drawers (drawer dentro de drawer)

```tsx
{/* Drawer principal */}
<Drawer>
  <DrawerContent>
    <p>Conteudo principal</p>

    {/* Drawer aninhado — usar prop nested */}
    <Drawer nested>
      <DrawerTrigger>Abrir sub-opcao</DrawerTrigger>
      <DrawerContent>
        {/* Segundo nivel */}
      </DrawerContent>
    </Drawer>
  </DrawerContent>
</Drawer>
```

### Dismissible controlado

```tsx
<Drawer
  dismissible={false}  // Nao fecha ao arrastar pra baixo
  handleOnly={true}    // So arrasta pelo handle
>
```

---

## ACESSIBILIDADE

| Requisito | Implementacao |
|-----------|---------------|
| Focus trap | Dialog/Sheet/Drawer do shadcn ja incluem |
| Escape fecha | Todos os tres componentes ja incluem |
| aria-label | Sempre definir titulo (DrawerTitle/DialogTitle/SheetTitle) |
| Scroll lock | Drawer trava scroll do body automaticamente |
| Reduced motion | `prefers-reduced-motion` desabilita animacoes |

---

## RESUMO DE DECISAO

```
                    ┌─────────────────┐
                    │ Precisa ver o   │
                    │ conteudo atras? │
                    └────────┬────────┘
                        ┌────┴────┐
                       SIM       NAO
                        │         │
                  ┌─────┴─────┐  ┌┴──────────────┐
                  │ Conteudo  │  │ Acao rapida   │
                  │ extenso?  │  │ (< 10s)?      │
                  └─────┬─────┘  └───────┬───────┘
                   ┌────┴──┐        ┌────┴──┐
                  SIM     NAO      SIM     NAO
                   │       │        │       │
              Sheet     Sheet    Dialog   Sheet
              (wide)    (narrow)  /Popup  (right)
```

**Regra de ouro**: Na duvida, use Sheet (right drawer). E mais flexivel e acomoda crescimento futuro do conteudo sem precisar refatorar.
