# UI Tokens

Design tokens for SourceLab, pulled directly from `client/app/globals.css` and `client/components.json`. This project uses **Tailwind CSS v4** with shadcn/ui's `@theme inline` pattern — there is **no `tailwind.config.ts`**. Never hardcode hex/rgb values or use raw Tailwind palette classes (`bg-purple-500`, `text-gray-600`, etc.) — always use the semantic tokens below.

---

## How to Use

Tokens are declared twice in `globals.css`:

1. Raw CSS custom properties in `:root` / `.dark` (actual oklch color values, radius base)
2. `@theme inline` block that maps each raw variable to a Tailwind-facing name (`--color-primary: var(--primary)`), which is what makes `bg-primary`, `text-primary`, `border-primary`, etc. available as utility classes

```tsx
// Correct — semantic Tailwind utility generated from @theme
className="bg-card text-card-foreground border-border"

// Correct — reference the CSS variable directly (rare; prefer the utility class)
style={{ color: "var(--foreground)" }}

// Never — hardcoded color values
className="bg-[#101828] text-[#f6f7fb]"

// Never — raw Tailwind palette classes
className="bg-purple-500 text-gray-600"
```

Dark mode is class-based (`.dark` on `<html>`), toggled via `next-themes` (`ThemeProvider attribute="class"` in `client/app/layout.tsx`) and the `ModeToggle` component.

---

## Color Tokens

All colors are defined as `oklch()` values. Base color family: **stone** (per `components.json`).

| Token (light value) | Dark value | Tailwind utilities |
| --- | --- | --- |
| `--background: oklch(1 0 0)` | `oklch(0.147 0.004 49.25)` | `bg-background`, `text-background` |
| `--foreground: oklch(0.147 0.004 49.25)` | `oklch(0.985 0.001 106.423)` | `bg-foreground`, `text-foreground` |
| `--card` / `--card-foreground` | inverted in dark | `bg-card`, `text-card-foreground` |
| `--popover` / `--popover-foreground` | inverted in dark | `bg-popover`, `text-popover-foreground` |
| `--primary: oklch(0.841 0.238 128.85)` (lime/green) | `oklch(0.768 0.233 130.85)` | `bg-primary`, `text-primary`, `border-primary` |
| `--primary-foreground: oklch(0.405 0.101 131.063)` | same | `text-primary-foreground` |
| `--secondary` / `--secondary-foreground` | | `bg-secondary`, `text-secondary-foreground` |
| `--muted` / `--muted-foreground` | | `bg-muted`, `text-muted-foreground` |
| `--accent` / `--accent-foreground` | | `bg-accent`, `text-accent-foreground` |
| `--destructive: oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | `bg-destructive`, `text-destructive` |
| `--border` | `oklch(1 0 0 / 10%)` in dark | `border-border` |
| `--input` | `oklch(1 0 0 / 15%)` in dark | `border-input`, used on form controls |
| `--ring` | | `ring-ring` (focus rings) |
| `--chart-1` … `--chart-5` | shared light/dark, green scale from `oklch(0.897 …)` down to `oklch(0.453 …)` | `bg-chart-1` … `bg-chart-5` (recharts / data viz) |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | | Sidebar-scoped variants used by `components/ui/sidebar.tsx` |

The accent/primary hue is a lime-green (`oklch(... 128.85)` / `130.85`) — this is the only "brand" color in the palette. There is no separate hardcoded warning/success/info palette; status is communicated via `destructive`, `primary`, `secondary`, and `muted` plus icons, not extra custom colors. If a feature genuinely needs a new semantic color (e.g. a distinct "success" state), add it as a new `--color-*` token in `@theme inline` + `:root`/`.dark` rather than hardcoding.

---

## Radius Tokens

Base radius: `--radius: 0.875rem` (14px). All other radii are derived multiples:

| Token | Formula | Approx. value |
| --- | --- | --- |
| `--radius-sm` | `var(--radius) * 0.6` | ~8.4px |
| `--radius-md` | `var(--radius) * 0.8` | ~11.2px |
| `--radius-lg` | `var(--radius)` | 14px |
| `--radius-xl` | `var(--radius) * 1.4` | ~19.6px |
| `--radius-2xl` | `var(--radius) * 1.8` | ~25.2px |
| `--radius-3xl` | `var(--radius) * 2.2` | ~30.8px |
| `--radius-4xl` | `var(--radius) * 2.6` | ~36.4px |

The codebase leans toward large, soft radii — feature components consistently use `rounded-2xl`/`rounded-3xl` for cards, dialogs, and empty states, and `rounded-full` for pill buttons, search inputs, and filter selects.

---

## Typography

Four font variables are registered in the root layout (`client/app/layout.tsx`) via `next/font/google` and exposed as CSS variables, then mapped in `@theme inline`:

| Font | Google Font | CSS variable | Tailwind token | Usage |
| --- | --- | --- | --- | --- |
| Geist Sans | `Geist` | `--font-geist-sans` | *(not mapped to `--font-sans`; see note)* | Loaded but `--font-sans` is aliased to it in `@theme inline`; effectively unused since `html` forces `font-mono` |
| JetBrains Mono | `JetBrains_Mono` | `--font-mono` | `font-mono` | **Default body font** — applied to `<html>` via `@layer base { html { @apply font-mono; } }` |
| Figtree | `Figtree` | `--font-heading` | `font-heading` | Used explicitly on headings (`font-heading text-2xl font-semibold`, etc.) throughout feature components |
| Geist Mono | `Geist_Mono` | `--font-geist-mono` | *(unused Tailwind token; variable loaded but not referenced in JSX classes today)* | |

**Practical rule:** body/UI text renders in the monospace font (JetBrains Mono, since `html` is forced to `font-mono`); apply `font-heading` explicitly to page titles, section titles, and card titles to get Figtree instead. Don't introduce a new heading font — follow this existing split.

No fixed type scale table exists in the codebase (no `--font-size-*` tokens). Font sizing is done ad hoc via Tailwind size classes (`text-xs`, `text-sm`, `text-base`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`) combined with `font-heading`/`font-semibold`/`font-medium` as needed — match the sizes already used on comparable elements (see `ui-registry.md`) rather than inventing new ones.

---

## Spacing

No custom spacing scale is defined — the project uses Tailwind v4's default spacing scale (`p-2`, `p-4`, `p-6`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, etc.) directly. Observed conventions:

| Pattern | Usage |
| --- | --- |
| `p-6` / `p-6 md:p-8` | Page-level content padding (source library, learn hub) |
| `gap-2` / `gap-3` | Inline control groups (badges, button rows, filter bars) |
| `gap-4` / `gap-6` | Grid gaps between cards, vertical spacing between sections |
| `px-4 py-2`, `h-14` | Sticky headers / toolbars |
| `max-w-3xl`, `max-w-2xl`, `max-w-6xl` | Content width constraints (chat column, forms, dashboard) |

---

## Component-Level Notes

- **Buttons** (`components/ui/button.tsx`) are built on `@base-ui/react`'s `Button` primitive (not Radix), with `class-variance-authority` variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `xs`, `sm`, `default`, `lg`, `icon-xs`, `icon-sm`, `icon`, `icon-lg`. Base radius on buttons is `rounded-2xl`.
- Buttons that render as a link use the `nativeButton={false}` + `render={<Link href="..." />}` pattern (base-ui's polymorphic render prop) — see `ui-rules.md`.
- **Shadows** are used sparingly and only via Tailwind's `shadow-sm`/`shadow-md` utilities — no custom box-shadow values are defined as tokens.
- **Icons**: `lucide-react` exclusively (per `components.json`, `iconLibrary: "lucide"`).

## Invariants

- Never hardcode hex/oklch/rgb color values in `className` or inline `style` — always reference a `--color-*` token via its Tailwind utility.
- Never use Tailwind's built-in color palette classes (`bg-purple-500`, `text-gray-600`, etc.) — this app has no such classes anywhere in `components/ui` or `features/*`; stay consistent.
- Never add a `tailwind.config.ts` for colors/tokens — all tokens live in `app/globals.css` under `@theme inline` and `:root`/`.dark`.
- Use `font-heading` for headings/titles and leave body text on the default `font-mono` — don't introduce a third font family.
- Prefer large radii (`rounded-2xl`/`rounded-3xl`/`rounded-full`) consistent with existing cards, dialogs, and pill controls.
