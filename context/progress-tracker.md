# Progress Tracker

Snapshot of what's actually implemented in the codebase today, based on reading the code (not a maintained changelog — update this after every feature going forward).

---

## Current Status

**Phase:** Core product feature-complete (auth, workspaces, sources/RAG, chat, learning artifacts, memory); no test/CI infrastructure yet.
**Last completed:** Known-issue cleanup — deleted orphaned client auth/provider/hook duplicates; documented `MEM0_API_KEY` and `TAVILY_API_KEY` in `server/.env.example`.
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

_None currently._

---

## Decisions Made During Build

- **Orphan cleanup kept `client/lib/utils.ts`** — it is the live `cn()` helper imported by shadcn primitives and feature components; `client/app/(auth)/layout.tsx` is also live (login page wrapper), not a duplicate.
- **Tavily and Mem0 remain optional env vars** — documented in `server/.env.example` with comments that missing keys degrade those features to no-ops rather than failing startup.

## Notes

- `client/lib/utils.ts` and `client/app/(auth)/layout.tsx` were checked during the orphan cleanup and are still live; they were not deleted. `client/components/ui/*` is the shadcn primitive set and is unrelated to the removed `components/auth` / `components/providers` leftovers.
