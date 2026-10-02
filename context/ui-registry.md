# UI Registry

Living inventory of UI in this project. Read this before building any new component — reuse an existing primitive or feature component instead of duplicating one, and match its patterns. Update this file whenever a component is added, renamed, or removed.

---

## How to Use

1. Check the tables below for something that already does what you need.
2. If a base primitive exists in `components/ui/`, use it — don't hand-roll a replacement.
3. If a feature component already covers the pattern (e.g. an empty state, a card, a status badge), match its structure and class usage.
4. If you build something new, add a row to the relevant table with its file path and a one-line description.

---

## Base Primitives (`client/components/ui/`)

Generated shadcn/ui components, retuned to the amber/Manrope identity (radius, borders instead of rings, focus rings) (style `base-rhea`, built on `@base-ui/react`, icons from `lucide-react`). These are regenerable via the shadcn CLI — prefer using/extending them over writing new low-level primitives.

| Component | File | Notes |
| --- | --- | --- |
| Accordion | `accordion.tsx` | Collapsible sections |
| Alert | `alert.tsx` | Static inline notice banner |
| AlertDialog | `alert-dialog.tsx` | Confirmation dialog for destructive actions (delete source, delete workspace) |
| AspectRatio | `aspect-ratio.tsx` | Fixed aspect-ratio container |
| Attachment | `attachment.tsx` | File/source "chip" — icon + title + description, used for chat citation source chips |
| Avatar | `avatar.tsx` | Circular image/fallback |
| Badge | `badge.tsx` | Small status/label pill |
| Breadcrumb | `breadcrumb.tsx` | Breadcrumb trail |
| Bubble | `bubble.tsx` | Chat message bubble container (`variant`, `align`) |
| Button | `button.tsx` | CVA variants: default/outline/secondary/ghost/destructive/link; sizes xs/sm/default/lg/icon(-xs/-sm/-lg) |
| ButtonGroup | `button-group.tsx` | Grouped buttons with shared border radius |
| Calendar | `calendar.tsx` | Date picker grid (`react-day-picker`) |
| Card | `card.tsx` | `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` |
| Chart | `chart.tsx` | `recharts` theming wrapper |
| Checkbox | `checkbox.tsx` | Used for bulk-select in Source Library |
| Collapsible | `collapsible.tsx` | Generic expand/collapse |
| Combobox | `combobox.tsx` | Searchable select (`cmdk`-based) |
| Command | `command.tsx` | Command palette primitives (`cmdk`) |
| ContextMenu | `context-menu.tsx` | Right-click menu |
| Dialog | `dialog.tsx` | `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`; `rounded-2xl`, scrolls inside `100dvh - 2rem`. Form dialogs put the form in an inner component mounted per open |
| Direction | `direction.tsx` | RTL/LTR direction provider |
| Drawer | `drawer.tsx` | Bottom/side sheet on mobile |
| DropdownMenu | `dropdown-menu.tsx` | `DropdownMenu`/`Trigger`/`Content`/`Item`/`Separator` |
| Empty | `empty.tsx` | `Empty`/`EmptyHeader`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` — styled empty/error states |
| Field | `field.tsx` | `Field`/`FieldGroup`/`FieldDescription`/`FieldSeparator` — used in `LoginForm` |
| HoverCard | `hover-card.tsx` | Used for citation preview popovers |
| Input | `input.tsx` | Text input |
| InputGroup | `input-group.tsx` | Input with adjacent icon/button |
| InputOTP | `input-otp.tsx` | OTP code input |
| Item | `item.tsx` | Generic list item layout primitive |
| Kbd | `kbd.tsx` | Keyboard shortcut hint |
| Label | `label.tsx` | Form label |
| Marker | `marker.tsx` | `Marker`/`MarkerIcon`/`MarkerContent` — labeled separator (used above chat citation source chips) |
| Menubar | `menubar.tsx` | Desktop-style menu bar |
| Message | `message.tsx` | `Message`/`MessageAvatar`/`MessageContent`/`MessageFooter`/`MessageGroup` — chat message layout |
| MessageScroller | `message-scroller.tsx` | Auto-scrolling chat viewport with scroll-to-bottom button |
| NativeSelect | `native-select.tsx` | Native `<select>` styled to match `Select` |
| NavigationMenu | `navigation-menu.tsx` | Top-level nav menu (not currently used in app routes) |
| Pagination | `pagination.tsx` | Page number controls |
| Popover | `popover.tsx` | Generic floating panel |
| Progress | `progress.tsx` | Progress bar |
| RadioGroup | `radio-group.tsx` | Radio button group |
| Resizable | `resizable.tsx` | Resizable panel group (`react-resizable-panels`) |
| ScrollArea | `scroll-area.tsx` | Styled scroll container |
| Select | `select.tsx` | `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` — used for conversation switcher, filters, model pickers |
| Separator | `separator.tsx` | Horizontal/vertical divider |
| Sheet | `sheet.tsx` | Slide-in side panel |
| Sidebar | `sidebar.tsx` | Full app sidebar system (`SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarInset`, `SidebarTrigger`, `SidebarRail`) — powers `WorkspaceShell` |
| Skeleton | `skeleton.tsx` | Loading placeholder block |
| Slider | `slider.tsx` | Range slider |
| Spinner | `spinner.tsx` | Loading spinner, used inline in pending buttons |
| Switch | `switch.tsx` | Toggle switch |
| Table | `table.tsx` | Data table primitives |
| Tabs | `tabs.tsx` | `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` — used in `AddSourceDialog` |
| Textarea | `textarea.tsx` | Multi-line text input |
| Toast | `toast.tsx` | Base UI toast. `Toaster` is mounted in `app/layout.tsx`; call `toast.add({ title, description, type })` |
| Toggle | `toggle.tsx` | Single toggle button |
| ToggleGroup | `toggle-group.tsx` | Grouped toggle buttons |
| Tooltip | `tooltip.tsx` | Hover tooltip |

`shared/components/streamdown-content.tsx` also lives alongside these — renders `streamdown`-formatted markdown content (used for streamed AI text / report content).

---

## Feature Components

### `shared/components/`
| Component | Description |
| --- | --- |
| `BrandMark` (`brand-mark.tsx`) | The SourceLab mark (amber tile, three text lines, a citation dot) with optional wordmark. `size` sm/md/lg. Replaces every emoji logo |
| `PageHeader` (`page-header.tsx`) | The `h1`, description, and right-hand actions row at the top of a workspace page |
| `ShortcutsDialog` (`shortcuts-dialog.tsx`) | `?` dialog listing the keyboard shortcuts. Open state in `ui-store` |
| `CitedAnswerPreview` (`cited-answer-preview.tsx`) | Static, decorative example of a cited answer with source chips (landing hero, sign-in panel) |
| `StreamdownContent` (`streamdown-content.tsx`) | Markdown renderer used for streamed text and artifact bodies |

State and hooks: `shared/stores/ui-store.ts` (command palette, shortcuts dialog, create-notebook dialog, add-source dialog, sources panel/sheet; only the desktop panel flag is persisted), `shared/hooks/use-keyboard-shortcuts.ts` (`useKeyboardShortcuts`, `useModKeyLabel`), `shared/hooks/use-mobile.ts`, `shared/hooks/use-debounced-value.ts`.

### `features/auth/components/`
| Component | Description |
| --- | --- |
| `LoginForm` (`login-form.tsx`) | Card with Google OAuth plus email/password fields, inline `role="alert"` error, links to signup and forgot-password |
| `SignupForm` (`signup-form.tsx`) | Same card pattern; name/email/password/confirm; Google; post-submit "check your email" state |
| `ForgotPasswordForm` (`forgot-password-form.tsx`) | Email field + generic success copy (does not leak whether the account exists) |
| `ResetPasswordForm` (`reset-password-form.tsx`) | New password + confirm; reads `token` from the query string |
| `UserMenu` (`user-menu.tsx`) | Avatar dropdown: account name, Billing, Memory, Keyboard shortcuts, Light/Dark/System theme, Sign out. The only place the theme and sign-out live in the app |
| `GoogleIcon` (`google-icon.tsx`) | Brand SVG for Google buttons (hardcoded hex fills are a logo exception) |

Hook: `useSignOut` (`hooks/use-sign-out.ts`). `app/(auth)/layout.tsx` is a split layout: a forced-dark brand panel with `CitedAnswerPreview` beside the form.

### `features/workspaces/components/`
| Component | Description |
| --- | --- |
| `DashboardHome` (`dashboard-home.tsx`) | Dashboard: `AppHeader`, greeting, stat strip (notebooks, credits, plan), searchable notebook grid, create/edit/delete dialogs, toasts |
| `AppHeader` (`app-header.tsx`) | Top bar outside a notebook: brand, search trigger (Cmd/Ctrl+K), `CreditsBadge`, `UserMenu` |
| `AccountShell` (`account-shell.tsx`) | Frame for billing and memory: `AppHeader`, back link, `PageHeader`, content |
| `WorkspaceCard` (`workspace-card.tsx`) | Notebook tile: icon tile, title (stretched link), description, updated-at footer with arrow nudge, edit/delete menu |
| `CreateWorkspaceCard` (`create-workspace-card.tsx`) | Dashed "New notebook" tile |
| `WorkspaceFormDialog` (`workspace-form-dialog.tsx`) | Create/edit dialog (title, description, icon radiogroup). The form body is an inner component mounted per open |
| `DeleteWorkspaceDialog` (`delete-workspace-dialog.tsx`) | `AlertDialog` that names what is lost |
| `WorkspaceShell` (`workspace-shell.tsx`) | Sidebar + inset frame for `/workspace/[id]/*`: header (title, search, model picker, credits, sources toggle, `UserMenu`), right sources panel / sheet, add-source dialog, `AppOverlays`. Mounted by the route layout |
| `WorkspaceSidebar` (`workspace-sidebar.tsx`) | Recessed sidebar: brand, notebook nav (Chat, Learn, Sources, Settings) with the amber active tick, `WorkspaceSwitcher`, "All notebooks" |
| `WorkspaceSwitcher` (`workspace-switcher.tsx`) | Searchable notebook list in the sidebar; "+" opens the create dialog |
| `WorkspaceHeaderActions` (`workspace-header-actions.tsx`) | Per-notebook chat model picker |
| `WorkspaceSettingsForm` (`workspace-settings-form.tsx`) | Settings page: fields, dirty-aware save, danger zone |
| `CommandPalette` (`command-palette.tsx`) | `cmdk` palette: notebooks, this notebook's sources, navigation, account, theme |
| `AppOverlays` (`app-overlays.tsx`) | Mounts the palette and shortcuts dialog and registers the shortcuts once per shell |

### `features/sources/components/`
| Component | Description |
| --- | --- |
| `SourceLibrary` (`source-library.tsx`) | Sources page: `PageHeader`, pill filters, grid/list toggle, select mode with bulk delete (confirmed), "Retry n failed" |
| `SourceCard` (`source-card.tsx`) | Source tile (grid or list `layout`): type tile, title (stretched link), preview, status badge, actions menu |
| `SourceDetail` (`source-detail.tsx`) | Source page: status, link or PDF, processing/failed (with Try again)/empty states, Markdown preview |
| `SourcesPanel` (`sources-panel.tsx`) | Compact `w-80` source list beside chat and learn (rows, indexing/failed state, add button, library link) |
| `AddSourceDialog` (`add-source-dialog.tsx`) | Tabbed dialog (Text / Markdown / PDF / Website / YouTube). One `<form>` per tab so Enter submits; stays on the page and toasts with an "Open" action |
| `SourceStatusBadge` (`source-status-badge.tsx`) | Status to icon + label: pending (clock), processing (spinner), ready (check, amber tint), failed (alert, destructive) |
| `SourceTypeIcon` (`source-type-icon.tsx`) | Maps `SourceType` to a `lucide-react` icon |
| `MarkdownPreview` (`markdown-preview.tsx`) | Renders a source's extracted text |

### `features/chat/components/`
| Component | Description |
| --- | --- |
| `WorkspaceChat` (`workspace-chat.tsx`) | Chat page: conversation switcher, new/export/delete (confirmed) actions, message list, "Searching your sources" wait state, composer. Guardrail-blocked messages come back through `InputBlockedError` and `useChat`'s `onError` |
| `ChatComposer` (`chat-composer.tsx`) | Auto-growing textarea in a focus-ring box, web-search toggle, send button, shortcut hints. Carries `data-chat-input` for Cmd/Ctrl+/ |
| `ChatEmptyState` (`chat-empty-state.tsx`) | Empty thread: no sources gives an "Add your first source" action; otherwise starter prompt chips |
| `SourceStatusBanner` (`source-status-banner.tsx`) | Non-blocking strip above the composer for indexing or failed sources |
| `ChatMessageBody` (`chat-message-body.tsx`) | Assistant Markdown with inline `CitationMarker`s |
| `CitationMarker` (`citation-marker.tsx`) | Mono amber chip (`[1]`) with a hover `CitationPreview` |
| `CitationPreview` (`citation-preview.tsx`) | Hover card: source, excerpt, open link, "Save to library" for web results (with toast) |
| `CitationSources` (`citation-sources.tsx`) | Unique source chips under an assistant reply |
| `RagTracePanel` (`rag-trace-panel.tsx`) | "How this answer was found" accordion above the reply, with expandable steps |

### `features/learn/components/`
| Component | Description |
| --- | --- |
| `LearnHub` (`learn-hub.tsx`) | Study tools page: artifact tiles with type icon + status, confirmed delete, generate dialog |
| `GenerateArtifactDialog` (`generate-artifact-dialog.tsx`) | Format radiogroup, optional title, "Uses 1 credit". Inner form mounted per open |
| `ArtifactDetail` (`artifact-detail.tsx`) | Artifact page: loading, not found, failed, generating, and viewer states |
| `ArtifactContentViewer` (`artifact-content-viewer.tsx`) | Dispatches to the viewer; wraps in `MotionConfig reducedMotion="user"` and remounts on regeneration |
| `ArtifactTypeIcon` / `ArtifactStatusBadge` / `ArtifactTypeBadge` | Icon per type; status badge with icon; type label badge |
| `viewers/*` | Summary, takeaways, flashcards (flip cards), quiz, mind map (`@xyflow/react`), report |

### `features/memory/components/`
| Component | Description |
| --- | --- |
| `MemorySettings` (`memory-settings.tsx`) | `/settings/memory` in `AccountShell`: memory list with "Added by you" / "Learned" badges, add/edit, confirmed delete |
| `MemoryFormDialog` (`memory-form-dialog.tsx`) | Create/edit dialog; inner form mounted per open |

### `features/billing/components/`
| Component | Description |
| --- | --- |
| `BillingSettings` (`billing-settings.tsx`) | `/settings/billing` in `AccountShell`: plan badge, credits left, Upgrade / Manage billing / Compare plans |
| `PricingPage` (`pricing-page.tsx`) | Two plan `Card`s. Standalone `/pricing` adds a slim header; `embedded` is the landing section |
| `CreditsBadge` (`credits-badge.tsx`) | Outline pill linking to billing with remaining credits |

### `features/landing/components/`
| Component | Description |
| --- | --- |
| `LandingPage` (`landing-page.tsx`) | Signed-out `/`: one `dark landing-page` wrapper (always dark) around nav, hero, bands, pricing, footer |
| `LandingNav` (`landing-nav.tsx`) | Fixed bar with scroll blur, `BrandMark`, section links, mobile `Sheet`, Sign in / Create a notebook |
| `LandingHero` (`landing-hero.tsx`) | Title, lede, actions, and the `CitedAnswerPreview` |
| `LandingFeatures`, `LandingStudy`, `LandingUseCases`, `LandingHowItWorks` | Content bands |
| `LandingFooter`, `LandingSectionHeader` | Footer and the centred section heading |

---

## Pattern Notes

### Notebook, source, and artifact cards

Files: `workspace-card.tsx`, `source-card.tsx`, `learn-hub.tsx`
Last updated: 2026-10-02

| Property | Class |
| --- | --- |
| Background | `bg-card` |
| Border | `border`, hover `hover:border-primary/40` |
| Border radius | `rounded-xl` |
| Text | title `font-heading text-sm|base font-semibold`, meta `text-xs text-muted-foreground` |
| Spacing | `p-4`, footer `border-t pt-3` |
| Hover state | border shifts toward amber; `ArrowUpRight` nudges `-translate-y-0.5 translate-x-0.5` |
| Shadow | none |
| Accent usage | amber only on the hover border and the arrow (`text-primary-ink`) |

**Pattern notes:** Stretched link on the title (`after:absolute after:inset-0`), actions on `relative z-10`. Icon tile is `size-9|10 rounded-lg border bg-muted`.

### Composer

File: `chat-composer.tsx`
Last updated: 2026-10-02

| Property | Class |
| --- | --- |
| Background | `bg-card` box on a `bg-background/90 backdrop-blur-md` footer |
| Border | `border`, `focus-within:border-primary focus-within:ring-1 focus-within:ring-primary` |
| Border radius | `rounded-xl` |
| Spacing | `p-3 sm:p-4`, `max-w-3xl` |
| Accent usage | focus ring and send button |

**Pattern notes:** Never disable the box for indexing; use `SourceStatusBanner`. Textarea grows to `max-h-44`.

### Landing and sign-in brand panel

Files: `landing-page.tsx`, `app/(auth)/layout.tsx`
Last updated: 2026-10-02

The wrapper carries `dark` so every token resolves to the dark set; `.landing-page` in `globals.css` only sets background, colour, and `color-scheme`. Portalled content (the mobile `Sheet`) needs its own `dark` class. Nav links hide below 900px and the sheet carries them. The theme switch is intentionally absent on the landing page.

### RagTracePanel

File: `client/features/chat/components/rag-trace-panel.tsx`
Last updated: 2026-10-02

| Property | Class |
| --- | --- |
| Background | `bg-muted/30` (accordion) |
| Border | `border` |
| Border radius | `rounded-xl` |
| Text | trigger `text-xs`; step label `text-sm`; summary `text-sm text-muted-foreground`; expanded lines `text-xs text-muted-foreground` |
| Hover state | `hover:bg-muted/60` on a step that can expand |
| Accent usage | `bg-primary` dot on a finished step; `Spinner` on the active step |

**Pattern notes:** Sits above the assistant reply, not inside it. Finished steps use `Collapsible`. Do not put pipeline values into the answer text.

---

## Notes for New Components

- Match the existing "page component owns data fetching + dialogs, dumb sub-components render props" split seen in `SourceLibrary`/`LearnHub`/`DashboardHome`.
- New badges should follow `SourceStatusBadge`/`ArtifactStatusBadge` — a small lookup-table component mapping an enum to a `Badge` variant/label, not inline conditional classNames scattered through the parent.
- New dialogs should follow `Dialog` + controlled `open`/`onOpenChange` props from the parent (never manage a dialog's own open state internally when a parent needs to trigger it).
