# Progress Tracker

Snapshot of what's actually implemented in the codebase today, based on reading the code (not a maintained changelog — update this after every feature going forward).

---

## Current Status

**Phase:** Core product feature-complete (auth, workspaces, sources/RAG, chat, learning artifacts, memory); no test/CI infrastructure yet.
**Last completed (per git log):** Tooling chores — `.gitignore`/scripts/`inngest-cli` update, client TypeScript bumped to 6.0.3.
**Next:** Not defined in-repo — see `build-plan.md` → Proposed Next Steps for inferred candidates; confirm real priorities with the project owner.

---

## Implemented

### Auth
- [x] Google OAuth via Better Auth (server-mounted at `/api/auth/*`, Prisma adapter)
- [x] Session-based route protection (`requireAuth()` on protected pages, `requireAuth` middleware on protected API routes)
- [x] Sign-in / sign-out UI

### Workspaces
- [x] Create / list / search (debounced, client-side) / update / delete
- [x] Delete cascades to sources, conversations, artifacts (Prisma cascade) and best-effort deletes the Pinecone namespace
- [x] Per-workspace settings: title, description, icon, default chat model
- [x] Dashboard grid UI with empty/loading/error states

### Sources
- [x] Five ingestion types: Text, Markdown, PDF upload (Cloudinary), Website (Firecrawl), YouTube (transcript)
- [x] Additional web-search-to-source import endpoint (`/import/web-search`)
- [x] Background processing pipeline (Inngest): extract → chunk → embed → index, with status tracking (`PENDING → PROCESSING → READY/FAILED`)
- [x] Reprocess a single failed source, or bulk-reprocess all failed sources
- [x] Source library: search, type filter, status filter, grid/list view toggle, multi-select bulk delete
- [x] Source detail page with extracted content preview, chunk count, processing/failed states
- [x] Live polling (3s) while a source is pending/processing

### Chat (RAG)
- [x] Multi-conversation per workspace, streamed responses (AI SDK)
- [x] RAG retrieval from Pinecone (per-workspace namespace, score-thresholded top-K)
- [x] Inline numbered citations with hover previews, linking to source detail or external URL
- [x] Model selection per workspace (`gpt-4o-mini` / `gpt-4o`), persisted client-side per workspace
- [x] Optional web search tool (Tavily), with `[W#]` citations
- [x] Rolling conversation summarization every 8 messages, feeding both the chat context window and Mem0
- [x] Mem0 long-term memory: recalled into chat context, auto-learned from conversations
- [x] Conversation delete, "new chat", markdown export
- [x] Deep-link into chat with a pre-filled question (`?ask=...`, used by the mind map viewer's "ask in chat")

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

---

## In Progress / Partial

- **Analytics/dashboard charts** — `recharts` and a `chart.tsx` primitive are installed and present, but no feature currently renders a chart. Unclear if this is planned or dead weight (see `build-plan.md`).
- **Toasts** — `components/ui/toast.tsx` exists but isn't wired to a global provider; errors currently render as inline text instead.

## Not Started

- Automated tests (unit, integration, or e2e) — none exist in the repo
- CI/CD configuration — no `.github/workflows` or equivalent
- Artifact editing after generation (currently delete + regenerate only)
- Pagination on the source library (loads the full list per workspace)
- Any auth provider besides Google
- Team/shared/multi-user workspaces
- Billing or usage limits

---

## Known Issues

- **Orphaned duplicate files** in `client/lib/*`, `client/components/auth/*`, `client/components/providers/*`, `client/hooks/use-mobile.ts` — superseded by `client/features/auth/*` and `client/shared/*`, confirmed unused via repo-wide import search, not yet deleted.
- **`server/.env.example` is incomplete** — missing `MEM0_API_KEY` and `TAVILY_API_KEY`, both of which are read by the server and silently disable memory/web-search features when absent (no error, just missing functionality) — easy to miss when setting up a new environment.

---

## Decisions Made During Build

_None recorded in-repo (no changelog/ADRs found). Log significant decisions here going forward — e.g. "why Pinecone namespaces per workspace instead of a metadata filter," "why Mem0 instead of storing memory in Postgres," etc._

## Notes

_Add notes here as work continues — workarounds, follow-ups, anything that differs from the other context files._
