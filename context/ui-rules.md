# UI Rules

Concise conventions for building SourceLab UI, following `docs/frontend-design/` where it fits this stack. They come from consistent patterns across `client/features/*` and `client/components/ui` — match them rather than inventing new patterns.

---

## Component Library: base-ui, not Radix

This project's shadcn/ui setup (`components.json`, style `base-rhea`) is built on **`@base-ui/react`** primitives, not Radix UI. This shows up in a few important ways:

- Polymorphic rendering uses a `render` prop, not `asChild`:

```tsx
// Correct — base-ui render prop pattern
<Button nativeButton={false} render={<Link href="/dashboard" />}>
  Get started
</Button>

<DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" />}>
  <MoreHorizontalIcon />
</DropdownMenuTrigger>
```

- `nativeButton={false}` must be set whenever a `Button` renders as something other than a native `<button>` (e.g. a `Link`).
- Don't import Radix primitives (`@radix-ui/*`) directly — everything routes through `components/ui/*` wrappers over `@base-ui/react`.

---

## Font

- Body and UI text use Manrope (`font-sans` on `<html>`). Do not add a font class for normal copy.
- Apply `font-heading` (same family) on page titles, section headings, and card titles:

```tsx
<h1 className="font-heading text-xl font-bold tracking-tight md:text-2xl">Sources</h1>
```

- `font-mono` (JetBrains Mono) is for data only: citation numbers, `Kbd`, code, and Markdown fields.
- Labels are sentence case. No ALL-CAPS eyebrow labels, and no numbered markers unless the content is a sequence.
- Don't introduce new fonts. Fonts are registered once in `client/app/layout.tsx` via `next/font/google`.

---

## Layout

- Page titles in a workspace use `PageHeader` (`shared/components/page-header.tsx`): one `h1` per page, actions on the right.
- Content widths: `max-w-3xl` for the chat column and account pages, `max-w-4xl` for detail pages, `max-w-6xl` for the dashboard, sources, and learn. Padding is `p-4 md:p-8`.
- Headers are `h-14 border-b bg-background/80 backdrop-blur-md`.
- Inside a workspace the layout is **sidebar + inset**, built from `components/ui/sidebar.tsx` and mounted once in `app/(protected)/workspace/[id]/layout.tsx` through `WorkspaceShell`. Route pages render only their content. Don't wrap a page in `WorkspaceShell` yourself.
- The sources panel (`w-80`) sits beside chat and learn on desktop and is a `Sheet` below `md`. Its open state lives in `shared/stores/ui-store.ts`.
- Pages outside a notebook use `AppHeader` (dashboard) or `AccountShell` (billing, memory).
- The active notebook comes from the route (`usePathname`, route params), never from a store.
- Keyboard shortcuts, the command palette, and the shortcuts dialog are mounted per shell through `AppOverlays`. Add new shortcuts in `use-keyboard-shortcuts.ts` and list them in `ShortcutsDialog`.

---

## Cards

Use the shadcn `Card` primitives for structured content. For list items, artifact tiles, and notebook cards the pattern is a plain element with:

```
rounded-xl border bg-card p-4  hover:border-primary/40  transition-colors duration-200 ease-house
```

Make the whole card clickable with a stretched link on the title (`after:absolute after:inset-0`) and lift secondary actions above it with `relative z-10`. Hover shifts the border toward amber and a small arrow nudges diagonally. No lift and no large shadow. Danger sections use `border-destructive/30 bg-destructive/5`, never a solid destructive fill.

---

## Empty States

Use `Empty` / `EmptyHeader` / `EmptyTitle` / `EmptyDescription` / `EmptyContent` (`components/ui/empty.tsx`) with `className="border"` for errors and `border border-dashed` for first-use states. Every empty state the user can resolve has a primary action, and every error state offers "Try again" (`refetch()`).

Loading uses `Skeleton` blocks sized like the content (`min-h-44 rounded-xl` for notebook cards) inside a container with `aria-busy="true"`. A background refetch that fails must not replace data already on screen: branch on `error && !data`.

---

## Buttons

- Icon-only buttons always pair `size="icon"`/`icon-sm`/`icon-xs` with a `sr-only` label (`<span className="sr-only">Open menu</span>`) for accessibility.
- Primary actions use the default (filled) variant; secondary/cancel actions use `variant="outline"`; low-emphasis actions (delete icon in a list row, "cancel selection") use `variant="ghost"`; destructive confirmations use `variant="destructive"`.
- Pending/async buttons show the shared `Spinner` component before the label rather than disabling with no feedback:

```tsx
<Button disabled={isPending}>
  {isPending ? <Spinner /> : null}
  Save
</Button>
```

- Pill-shaped filter/toggle controls (list-page search, view toggle, filter dropdowns) explicitly add `rounded-full` on top of the button's default `rounded-lg`.

---

## Forms

- Use `Label` + `Input`/`Textarea`/`Select` from `components/ui`, wrapped in `<div className="grid gap-2">` per field.
- Controlled inputs with local `useState` per field are the norm for dialogs (no form library like React Hook Form is installed) — keep new forms consistent with this (no new form library).
- Multi-mode "add" dialogs use `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` to switch between input types (see `AddSourceDialog`) rather than separate dialogs per mode.
- Destructive/irreversible actions always confirm via `AlertDialog`, never a plain `window.confirm` or an immediate action on click.

---

## Data Fetching & State

- All server data goes through a feature's `hooks/use-*.ts` file, which wraps `@tanstack/react-query` (`useQuery`/`useMutation`) around that feature's `lib/api.ts` functions. Don't call `apiFetch`/`fetch` directly from a component.
- Query keys are centralized in a `*Keys(...)` factory function per feature (e.g. `sourceKeys(workspaceId)`), and mutations invalidate via that factory — follow this pattern for new features instead of inlining query key arrays.
- Poll (via `refetchInterval`) only for genuinely async server-side work in progress (source processing status) — don't add polling for data that updates only in response to user actions.
- Debounce user-typed search input with `useDebouncedValue` (`shared/hooks`) before it hits a query key or server request.
- Small cross-page UI preferences that should persist client-side (e.g. chat model choice, web search toggle) go in a `zustand` store under the feature (`features/chat/stores/chat-preferences.ts`), not React Context and not query cache.

---

## Errors

- Never show a raw thrown error to the user. `shared/lib/api.ts` throws a typed `ApiError` with a `message` derived from the server's `{ error }` JSON body; UI code branches on `error instanceof ApiError ? error.message : "generic fallback"`.
- Inline form/dialog errors render as `<p role="alert" className="text-sm text-destructive">{message}</p>` beneath the form.
- Outcomes of an action that leaves the dialog or page (created, deleted, saved, reprocessing started, failed to delete) use the toast: `import { toast } from "@/components/ui/toast"; toast.add({ title, description, type: "success" | "error" })`. `Toaster` is mounted in `app/layout.tsx`. Mutations that can be triggered from several places (source delete, bulk delete, reprocess) toast from their hook so a bulk action produces one toast. Use `getErrorMessage(error, fallback)` from `shared/lib/api` for the description.

---

## Tailwind v4 Note

Tokens are defined with `@theme inline` + `:root`/`.dark` in `app/globals.css`. There is no `tailwind.config.ts`. Add new design tokens there, not in a config file.

---

## Do Nots

- Don't import Radix UI directly — this project's primitives are `@base-ui/react`-based.
- Don't use `asChild` — use the base-ui `render` prop (and `nativeButton={false}` on `Button` when polymorphic).
- Don't use Tailwind's built-in color classes (`bg-purple-500`, `text-gray-600`, etc.) — use the semantic tokens in `ui-tokens.md`.
- Don't add a new form library (React Hook Form, Formik) — the existing pattern is controlled `useState` fields.
- Don't add a toast library: use the Base UI toast in `components/ui/toast.tsx`.
- Don't add a `useEffect` that only copies props into state. Mount form bodies fresh when a dialog opens (inner form component) or use a `key`.
- Don't use `rounded-3xl` or larger, ALL-CAPS labels, or `text-primary` for text on surfaces that can be light (use `text-primary-ink`).
- Don't call `fetch`/`apiFetch` directly from a component — go through a feature hook.
- Don't build a second sidebar implementation — extend `WorkspaceShell` and `components/ui/sidebar.tsx`.
