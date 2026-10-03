# Progress Tracker

Snapshot of what's actually implemented in the codebase today, based on reading the code (not a maintained changelog — update this after every feature going forward).

---

## Current Status

**Phase:** Auth (Google + email/password), workspaces, sources/RAG, chat with query and context intelligence, learning artifacts, memory, billing (Stripe Pro) + credits.
**Last completed:** Global top progress bar on client pathname changes (links, programmatic push/replace, back/forward). In-page skeletons and button spinners are unchanged.
**Next:** Operator setup — Resend domain, Stripe test Product/Price (`STRIPE_PRO_PRICE_ID`), webhook to Express `/api/auth/stripe/webhook`. See `context/billing-and-credits.md`.

---

## Implemented

### Auth
- [x] Google OAuth via Better Auth (server-mounted at `/api/auth/*`, Prisma adapter)
- [x] Email + password sign-up/sign-in (verification required; Resend, console fallback)
- [x] Password reset (request + reset pages)
- [x] Session-based route protection (`requireAuth()` on protected pages, `requireAuth` middleware on protected API routes)
- [x] Sign-in / sign-out UI

### Billing and credits
- [x] Better Auth Stripe plugin — single Pro plan (`STRIPE_PRO_PRICE_ID`), `createCustomerOnSignUp`
- [x] `/pricing` and `/settings/billing` (checkout + billing portal)
- [x] `User.credits` / `User.plan` with Inngest lifecycle from Stripe webhooks
- [x] Atomic credit deduction for chat (0.1), artifacts (1), and successful source processing (1)
- [x] Credits badge in dashboard, workspace header, chat composer, and generate-artifact dialog

### Workspaces
- [x] Create / list / search (debounced, client-side) / update / delete
- [x] Delete cascades to sources, conversations, artifacts (Prisma cascade) and best-effort deletes the Pinecone namespace
- [x] Per-workspace settings: title, description, icon, default chat model
- [x] Dashboard grid UI with empty/loading/error states

### App chrome
- [x] Global top progress bar while a client navigation changes the pathname. Same-pathname updates (including chat stripping `?ask=`) do not start it

### Sources
- [x] Five ingestion types: Text, Markdown, PDF upload (Cloudinary), Website (Firecrawl), YouTube (transcript)
- [x] Additional web-search-to-source import endpoint (`/import/web-search`)
- [x] Background processing pipeline (Inngest): extract → chunk → embed → index, with status tracking (`PENDING → PROCESSING → READY/FAILED`)
- [x] Reprocess a single failed source, or bulk-reprocess all failed sources
- [x] Source library: search, type filter, status filter, grid/list view toggle, multi-select bulk delete. The grid is one column below `sm`, and cards stay within that column.
- [x] Source detail page with extracted content preview, chunk count, processing/failed states
- [x] Live polling (3s) while a source is pending/processing

### Chat (RAG)
- [x] Multi-conversation per workspace, streamed responses (AI SDK)
- [x] RAG retrieval from Pinecone (per-workspace namespace, score-thresholded top-K)
- [x] Inline numbered citations with hover previews. Workspace citations open the cited passage (`?chunk=`), including the PDF page. Web citations open the external URL
- [x] Model selection per workspace (`gpt-4o-mini` / `gpt-4o`), persisted client-side per workspace
- [x] Optional web search tool (Tavily), with `[W#]` citations
- [x] Rolling conversation summarization every 8 messages, feeding both the chat context window and Mem0
- [x] Mem0 long-term memory: recalled into chat context, auto-learned from conversations
- [x] Conversation delete, "new chat", markdown export
- [x] Opening a notebook resumes its latest chat. A new chat is created only from New Chat, or when the notebook has no chats
- [x] A conversation stops at 10 stored messages and asks the user to start a new chat. The server rejects the next turn before retrieval or credit deduction
- [x] Deep-link into chat with a pre-filled question (`?ask=...`, used by the mind map viewer's "ask in chat")
- [x] Input guardrails (`@openai/guardrails`) before RAG: moderation, jailbreak, off-topic, and blocking PII for payment credentials. A block returns the original message and restores it in the composer. Document questions and current external questions with web search on are not blocked as Off Topic. A request to obey instructions inside a document keeps the safe task and says those instructions were not followed.
- [x] A workspace subject with a missing fact is answered as insufficient evidence, without inventing the fact. An explicit numeric conflict keeps both values. Web answers expose `[W#]` source links.
- [x] Query classification and routing (rewrite, HyDE, sub-questions, multi-query) before Pinecone retrieval
- [x] Retrieval-quality gate (relevance, coverage, freshness, authority, duplication) with one corrective pass, and Tavily only when web search is already enabled
- [x] Semantic dedup, extractive context compression, and contradiction notes passed into the system prompt with source authority and indexed time
- [x] Pipeline trace logged on the server and stored on the assistant message. The chat panel is shown only when `RAG_TRACE_ENABLED=true`.
- [x] Output guardrails after generation: PII masking, grounding and citation checks against retrieved chunks and web snippets, moderation, and secret-key redaction. A cited paraphrase is kept. A missing citation, or an email, phone, number, or name the passage does not contain, is removed. The canned refusal is used only when the reply cites nothing retrieved. Credentials are masked in place. Coverage is a pipeline step when the trace is enabled.

### Learning Artifacts ("Learn")
- [x] Six types: Summary, Takeaways, Flashcards, Quiz, Mind Map, Report
- [x] Background generation (Inngest) over all/selected READY sources
- [x] Per-type structured schema (Zod) and dedicated viewer, including an interactive `@xyflow/react` mind map with auto-layout, collapse/expand, and minimap
- [x] Artifact list with status/type badges, delete

### Memory
- [x] Cross-workspace personal memory via Mem0 (manual create/edit/delete + auto-learned)
- [x] Memory settings page with source/category badges

### UI / Design System
- [x] Tailwind v4 token system (`@theme inline`, oklch colors, radius scale) — no `tailwind.config.ts`
- [x] shadcn/ui component set on `@base-ui/react` primitives (not Radix)
- [x] Dark mode (`next-themes`)
- [x] Consistent empty/loading/error state patterns across features
- [x] Signed-out landing page at `/` (always dark, pricing embedded). Signed-in visitors still redirect to `/dashboard`.
- [x] Revamped identity from `docs/frontend-design/`: oklch near-black ramp + one amber accent (`primary`, `primary-ink` for text), Manrope + JetBrains Mono (data only), 10px radius base, `ease-house` motion, reduced-motion support, light and dark themes
- [x] Workspace shell mounted once by `workspace/[id]/layout.tsx`: recessed sidebar (nav + searchable notebook list), translucent header, right-hand sources panel (sheet on mobile)
- [x] Mobile workspace header includes a Home icon linking to `/` (hidden from the `md` breakpoint up)
- [x] Command palette (Cmd/Ctrl+K) over notebooks, sources and actions; shortcuts dialog (`?`); shortcuts mounted per shell
- [x] `UserMenu` (billing, memory, theme, shortcuts, sign out); `Toaster` wired for create/delete/save/reprocess outcomes; bulk source actions give one toast
- [x] Chat: auto-growing composer, non-blocking source status banner, starter prompts, delete-conversation confirmation, guardrail restore via `InputBlockedError`
- [x] Split sign-in layout with a brand panel; standalone `/pricing` header

### Deploy
- [x] Production Dockerfile (`server/Dockerfile.prod`) — Prisma generate + `migrate deploy` on boot, Node heap cap
- [x] `docker-compose.prod.yml` — pull pre-built Docker Hub image, 360 MB memory limit, healthcheck (no Postgres on the app host)
- [x] GitHub Actions (`.github/workflows/deploy-server.yml`) — build/push on `main`, SCP compose file, SSH pull + recreate
- [x] EC2 bootstrap + production env template under `deploy/`

---

## In Progress / Partial

- **Analytics/dashboard charts** — `recharts` and a `chart.tsx` primitive are installed and present, but no feature currently renders a chart. Unclear if this is planned or dead weight (see `build-plan.md`).

## Not Started

- Automated tests (unit, integration, or e2e) — none exist in the repo
- Artifact editing after generation (currently delete + regenerate only)
- Pagination on the source library (loads the full list per workspace)
- OAuth providers other than Google (email/password is implemented)
- Team/shared/multi-user workspaces

---

## Known Issues

- Dev-only: React 19 logs "Encountered a script tag" from `next-themes`' inline script in the console (no effect in production).
- Unused generated shadcn primitives remain in `components/ui` (alert, aspect-ratio, breadcrumb, button-group, calendar, chart, combobox, context-menu, direction, drawer, input-otp, item, menubar, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, slider, switch, table, toggle-group). `embla-carousel-react` is now unused after removing `carousel.tsx`.

---

## Decisions Made During Build

- **Orphan cleanup kept `client/lib/utils.ts`** — it is the live `cn()` helper imported by shadcn primitives and feature components; `client/app/(auth)/layout.tsx` is also live (login page wrapper), not a duplicate.
- **Tavily and Mem0 remain optional env vars** — documented in `server/.env.example` with comments that missing keys degrade those features to no-ops rather than failing startup.
- **512 MB EC2 host runs only the API container** — Postgres is managed (Neon/Supabase/RDS); images are built on GitHub Actions and pulled from Docker Hub; a 1 GB swap file is required.
- **Credits are `Decimal(12, 1)` on `User`** — chat costs 0.1; artifacts and processed sources cost 1. No ledger table.
- **Pro is ₹499/month INR, 500 credits per period** — Free is 10 credits one-time. Both tiers have the same product surface; usage is gated on credits, not `plan === "pro"`.
- **Pro cancellation stays Pro until Stripe deletes the subscription** — `User.plan` flips to `free` only then; leftover credits are kept.
- **Stripe webhooks must hit Express `:8080` (or the API host)** — not the Next.js rewrite — so signature verification sees the raw body.
- **Chat input guardrails sit in front of `streamText`** — `@openai/guardrails` checks the latest user message only. A block returns JSON 400 and does not create a conversation, charge credits, or start the AI SDK stream. PII blocking is limited to payment credentials (`CREDIT_CARD`, `CVV`, `IBAN_CODE`, `BIC_SWIFT`, `CRYPTO`).
- **Output guardrails run after generation and before the reply is sent** — the model stream stays on the server. PII in the answer and citation excerpts is masked, including Indian phone numbers such as `+91 98765 43210`. A phone is PII, not a secret key. A grounding check removes a sentence when its citation is missing, or when the cited passage does not contain the claimed email, phone, number, or a name later in the sentence. A faithful paraphrase that cites a retrieved chunk or web result is kept. The first word of a sentence is not treated as a name. The canned refusal is used only when the reply cites nothing retrieved. A real credential is replaced with `<SECRET>` and the rest of the answer stays. Moderation can still replace the whole reply. Coverage is a pipeline step. The extra judge call stays inside the 0.1 credit. Learning artifacts are unchanged. Retrieval rewrites may search for a missing field, and they do not instruct the search to infer it.
- **Overview questions sample each ready source** — a summarization query takes the opening chunk of each READY source, then more passages until the character budget, merged with semantic hits. The similarity gate does not start a second search for that class.
- **Web markers are one list** — prefetched results and later `web_search` calls append by URL. A later search continues `[W#]` numbering instead of starting again at `[W1]`.
- **The pipeline trace is operator-only** — `RAG_TRACE_ENABLED=true` streams it and returns it from the message API. Otherwise the panel is absent. The trace is still stored on the message.
- **Query and context intelligence is chat-only and stays inside the 0.1 credit** — classification, HyDE, and the coverage judgement use `gpt-4o-mini`. Authority comes from source type unless `metadata.authority` is already set. Contradiction is shown to the model and is not part of the 0.55 gate. Learning artifacts are unchanged. Each step is printed as `[rag]` console lines and stored on `Message.trace` for the chat pipeline panel.
- **A question the sources do not cover gets a next step** — the reply names the missing topic and what the notebook focuses on, then offers web research when the toggle is on. A short yes runs that search. The latest reply also shows at most three short follow-up questions from the notebook or the current answer. They are stored on the message trace and still returned when the pipeline panel is hidden.

- **Amber is a fill, not a text colour** — `text-primary-ink` carries amber text so light mode keeps AA contrast. The docs' hard-coded hex values, forced dark theme, Clerk, and ChaibookLM-only features (favorites, archive, admin logs, podcast, dashboard storage stats) were not copied.
- **Chat is never gated by indexing** — the docs lock chat until every source is ready. SourceLab keeps the composer enabled and shows `SourceStatusBanner` instead, since the backend answers from whatever is already indexed.
- **Top progress bar is pathname navigation only** — a 2px `bg-primary` bar fixed to the viewport (`NavigationProgress`). It starts on `next/link`, `useAppRouter` push/replace, and back/forward, waits 150ms so fast navigations stay invisible, trickles until `usePathname()` changes, and gives up after 8s if the route never commits. Skeletons, spinners, toasts, polling, and chat streaming are not wired to it. `components/ui/progress.tsx` stays the unused form control.
- **A notebook opens its latest chat** — reload, returning from Sources, and other navigation do not start a conversation. New Chat, or the first message when the notebook has no chats, is what creates one. At 10 stored messages (user and assistant) the composer stops, and the API rejects another turn before retrieval or a credit charge.
- **Web search toggle reads `byWorkspace`** — selecting `getPrefs` does not re-render, because that function identity never changes. The first paint stays off until persistence hydrates, so the server HTML matches. The send body reads the same store when the message is sent. Cited web pages are streamed as `data-citations` with the reply, and each `[W#]` matches the merged result list.
- **Workspace pages share one shell via a layout** — `getSession` and `getWorkspaceOrNull` are wrapped in React `cache()` so the layout and page share one fetch. `WorkspaceShell` reads the workspace through `useWorkspace(id, initialData)` so renames show up without a server refetch.
- **Removed dead code** — `client/components/auth`, `client/components/providers`, the duplicate `client/lib/auth-*`, `require-auth`, `unauth`, `client/hooks/use-mobile.ts`, `SignOutButton`, `ModeToggle`, `WorkspaceList`, workspace gradients, `SourceSidebarList`, and `carousel.tsx`.

## Notes

- `client/lib/utils.ts` is the live `cn()` helper. `client/app/(auth)/layout.tsx` is now the split sign-in layout. `client/components/ui/*` is the shadcn primitive set.
