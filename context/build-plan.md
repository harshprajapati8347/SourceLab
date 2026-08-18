# Build Plan

Treat this as a reconstructed history + a best-guess "what's next" list — confirm/replace the "Proposed Next" section with real priorities.

---

## Inferred History

### Phase 0 — Project Setup
`init: add initial project setup` — Next.js 16 client + Express server scaffolds, Docker Compose Postgres, base tooling.

### Phase 1 — Auth Foundation
`feat: integrate better-auth (Prisma models, workspace...)` — Better Auth wired up server-side (Prisma adapter, Google OAuth), CORS between client/server, initial Docker port fix.

### Phase 2 — Workspace & Source CRUD
`feat: implement workspace and source management with CRUD operations, validation, and error handling` — `Workspace`/`Source` Prisma models, full workspace CRUD, initial source creation, the `AppError`/Zod/`asyncHandler` error-handling scaffolding used throughout the rest of the server.

### Phase 3 — Auth/UI Refactor
`feat: refactor authentication and workspace features, update routing, and enhance UI components` — Move to the `client/features/*` structure, shadcn/base-ui component set brought in, workspace UI (dashboard, shell, dialogs) built out.

### Phase 4 — RAG Pipeline
`feat: implement RAG indexing, retrieval, chat, and multi-source services` — Chunking, OpenAI embeddings, Pinecone indexing, Inngest source-processing pipeline, multi-source-type ingestion (PDF/website/YouTube/text/markdown), and the first working RAG chat endpoint.

### Phase 5 — Artifacts & Memory
`feat: add artifacts and memory management services, routes, and controllers with validation` — `LearningArtifact` model + generation pipeline, Mem0 memory service/routes.

### Phase 6 — AI SDK Chat Polish
`feat: use ai sdk and enhance chat functionality with new components, integrate memory settings, and update routing for workspaces` — Migrated chat to the Vercel AI SDK's streaming primitives, citation UI, memory settings page, conversation summarization, web search tool.

### Phase 7 — Chores
`chore: update .gitignore, modify package.json scripts for dev and start, add inngest-cli` and `chore: bump TypeScript to 6.0.3 for the client` — tooling/DX cleanup, most recent commits.

---

## Current State (see `progress-tracker.md` for the full breakdown)

Every major feature area described in `project-overview.md` has a working implementation: auth, workspace CRUD, all five source ingestion types + background processing, RAG chat with citations/web search/summarization, all six learning artifact types with viewers, and manual+learned memory. There is no automated test suite and no CI configuration in the repository.

---

## Proposed Next Steps

1. **Clean up orphaned legacy files** — `client/lib/auth-*.ts`, `client/lib/unauth.ts`, `client/lib/require-auth.ts`, `client/components/auth/*`, `client/components/providers/*`, `client/hooks/use-mobile.ts` are unused duplicates of `client/features/auth/*` and `client/shared/*` (see `architecture.md` → Known Issues). Low-risk deletion once confirmed.
2. **Document missing env vars** — `server/.env.example` does not list `MEM0_API_KEY` or `TAVILY_API_KEY`, even though `lib/mem0.ts` and `lib/tavily.ts` both read them (both features degrade gracefully without them, but a new developer following `.env.example` alone won't discover memory/web-search exist). Add both to the example file.
3. **No automated tests or CI** — there is no `*.test.ts`, test runner config, or `.github/workflows` in the repo. If quality gates are wanted, this is entirely greenfield.
4. **Source library has no pagination** — `listSources` returns the full workspace source list; likely fine at small scale but worth revisiting if workspaces grow large.
5. **Artifacts are not editable** — once generated, an artifact can only be deleted and regenerated, not edited in place.
6. **`recharts` is installed and wired into `components/ui/chart.tsx` but unused** — either a dashboard/analytics view was planned and not yet built, or the dependency is dead weight. Confirm intent before adding new chart UI or removing the dependency.
7. **Toast primitive (`components/ui/toast.tsx`) exists but isn't connected to a global provider/toaster** — errors currently surface as inline text; decide whether toasts are intended.