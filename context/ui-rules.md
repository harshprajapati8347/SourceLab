# UI Rules

Concise, observed conventions for building SourceLab UI. These are inferred from consistent patterns across `client/features/*` and `client/components/ui` — match them rather than inventing new patterns.

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

- Body/UI text uses the default (`font-mono` on `<html>`, i.e. JetBrains Mono) — don't add a font class for normal body copy.
- Apply `font-heading` explicitly on page titles, section headings, and card titles:

```tsx
<h1 className="font-heading text-2xl font-semibold tracking-tight">Your notebooks</h1>
<h2 className="font-heading text-xl font-semibold">Learning tools</h2>
```

- Don't introduce new fonts. Fonts are registered once in `client/app/layout.tsx` via `next/font/google`.

---

## Layout

- Content max-widths are chosen per context, not globally fixed: `max-w-3xl` for chat/message columns, `max-w-2xl` for single-column forms/settings, `max-w-6xl` for the dashboard.
- Page-level padding is `p-6` on mobile, bumped to `p-6 md:p-8` or `px-4 md:px-8` for wider pages.
- Sticky headers/toolbars use `h-14` and `border-b`, often with `bg-background/80 backdrop-blur-md` when they float over scrollable content (dashboard header).
- Inside a workspace, layout is **sidebar + inset**, built from `components/ui/sidebar.tsx` (`SidebarProvider` → `Sidebar` + `SidebarInset`) — don't build a second custom sidebar; extend the existing `WorkspaceShell`.
- The dashboard and settings pages use a simple centered/top-header layout with **no sidebar**.

---

## Cards

Use the shadcn `Card` primitives (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`) for structured content (e.g. `SourceCard`, `LoginForm`). For lighter-weight custom "card-like" containers (list items, empty states, artifact tiles), the observed pattern is a plain `div` with:

```
rounded-2xl (or rounded-3xl for larger surfaces) border bg-card p-4 (or p-6)
```

Hover-interactive cards add `transition-shadow hover:shadow-md` or `hover:bg-muted/20`. Destructive/danger sections use `border-destructive/30` (or `/40`) with a matching `bg-destructive/5` background — never a solid destructive card background.

---

## Empty States

Use the shared `Empty` / `EmptyHeader` / `EmptyTitle` / `EmptyDescription` / `EmptyContent` primitives (`components/ui/empty.tsx`) for genuinely empty-but-styled states (no results, API error). For lighter inline "nothing here yet" placeholders inside a feature (e.g. Learn hub, Memory settings before any data exists), the repeated pattern is:

```tsx
<div className="rounded-2xl border border-dashed p-10 text-center">
  <p className="font-medium">No {thing} yet</p>
  <p className="mt-2 text-sm text-muted-foreground">Helpful next-step copy.</p>
  <Button className="mt-4" onClick={...}>
    <PlusIcon />
    Primary action
  </Button>
</div>
```

Loading states use `Skeleton` components sized to roughly match the eventual content (e.g. `h-32 rounded-3xl` for a card grid, `h-16 w-2/3 rounded-3xl` for a chat bubble).

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

- Pill-shaped filter/toggle controls (search bar, view toggle, filter dropdowns) explicitly add `rounded-full` on top of the button's default `rounded-2xl`.

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
- Inline form/dialog errors render as `<p className="text-sm text-destructive">{message}</p>` beneath the form, not as toasts (no toast/sonner library is wired up despite a `toast.tsx` primitive existing in `components/ui` — check before assuming it's active).

---

## Tailwind v4 Note

Tokens are defined with `@theme inline` + `:root`/`.dark` in `app/globals.css`. There is no `tailwind.config.ts`. Add new design tokens there, not in a config file.

---

## Do Nots

- Don't import Radix UI directly — this project's primitives are `@base-ui/react`-based.
- Don't use `asChild` — use the base-ui `render` prop (and `nativeButton={false}` on `Button` when polymorphic).
- Don't use Tailwind's built-in color classes (`bg-purple-500`, `text-gray-600`, etc.) — use the semantic tokens in `ui-tokens.md`.
- Don't add a new form library (React Hook Form, Formik) — the existing pattern is controlled `useState` fields.
- Don't add a toast/notification library without checking what's already installed and used.
- Don't call `fetch`/`apiFetch` directly from a component — go through a feature hook.
- Don't build a second sidebar implementation — extend `WorkspaceShell` and `components/ui/sidebar.tsx`.
