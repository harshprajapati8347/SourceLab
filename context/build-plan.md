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
`chore: update .gitignore, modify package.json scripts for dev and start, add inngest-cli` and `chore: bump TypeScript to 6.0.3 for the client` — tooling/DX cleanup.

### Phase 8 — Known-issue cleanup
Deleted unused duplicate client auth/provider/hook files left over from the feature-folder migration. Documented optional `MEM0_API_KEY` and `TAVILY_API_KEY` in `server/.env.example`.

---

## Current State (see `progress-tracker.md` for the full breakdown)

There is no automated test suite in the repository. Server production deploy uses GitHub Actions + Docker Hub + EC2 (`deploy-server.yml`).

---

## Proposed Next Steps

1. **No automated tests** — there is no `*.test.ts` or test runner config. If quality gates are wanted, this is entirely greenfield.
2. **Server deploy is configured but still needs a first production run** — GitHub secrets, EC2 bootstrap, managed Postgres, Inngest Cloud, and Vercel `API_URL` must be set by the operator (see `deploy/`).
2. **Source library has no pagination** — `listSources` returns the full workspace source list; likely fine at small scale but worth revisiting if workspaces grow large.
3. **Artifacts are not editable** — once generated, an artifact can only be deleted and regenerated, not edited in place.
4. **`recharts` is installed and wired into `components/ui/chart.tsx` but unused** — either a dashboard/analytics view was planned and not yet built, or the dependency is dead weight. Confirm intent before adding new chart UI or removing the dependency.
5. **Toast primitive (`components/ui/toast.tsx`) exists but isn't connected to a global provider/toaster** — errors currently surface as inline text; decide whether toasts are intended.