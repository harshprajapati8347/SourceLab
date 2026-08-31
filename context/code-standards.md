# Code Standards

Conventions observed across the actual codebase. Follow these for consistency — they are descriptive of what's already here, not aspirational.

---

## Engineering Mindset

- **Feature-first on the client** — new client UI belongs in `client/features/<name>/`, not scattered across `app/`. Route files in `app/` stay thin: auth guard + fetch + render one feature component.
- **Layered on the server** — route → controller → validator → service → repository. Each layer has exactly one job (see `architecture.md` → System Boundaries). Don't skip layers (e.g. a controller must never call Prisma directly).
- **Read before writing** — this project already has a consistent pattern for almost everything (CRUD hooks, dialogs, badges, background jobs). Find the closest existing example before inventing a new shape.

---

## TypeScript

- Strict mode is on in both `client/tsconfig.json` and `server/tsconfig.json` — keep it on, don't add `// @ts-ignore` casually.
- Server is pure ESM (`"type": "module"` in `server/package.json`) — all relative imports use explicit `.js` extensions even though the source is `.ts` (e.g. `import { auth } from "./lib/auth.js"`). This is required by Node ESM resolution; keep doing it in new server files.
- Prefer `type` aliases for data shapes (`type Workspace = {...}`); Prisma-derived types use `Prisma.<Model>GetPayload<{ select: typeof someSelect }>` rather than the full generated model type, so repositories can control exactly which columns are selected.
- Zod schemas are the source of truth for request shapes on the server; derive types with `z.infer<typeof schema>` rather than hand-writing a parallel type.
- Avoid `any`; prefer `unknown` + narrowing (see the `metadata` narrowing pattern used throughout `source-processing.service.ts`: check `typeof x === "object" && !Array.isArray(x)` before treating JSON columns as a typed shape).

---

## File and Folder Naming

- Folders and files: **kebab-case** everywhere — `source-processing.service.ts`, `chat-message-body.tsx`, `use-conversations.ts`.
- Server files are suffixed by role: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.validator.ts`, `*.routes.ts`, `*.middleware.ts`.
- Client feature files are suffixed/grouped by role inside `features/<name>/`: `components/`, `hooks/use-*.ts`, `lib/api.ts`, `lib/types.ts`, `lib/routes.ts`, `lib/constants.ts`, `index.ts` (barrel export of the public surface).
- React components: named exports, PascalCase export name, kebab-case filename (`export function WorkspaceShell` in `workspace-shell.tsx`).
- One component per file. `components/ui/*` are the only place with tightly related multi-export files (e.g. `Dialog`/`DialogContent`/`DialogHeader` all from `dialog.tsx`) because they mirror shadcn's generated structure.

---

## Feature Module Shape (client)

Every feature under `client/features/<name>/` follows:

```
features/<name>/
├── components/         → UI, one component per file
├── hooks/use-*.ts       → React Query hooks wrapping lib/api.ts, own the query-key factory
├── lib/api.ts            → apiFetch() calls, one function per endpoint, no React
├── lib/types.ts          → Shapes returned by/sent to the API
├── lib/routes.ts          → Typed route-path builders (e.g. workspaceRoutes.detail(id))
├── lib/constants.ts       → Enum label maps, fixed option lists (optional)
└── index.ts               → Curated public exports; other features/app code import from here, not deep paths
```

Import from a feature's `index.ts` barrel when consuming it from outside the feature (`import { WorkspaceShell } from "@/features/workspaces"`); deep-importing a specific file is acceptable within the same feature or for a sub-path a feature intentionally doesn't re-export (e.g. `@/features/chat/stores/chat-preferences`).

## Backend Request Shape (server)

```typescript
// routes/source.routes.ts — wiring only
sourceRoutes.get("/:sourceId", asyncHandler(getSource));

// controllers/source.controller.ts — parse, validate, call one service, respond
export async function getSource(req: Request, res: Response) {
  const { workspaceId, sourceId } = sourceIdParamSchema.parse(req.params);
  const source = await getSourceForWorkspace(workspaceId, sourceId, req.session.user.id);
  res.json(source);
}

// services/source.service.ts — business logic, ownership checks
export async function getSourceForWorkspace(workspaceId: string, sourceId: string, userId: string) {
  await getWorkspaceByIdForUser(workspaceId, userId); // throws NotFoundError if not owned
  const source = await findSourceByIdAndWorkspaceId(sourceId, workspaceId);
  if (!source) throw new NotFoundError("Source not found");
  return source;
}

// repositories/source.repository.ts — Prisma only
export function findSourceByIdAndWorkspaceId(sourceId: string, workspaceId: string) {
  return prisma.source.findFirst({ where: { id: sourceId, workspaceId }, select: sourceSelect });
}
```

- Controllers always validate with a Zod schema (`schema.parse(req.params/query/body)`) before calling a service — never pass raw `req` data into a service.
- Responses are **plain resource JSON**, not a `{ success, data }` envelope — `res.json(source)`, `res.json(sources)`, `res.status(201).json(source)`, `res.status(204).send()` for deletes.
- Every route is wrapped in `asyncHandler(...)` so thrown/rejected errors reach the centralized `errorHandler` middleware — never manually `try/catch` + `res.status(500)` inside a controller.
- Throw typed errors from services/controllers (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ConflictError` from `types/app-error.ts`) — `errorHandler` maps `AppError` → its `statusCode` + `{ error, details? }`, `ZodError` → `400` with `flattenError(error).fieldErrors`, `MulterError` → `400`, and anything else → `500` with a generic message (never leaks internals).
- Every workspace-scoped service function takes `(workspaceId, ..., userId)` and starts by calling `getWorkspaceByIdForUser(workspaceId, userId)` (throws `NotFoundError` if the workspace doesn't belong to that user) before touching any nested resource — this is the ownership-check pattern; replicate it for any new nested resource.
- Repository functions return Prisma query results directly (no service-shaped wrapping) and always use an explicit `select` object (e.g. `sourceSelect`) rather than returning the whole row — keeps the shape stable and intentional.

## Client Request Shape

```typescript
// features/<name>/lib/api.ts
export function listSources(workspaceId: string, filters: SourceFilters = {}) {
  const params = new URLSearchParams(...);
  return apiFetch<Source[]>(`/api/workspaces/${workspaceId}/sources?${params}`);
}

// features/<name>/hooks/use-sources.ts
export function useSources(workspaceId: string, filters: SourceFilters = {}) {
  return useQuery({
    queryKey: sourceKeys(workspaceId).list(filters),
    queryFn: () => listSources(workspaceId, filters),
  });
}
```

- `shared/lib/api.ts`'s `apiFetch<T>()` is the only place `fetch` is called for JSON API requests — it always sets `credentials: "include"`, JSON-encodes non-FormData bodies, and throws `ApiError` (with `status`, `message`, optional `details`) on non-2xx responses.
- Every feature defines a `*Keys(workspaceId?)` factory (e.g. `sourceKeys`, `chatKeys`, `workspaceKeys`) returning `{ all, list(...), detail(...) }`-shaped tuples; mutations invalidate via `queryClient.invalidateQueries({ queryKey: xKeys(...).all })` in `onSuccess`.

---

## Background Jobs (Inngest)

- Every durable job is a small `inngest.createFunction({ id, retries, triggers: [{ event }] }, handler)` in `server/src/inngest/index.ts`, and each `step.run("name", fn)` should be independently retryable/idempotent.
- A job's handler calls into `services/`, never contains business logic itself.
- Failure paths update the owning row's status to `FAILED` with an error message in `metadata`/a dedicated field inside a `step.run("mark-failed", ...)` — don't let a job fail silently or leave a resource stuck in a `PROCESSING`/`PENDING` state with no error trail.

---

## Comments

This codebase uses **JSDoc-style doc comments on exported functions**, especially in `server/src/services/*` and `server/src/lib/*` — not the "no comments" convention. Follow the existing style:

```typescript
/**
 * One-sentence summary of what the function does and why it exists.
 *
 * Optional extra paragraph(s) explaining a non-obvious pipeline, trade-off, or gotcha.
 *
 * @param foo - What this parameter is / where it comes from
 * @returns What's returned and in what shape
 * @throws {SomeError} When and why
 */
export async function doThing(foo: string) { ... }
```

- Add doc comments to new exported service/lib functions, especially anything with a multi-step pipeline (see `source-processing.service.ts` for the reference example).
- Avoid comments that just restate the next line of code (`// increment counter`); the JSDoc convention above is for *why*/*what this achieves*, not a line-by-line narration.
- Inline `//` comments are fine for a genuinely non-obvious branch (e.g. explaining a fallback URL heuristic), not for routine logic.

---

## Environment Variables

Never hardcode a key, URL, or secret. Current variables:

**`server/.env`**
| Variable | Used In |
| --- | --- |
| `PORT` | `src/index.ts` |
| `DATABASE_URL` | Prisma (`schema.prisma` datasource) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | `lib/auth.ts` |
| `CLIENT_URL` | `src/index.ts` (CORS origin), `lib/auth.ts` (trusted origin) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `lib/auth.ts` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | `lib/cloudinary.ts` |
| `FIRECRAWL_API_KEY` | `lib/firecrawl.ts` |
| `INNGEST_DEV` | Inngest local dev mode |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest Cloud in production (`server/.env.production` on EC2) |
| `PG_POOL_MAX` | Optional pg pool size (default 5) |
| `OPENAI_API_KEY` | `lib/openai.ts`, `@ai-sdk/openai` chat calls |
| `PINECONE_API_KEY` / `PINECONE_INDEX` | `lib/pinecone.ts` |
| `TAVILY_API_KEY` | `lib/tavily.ts` (chat web search tool — feature no-ops without it) |
| `MEM0_API_KEY` | `lib/mem0.ts` (memory features no-op/return empty without it) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `lib/email.ts` (verification + password reset; logs the link if unset) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | Better Auth Stripe plugin (`lib/auth.ts`). Plugin skipped if any is missing. |

**`client/.env`**
| Variable | Used In |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Client base URL |
| `API_URL` | Server base URL the client talks to |

Several integrations (Tavily, Mem0, Firecrawl, Cloudinary) are designed to **degrade gracefully** when their key is missing (return `[]`, no-op, or throw a `ValidationError` with a clear setup message) rather than crashing the whole request — follow this pattern for any new optional third-party integration.

---

## Import Aliases

- Client: `@/*` → project root (`client/`), configured in `tsconfig.json`. Always use `@/features/...`, `@/components/...`, `@/shared/...`, `@/lib/utils` — never deep relative paths that climb more than one directory (`../../../`).
- Server: relative imports with explicit `.js` extensions (ESM requirement) — `../lib/db.js`, `../types/app-error.js`.

---

## Dependencies

Before adding a new package, check:
1. Does `components/ui/` (shadcn) already cover this UI need?
2. Does an existing `lib/` wrapper already integrate the third-party service you need (OpenAI, Pinecone, Mem0, Cloudinary, Firecrawl, Tavily)?
3. Is there a simpler solution with what's already installed (`date-fns`, `zod`, `@tanstack/react-query`, `zustand`)?

Current dependencies are listed in `client/package.json` and `server/package.json` — treat those as the approved list. See `library-docs.md` for how each is actually used in this project.
