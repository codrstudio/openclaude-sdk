---
name: semantic-colors
description: Sistema de cores semanticas via CSS tokens para consistencia entre temas claro/escuro. Use quando aplicar cores em qualquer componente ou pagina — NUNCA use cores diretas.
---

# Cores Semanticas

## Principio

Cores **nunca** sao aplicadas diretamente nas interfaces. Toda cor e referenciada por um token semantico (CSS variable) que se adapta automaticamente entre temas claro e escuro.

```
PROIBIDO                            OBRIGATORIO
─────────────────────────────────   ─────────────────────────────────
className="text-red-500"            className="text-x-error"
className="bg-blue-100"             className="bg-x-info"
style={{ color: '#22c55e' }}        className="text-x-success"
className="text-gray-400"           className="text-x-muted"
className="border-purple-300"       className="border-x-highlight"
```

## Paleta semantica

Os tokens sao definidos como CSS variables e usados via Tailwind. **Cada token tem obrigatoriamente um par `-foreground`** que garante contraste legivel sobre aquele fundo.

| Token | Foreground | Semantica | Referencia de cor | Uso |
|-------|------------|-----------|-------------------|-----|
| `--x-faint` | `--x-faint-foreground` | palido | 50% mais fraco que normal | Textos terciarios, placeholders, hints |
| `--x-muted` | `--x-muted-foreground` | acinzentado | 30% mais fraco que normal | Textos secundarios, descricoes, captions |
| *(normal)* | — | cor padrao | cor padrao do tema | Texto principal (usa `text-foreground`) |
| `--x-info` | `--x-info-foreground` | informativo | azul | Status neutro, dicas, informacoes contextuais |
| `--x-notice` | `--x-notice-foreground` | aviso suave | violeta (~270°) | Alertas nao criticos, lembretes, novidades |
| `--x-highlight` | `--x-highlight-foreground` | destaque | roxo (~290°) | Elementos em destaque, selecoes, badges especiais |
| `--x-success` | `--x-success-foreground` | sucesso | verde | Operacoes concluidas, validacoes positivas |
| `--x-warning` | `--x-warning-foreground` | atencao | amarelo | Avisos que requerem atencao, estados intermediarios |
| `--x-alert` | `--x-alert-foreground` | alerta | laranja | Problemas que precisam de acao, degradacao |
| `--x-error` | `--x-error-foreground` | erro | vermelho | Erros, falhas, validacoes negativas |
| `--x-critical` | `--x-critical-foreground` | critico | fucsia (~330°) | Erros graves, indisponibilidade, acoes irreversiveis |

### Foreground: regra de contraste

O `-foreground` de cada token e a cor de **texto sobre aquele fundo**. Ele depende da luminosidade do fundo:

- Fundo escuro (luminosidade OKLCH < 0.55) → foreground claro (branco ou quase-branco)
- Fundo claro (luminosidade OKLCH >= 0.55) → foreground escuro (preto ou quase-preto)

Isso varia entre temas. Exemplo: `--x-warning` (amarelo) tem fundo claro nos dois temas, entao o foreground e sempre escuro. Ja `--x-error` (vermelho) pode ter fundo escuro no tema dark e claro no tema light — o foreground inverte.

```css
/* Exemplo: warning tem fundo claro -> foreground escuro */
:root {
  --x-warning: oklch(0.80 0.15 85);
  --x-warning-foreground: oklch(0.20 0.02 85);  /* escuro */
}
.dark {
  --x-warning: oklch(0.80 0.12 85);
  --x-warning-foreground: oklch(0.15 0.02 85);  /* escuro tambem */
}

/* Exemplo: error muda de contraste entre temas */
:root {
  --x-error: oklch(0.55 0.20 25);
  --x-error-foreground: oklch(0.98 0.01 25);    /* claro (fundo escuro) */
}
.dark {
  --x-error: oklch(0.65 0.18 25);
  --x-error-foreground: oklch(0.10 0.01 25);    /* escuro (fundo claro) */
}
```

**WCAG**: o contraste entre fundo e foreground deve ser no minimo 4.5:1 para texto normal. Use OKLCH lightness como guia rapido: diferenca de ~0.40+ entre fundo e foreground geralmente atende.

## Como usar no Tailwind

Cada token gera classes utilitarias:

```tsx
// Texto
<span className="text-x-success">Aprovado</span>
<span className="text-x-error">Falhou</span>
<span className="text-x-muted">Descricao secundaria</span>

// Fundo
<div className="bg-x-info text-x-info-foreground">Info banner</div>
<div className="bg-x-warning text-x-warning-foreground">Aviso</div>

// Borda
<div className="border border-x-error">Campo invalido</div>

// Opacidade
<div className="bg-x-success/10 text-x-success">Badge sutil</div>
```

## Tokens do shadcn/ui (base)

Alem da paleta estendida, o shadcn/ui define tokens base que devem ser respeitados:

| Token shadcn | Uso |
|-------------|-----|
| `background` / `foreground` | Fundo e texto principal da pagina |
| `card` / `card-foreground` | Fundo e texto de cards |
| `primary` / `primary-foreground` | Acoes principais, CTAs |
| `secondary` / `secondary-foreground` | Acoes secundarias |
| `muted` / `muted-foreground` | Elementos atenuados (similar a --x-muted) |
| `accent` / `accent-foreground` | Hover, destaque interativo |
| `destructive` / `destructive-foreground` | Acoes destrutivas (similar a --x-error) |
| `border` | Bordas gerais |
| `ring` | Focus ring |

### Tokens do sidebar

O sidebar tem tokens proprios para independencia visual:

`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`

## Definicao dos tokens

Tokens sao definidos no `index.css` de cada app com valores OKLCH. **Sempre defina o par fundo + foreground juntos.**

```css
:root {
  --x-faint: oklch(0.75 0.01 250);
  --x-faint-foreground: oklch(0.25 0.01 250);
  --x-muted: oklch(0.65 0.02 250);
  --x-muted-foreground: oklch(0.20 0.01 250);
  --x-info: oklch(0.65 0.15 240);
  --x-info-foreground: oklch(0.98 0.01 240);
  --x-notice: oklch(0.60 0.18 270);
  --x-notice-foreground: oklch(0.98 0.01 270);
  --x-highlight: oklch(0.58 0.20 290);
  --x-highlight-foreground: oklch(0.98 0.01 290);
  --x-success: oklch(0.65 0.18 145);
  --x-success-foreground: oklch(0.98 0.01 145);
  --x-warning: oklch(0.80 0.15 85);
  --x-warning-foreground: oklch(0.20 0.02 85);
  --x-alert: oklch(0.70 0.18 55);
  --x-alert-foreground: oklch(0.15 0.01 55);
  --x-error: oklch(0.55 0.20 25);
  --x-error-foreground: oklch(0.98 0.01 25);
  --x-critical: oklch(0.55 0.22 330);
  --x-critical-foreground: oklch(0.98 0.01 330);
}

.dark {
  --x-faint: oklch(0.40 0.01 250);
  --x-faint-foreground: oklch(0.80 0.01 250);
  --x-muted: oklch(0.50 0.02 250);
  --x-muted-foreground: oklch(0.85 0.01 250);
  --x-info: oklch(0.70 0.12 240);
  --x-info-foreground: oklch(0.15 0.01 240);
  --x-notice: oklch(0.68 0.15 270);
  --x-notice-foreground: oklch(0.15 0.01 270);
  --x-highlight: oklch(0.65 0.17 290);
  --x-highlight-foreground: oklch(0.15 0.01 290);
  --x-success: oklch(0.70 0.15 145);
  --x-success-foreground: oklch(0.15 0.01 145);
  --x-warning: oklch(0.80 0.12 85);
  --x-warning-foreground: oklch(0.20 0.02 85);
  --x-alert: oklch(0.75 0.15 55);
  --x-alert-foreground: oklch(0.15 0.01 55);
  --x-error: oklch(0.65 0.18 25);
  --x-error-foreground: oklch(0.10 0.01 25);
  --x-critical: oklch(0.65 0.19 330);
  --x-critical-foreground: oklch(0.10 0.01 330);
}
```

Os valores exatos devem ser ajustados ao tema do projeto. O importante e:
- **Cada token DEVE ter seu `-foreground`** — nunca definir um sem o outro
- Foreground deve contrastar no minimo 4.5:1 (WCAG AA) sobre o fundo
- Cores calculadas em **OKLCH** para uniformidade perceptual
- Diferenca de luminosidade ~0.40+ entre fundo e foreground como guia rapido

## Temas

`<ThemeProvider>` gerencia dark/light/system via classe no `<html>`:
- `.dark` aplica variaveis do tema escuro
- Default (sem classe) aplica tema claro
- "Auto" usa `prefers-color-scheme`

Toggle fica no `<AvatarMenu>` com tres opcoes: Claro / Escuro / Auto.

## Regras

- **NUNCA** use classes de cor Tailwind diretas (`text-red-500`, `bg-blue-100`)
- **NUNCA** use valores hex/rgb/hsl inline (`style={{ color: '#fff' }}`)
- **SEMPRE** use tokens semanticos que se adaptem ao tema
- **SEMPRE** defina foreground para cada token de fundo (contraste)
- Ao criar um novo componente, pergunte: "qual a SEMANTICA desta cor?" e use o token correspondente
- Se nenhum token existente cobre a semantica, discuta a criacao de um novo token — nao improvise
