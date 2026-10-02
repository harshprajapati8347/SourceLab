# UI Tokens

Design tokens for SourceLab, from `client/app/globals.css` and `client/components.json`. This project uses **Tailwind CSS v4** with shadcn/ui's `@theme inline` pattern. There is **no `tailwind.config.ts`**. Never hardcode hex/rgb values or use raw Tailwind palette classes (`bg-purple-500`, `text-gray-600`, etc.). Use the semantic tokens below.

The visual identity follows `docs/frontend-design/`: a dark-first, dense interface on a four-step neutral ramp with one amber accent, set in Manrope. The docs' hard-coded hex values and forced dark mode are not copied. Every colour is an oklch token and both themes work.

---

## How to Use

Tokens are declared twice in `globals.css`:

1. Raw CSS custom properties in `:root` / `.dark` (oklch colour values, radius base)
2. An `@theme inline` block that maps each raw variable to a Tailwind-facing name (`--color-primary: var(--primary)`), which makes `bg-primary`, `text-primary`, `border-primary`, etc. available as utility classes

```tsx
// Correct: semantic Tailwind utility generated from @theme
className="bg-card text-card-foreground border-border"

// Never: hardcoded colour values
className="bg-[#101828] text-[#f6f7fb]"

// Never: raw Tailwind palette classes
className="bg-purple-500 text-gray-600"
```

Dark mode is class-based (`.dark` on `<html>`), toggled with `next-themes` (`ThemeProvider attribute="class" defaultTheme="dark" enableSystem` in `client/app/layout.tsx`). The theme switch lives in `UserMenu` (and the command palette). To force a subtree dark (the landing page and the sign-in brand panel), put the `dark` class on that element.

---

## Color Tokens

Neutral ramp in dark: sidebar `oklch(0.145)` < background `0.18` < card/popover `0.215` < secondary/muted/accent `0.26` < border `0.30`. Light is a warm neutral set (`oklch(0.985 0.004 85)` background, white cards).

| Token | Dark | Light | Tailwind utilities |
| --- | --- | --- | --- |
| `--background` | `oklch(0.18 0 0)` | `oklch(0.985 0.004 85)` | `bg-background` |
| `--foreground` | `oklch(0.985 0 0)` | `oklch(0.18 0.006 70)` | `text-foreground` |
| `--card` / `--popover` | `oklch(0.215 0 0)` | `oklch(1 0 0)` | `bg-card`, `bg-popover` |
| `--primary` (amber) | `oklch(0.77 0.15 68)` | same | `bg-primary`, `border-primary`, `ring-primary`, icon tints |
| `--primary-foreground` | `oklch(0.18 0 0)` | `oklch(0.18 0.01 70)` | `text-primary-foreground` (on an amber fill) |
| `--primary-ink` | same as primary | `oklch(0.5 0.12 62)` | `text-primary-ink`: **amber as readable text** |
| `--secondary`, `--muted`, `--accent` | `oklch(0.26 0 0)` | warm greys | `bg-secondary`, `bg-muted`, `bg-accent` |
| `--muted-foreground` | `oklch(0.72 0 0)` | `oklch(0.49 0.01 70)` | `text-muted-foreground` |
| `--destructive` | `oklch(0.7 0.19 22)` | `oklch(0.55 0.21 27)` | `bg-destructive`, `text-destructive` |
| `--border` / `--input` | `oklch(0.30 0 0)` | `oklch(0.9 0.006 85)` | `border-border`, `border-input` |
| `--ring` | amber | amber | `ring-ring` (focus rings) |
| `--sidebar*` | darker than the page in dark | slightly darker than the page in light | Sidebar-scoped variants used by `components/ui/sidebar.tsx` |
| `--chart-1` to `--chart-5` | amber scale | same | `bg-chart-1` and so on |

**Amber rule:** amber is a fill (`bg-primary` with `text-primary-foreground`), a border or ring tint (`border-primary/40`), or an icon tint. When amber is the colour of readable **text** on a surface that can be light, use `text-primary-ink`, not `text-primary` (contrast). Inside a `dark` subtree the two are identical.

Status has no extra palette: use `destructive`, `primary`, `secondary`, and `muted` plus an icon. If a feature needs a new semantic colour, add a `--color-*` token in `@theme inline` and `:root`/`.dark` rather than hardcoding.

---

## Radius Tokens

Base radius: `--radius: 0.625rem` (10px).

| Token | Formula | Value |
| --- | --- | --- |
| `--radius-sm` | `radius * 0.6` | 6px |
| `--radius-md` | `radius * 0.8` | 8px |
| `--radius-lg` | `radius` | 10px |
| `--radius-xl` | `radius * 1.6` | 16px |
| `--radius-2xl` | `radius * 1.8` | 18px |
| `--radius-3xl` | `radius * 2.2` | 22px |
| `--radius-4xl` | `radius * 2.6` | 26px |

Where each is used: `rounded-md` for small hit areas, `rounded-lg` for buttons, inputs, selects, menu items, and icon tiles, `rounded-xl` for cards, panels, and popovers, `rounded-2xl` for dialogs and the command palette, `rounded-full` for pills (filters, search fields on list pages, badges, prompt chips). Do not use `rounded-3xl` or larger.

---

## Typography

Two font variables are registered in `client/app/layout.tsx` via `next/font/google`:

| Font | CSS variable | Tailwind token | Usage |
| --- | --- | --- | --- |
| Manrope | `--font-manrope` | `font-sans`, `font-heading` | Everything. `html` uses `font-sans`; `font-heading` is the same family and marks titles |
| JetBrains Mono | `--font-jetbrains-mono` | `font-mono` | Data only: citation numbers, `Kbd`, code, Markdown source fields |

Scale in practice: body `text-sm`, dense metadata `text-xs`, page titles `font-heading text-xl font-bold tracking-tight md:text-2xl`, card and section titles `font-heading text-sm|base font-semibold`, hero titles use fluid `clamp()`. Labels are sentence case. Do not add ALL-CAPS eyebrow labels.

---

## Spacing

Tailwind v4's default scale. Observed conventions:

| Pattern | Usage |
| --- | --- |
| `p-4 md:p-8` | Page content padding inside a workspace |
| `px-4 md:px-8`, `h-14` | Headers (`border-b`, `bg-background/80 backdrop-blur-md`) |
| `gap-2` / `gap-3` | Inline control groups |
| `gap-4` / `gap-6` | Grid gaps, section spacing |
| `max-w-3xl` | Chat column, account pages |
| `max-w-4xl` | Source and artifact detail |
| `max-w-6xl` | Dashboard, sources, learn |
| `w-80` | Sources panel |

---

## Motion

- House easing: `ease-house` (`cubic-bezier(0.16, 1, 0.3, 1)`, defined in `@theme inline`) with 200ms for hover and focus, 200-300ms for panels and dialogs.
- Motion answers a user action (open, expand, hover). The only unprompted motion is `animate-spin` (a request in flight) and `animate-pulse` (a background job).
- `prefers-reduced-motion: reduce` removes animation and transition durations globally (spinners excepted). Learn viewers use `MotionConfig reducedMotion="user"`.

---

## Component-Level Notes

- **Buttons** (`components/ui/button.tsx`) use `@base-ui/react`'s `Button` with CVA variants `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` and sizes `xs`, `sm`, `default`, `lg`, `icon(-xs|-sm|-lg)`. Base radius `rounded-lg`.
- Buttons that render as a link use `nativeButton={false}` + `render={<Link href="..." />}`.
- **Active navigation** shows a 2px amber tick on the left (`SidebarMenuButton` `data-active`).
- **Focus**: every control has a `focus-visible:ring-3 ring-ring/30-40` style. Composer uses `focus-within` border + 1px ring in `primary`.
- **Shadows** are rare: dialogs `shadow-2xl`, popovers `shadow-lg`. Cards use borders, not shadows.
- **Icons**: `lucide-react` only.

## Invariants

- Never hardcode hex/oklch/rgb colours in `className` or inline `style`. Reference a token.
- Never use Tailwind's built-in palette classes. Scrims use `bg-black/60` (overlays only).
- Never add a `tailwind.config.ts`. All tokens live in `app/globals.css`.
- Use `text-primary-ink` for amber text, `text-primary` only for icons or inside a forced-dark subtree.
- Use `font-heading` for titles. Do not add a third font family.
