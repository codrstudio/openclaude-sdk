---
name: framer-motion
description: Padroes de animacao com Framer Motion para React. Use quando precisar adicionar animacoes, transicoes, micro-interacoes ou gestos ao app.
---

# Framer Motion

Biblioteca de animacoes para React. Essencial para transicoes fluidas e micro-interacoes.

## Instalacao

```bash
npm install framer-motion
```

---

## Patterns Comuns

### Fade In ao aparecer
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  Conteudo
</motion.div>
```

### Slide up ao entrar
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
  Card
</motion.div>
```

### Stagger children (lista animada)
```tsx
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
      }}
    />
  ))}
</motion.ul>
```

### Page transitions
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

### Hover scale
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400 }}
>
  Clique
</motion.button>
```

### Drag gesture
```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: 100 }}
  onDragEnd={(_, info) => {
    if (info.offset.x > 100) onSwipeRight();
  }}
/>
```

---

## Componentes Uteis

| Componente | Uso |
|------------|-----|
| `motion.div` | Wrapper animavel |
| `AnimatePresence` | Animar entrada/saida |
| `LayoutGroup` | Animacoes de layout |
| `Reorder` | Listas reordenaveis |
| `useScroll` | Animacoes baseadas em scroll |
| `useInView` | Detectar visibilidade |

---

## Timing Recomendado

| Tipo | Duracao | Easing |
|------|---------|--------|
| Micro-interacao | 100-200ms | easeOut |
| Transicao de componente | 200-300ms | easeInOut |
| Transicao de pagina | 300-400ms | easeInOut |
| Animacao de atencao | 400-600ms | spring |

---

## Spring Configs

```tsx
// Responsivo e natural
{ type: "spring", stiffness: 300, damping: 30 }

// Bouncy (botoes)
{ type: "spring", stiffness: 400, damping: 17 }

// Suave (modais)
{ type: "spring", stiffness: 200, damping: 25 }
```

---

## Integracao com shadcn/ui

Wrapper para componentes shadcn:
```tsx
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

const MotionCard = motion(Card);

<MotionCard
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
>
  Conteudo
</MotionCard>
```
