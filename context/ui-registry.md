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

Generated shadcn/ui components (style `base-rhea`, built on `@base-ui/react`, icons from `lucide-react`). These are regenerable via the shadcn CLI — prefer using/extending them over writing new low-level primitives.

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
| Carousel | `carousel.tsx` | `embla-carousel-react` wrapper |
| Chart | `chart.tsx` | `recharts` theming wrapper |
| Checkbox | `checkbox.tsx` | Used for bulk-select in Source Library |
| Collapsible | `collapsible.tsx` | Generic expand/collapse |
| Combobox | `combobox.tsx` | Searchable select (`cmdk`-based) |
| Command | `command.tsx` | Command palette primitives (`cmdk`) |
| ContextMenu | `context-menu.tsx` | Right-click menu |
| Dialog | `dialog.tsx` | `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` — used for all "add/create/generate/edit" modals |
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
| ModeToggle | `mode-toggle.tsx` | Light/dark theme toggle (`next-themes`) |
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
| Toast | `toast.tsx` | Toast primitive (present but not currently wired to a global toaster/provider — verify before relying on it) |
| Toggle | `toggle.tsx` | Single toggle button |
| ToggleGroup | `toggle-group.tsx` | Grouped toggle buttons |
| Tooltip | `tooltip.tsx` | Hover tooltip |

`shared/components/streamdown-content.tsx` also lives alongside these — renders `streamdown`-formatted markdown content (used for streamed AI text / report content).

---

## Feature Components

### `features/auth/components/`
| Component | Description |
| --- | --- |
| `LoginForm` (`login-form.tsx`) | Card with Google OAuth plus email/password fields (`Label` + `Input`), inline error, links to signup and forgot-password |
| `SignupForm` (`signup-form.tsx`) | Same card pattern; name/email/password/confirm; Google; post-submit “check your email” state |
| `ForgotPasswordForm` (`forgot-password-form.tsx`) | Email field + generic success copy (does not leak whether the account exists) |
| `ResetPasswordForm` (`reset-password-form.tsx`) | New password + confirm; reads `token` from the query string |
| `SignOutButton` (`sign-out-button.tsx`) | Button that calls `signOut` and redirects to login |
| `GoogleIcon` (`google-icon.tsx`) | Brand SVG for Google buttons (hardcoded hex fills are a logo exception) |

### `features/workspaces/components/`
| Component | Description |
| --- | --- |
| `DashboardHome` (`dashboard-home.tsx`) | Full dashboard page: sticky header (logo, Memory link, theme toggle, sign out), hero + 3-up feature blurb, searchable workspace grid, wires create/edit/delete dialogs |
| `WorkspaceCard` (`workspace-card.tsx`) | Single workspace tile in the dashboard grid with edit/delete actions |
| `CreateWorkspaceCard` (`create-workspace-card.tsx`) | Dashed "create new" tile shown first in the workspace grid |
| `WorkspaceList` (`workspace-list.tsx`) | Alternate/simple list rendering of workspaces (used where the full dashboard grid isn't needed) |
| `WorkspaceFormDialog` (`workspace-form-dialog.tsx`) | Shared create/edit dialog for title, description, icon, default model |
| `DeleteWorkspaceDialog` (`delete-workspace-dialog.tsx`) | Confirmation `AlertDialog` for deleting a workspace, warns about cascading data loss |
| `WorkspaceShell` (`workspace-shell.tsx`) | Sidebar + inset layout wrapping every `/workspace/[id]/*` page — sidebar nav (Chat/Learn/Sources/Settings), embedded `SourceSidebarList`, header with Add Source + `WorkspaceHeaderActions` + sign out |
| `WorkspaceHeaderActions` (`workspace-header-actions.tsx`) | Header-area actions/menu for the active workspace (e.g. quick settings access) |
| `WorkspaceSettingsForm` (`workspace-settings-form.tsx`) | Workspace settings page: title/description/icon/default model fields, danger-zone delete |

### `features/sources/components/`
| Component | Description |
| --- | --- |
| `SourceLibrary` (`source-library.tsx`) | Full source library page: search, type/status filters, grid/list toggle, bulk-select + bulk delete, reprocess-failed action, empty/loading/error states |
| `SourceCard` (`source-card.tsx`) | Grid/list tile for one source — type icon, title, relative date, status badge, content preview snippet, reprocess/delete dropdown |
| `SourceDetail` (`source-detail.tsx`) | Source detail page — header with type/status, original URL or PDF link, processing/failed/empty states, markdown content preview |
| `SourceSidebarList` (`source-sidebar-list.tsx`) | Compact source list rendered inside `WorkspaceShell`'s sidebar, with an "add source" affordance |
| `AddSourceDialog` (`add-source-dialog.tsx`) | Tabbed dialog (Text / Markdown / PDF / Website / YouTube) for creating a source, redirects to the new source's detail page on success |
| `SourceStatusBadge` (`source-status-badge.tsx`) | Small badge mapping `SourceStatus` → label/color |
| `SourceTypeIcon` (`source-type-icon.tsx`) | Maps `SourceType` → a `lucide-react` icon |
| `MarkdownPreview` (`markdown-preview.tsx`) | Renders a source's extracted text/markdown content |

### `features/chat/components/`
| Component | Description |
| --- | --- |
| `WorkspaceChat` (`workspace-chat.tsx`) | Main chat page: conversation switcher, new/export/delete conversation actions, streamed message list (`MessageScroller`), citation-aware message rendering, composer |
| `ChatComposer` (`chat-composer.tsx`) | Message textarea + send button + web-search toggle; submits on Enter (Shift+Enter for newline) |
| `ChatMessageBody` (`chat-message-body.tsx`) | Renders an assistant message's markdown text and inlines numbered `CitationMarker`s at cited positions |
| `CitationMarker` (`citation-marker.tsx`) | Small pill button (`[1]`, `[2]`, …) inline in assistant text; hover reveals a `CitationPreview` |
| `CitationPreview` (`citation-preview.tsx`) | Hover card body showing a citation's source title, excerpt, and a link to the source or URL |
| `CitationSources` (`citation-sources.tsx`) | Row of unique source `Attachment` chips below an assistant message, each with a hover preview and a link to the source detail page or external URL |

### `features/learn/components/`
| Component | Description |
| --- | --- |
| `LearnHub` (`learn-hub.tsx`) | Learning tools page: artifact grid with type/status badges, delete, and the generate dialog |
| `GenerateArtifactDialog` (`generate-artifact-dialog.tsx`) | Dialog to pick an artifact type (with description) and optional custom title, then enqueue background generation |
| `ArtifactDetail` (`artifact-detail.tsx`) | Artifact detail page shell — loads one artifact and renders `ArtifactContentViewer` based on status/type |
| `ArtifactContentViewer` (`artifact-content-viewer.tsx`) | Dispatches an artifact's `content` JSON to the correct type-specific viewer |
| `ArtifactStatusBadge` / `ArtifactTypeBadge` (`artifact-status-badge.tsx`) | Badges mapping `ArtifactStatus`/`ArtifactType` → label |
| `viewers/SummaryViewer` (`summary-viewer.tsx`) | Renders `{ markdown }` via the shared markdown renderer |
| `viewers/TakeawaysViewer` (`takeaways-viewer.tsx`) | Renders `{ items: string[] }` as a bullet list |
| `viewers/FlashcardsViewer` (`flashcards-viewer.tsx`) | Renders `{ cards: { front, back }[] }` as flip/reveal cards |
| `viewers/QuizViewer` (`quiz-viewer.tsx`) | Renders `{ questions: { question, options, correctIndex, explanation }[] }` as an interactive multiple-choice quiz |
| `viewers/MindmapViewer` (`mindmap-viewer.tsx`) | Renders `{ nodes, edges }` as an interactive `@xyflow/react` tree (auto tree-layout, expand/collapse, minimap, "ask in chat" on selected node, full-screen toggle) |
| `viewers/ReportViewer` (`report-viewer.tsx`) | Renders `{ markdown, sections: { title, content }[] }` as a structured long-form report |

### `features/memory/components/`
| Component | Description |
| --- | --- |
| `MemorySettings` (`memory-settings.tsx`) | `/settings/memory` page — lists memories with source (Manual/Learned) and category badges, add/edit/delete |
| `MemoryFormDialog` (`memory-form-dialog.tsx`) | Create/edit dialog for a single memory's text |

### `features/billing/components/`
| Component | Description |
| --- | --- |
| `BillingSettings` (`billing-settings.tsx`) | `/settings/billing` — same settings shell as Memory (`max-w-3xl`, back to dashboard); plan `Badge`, remaining credits, Upgrade / Manage billing |
| `PricingPage` (`pricing-page.tsx`) | Public `/pricing` — two `Card`s (`rounded-3xl`); Pro uses `border-primary`; Free vs Pro CTAs |
| `CreditsBadge` (`credits-badge.tsx`) | Outline `Button` `rounded-full` linking to billing; shows remaining credits |

### CreditsBadge

File: `client/features/billing/components/credits-badge.tsx`
Last updated: 2026-08-29

| Property | Class |
| --- | --- |
| Background | Button `variant="outline"` |
| Border radius | `rounded-full` |
| Text — primary | default button text |
| Spacing | Button `size="sm"` |
| Hover state | outline button hover |
| Shadow | none |
| Accent usage | none |

**Pattern notes:** Pill control like source-library filters. Links to `/settings/billing`. Do not use a `Progress` bar — after a Pro downgrade remaining credits can exceed the Free allowance.

### BillingSettings / MemorySettings page shell

File: `client/features/billing/components/billing-settings.tsx`
Last updated: 2026-08-29

| Property | Class |
| --- | --- |
| Background | page `bg` default; content `Card` |
| Border | `Card` default border |
| Border radius | card default (`rounded-2xl` / design system) |
| Text — primary | `font-heading text-2xl font-semibold` on `h1` |
| Text — secondary | `text-sm text-muted-foreground` |
| Spacing | `mx-auto max-w-3xl … p-6 md:p-10`, header `gap-8` |
| Hover state | ghost back button |
| Shadow | none |
| Accent usage | plan `Badge` default vs `secondary` |

**Pattern notes:** Match `MemorySettings` — ghost back `Button` + `Link` to dashboard, lucide title icon, `Card` for the main block. Destructive/error copy is `text-sm text-destructive`.

### PricingPage cards

File: `client/features/billing/components/pricing-page.tsx`
Last updated: 2026-08-29

| Property | Class |
| --- | --- |
| Background | `Card` |
| Border | default; featured Pro `border-primary` |
| Border radius | `rounded-3xl` |
| Text — primary | `font-heading` title and price |
| Text — secondary | `CardDescription`, `text-muted-foreground` on `/month` |
| Spacing | `max-w-5xl`, `p-6 md:p-10`, `gap-6` grid |
| Hover state | none on the card itself |
| Shadow | featured `shadow-sm` |
| Accent usage | `text-primary` on feature check icons; `border-primary` on Pro |

**Pattern notes:** Two-up grid of cards, not a table. Check rows use `CheckIcon` + `text-primary`. Do not introduce a third tier card.

---

## Notes for New Components

- Match the existing "page component owns data fetching + dialogs, dumb sub-components render props" split seen in `SourceLibrary`/`LearnHub`/`DashboardHome`.
- New badges should follow `SourceStatusBadge`/`ArtifactStatusBadge` — a small lookup-table component mapping an enum to a `Badge` variant/label, not inline conditional classNames scattered through the parent.
- New dialogs should follow `Dialog` + controlled `open`/`onOpenChange` props from the parent (never manage a dialog's own open state internally when a parent needs to trigger it).
