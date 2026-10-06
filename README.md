# SourceLab

A NotebookLM-style AI research workspace: add sources to a notebook, chat with them using citations, and turn them into study tools.

## Overview

SourceLab is a full-stack “chat with your documents” app for students, researchers, and knowledge workers. Users create **workspaces** (notebooks), add **sources** (PDFs, websites, YouTube transcripts, pasted text, or markdown), and the app indexes that material into a searchable vector store.

From there you can:

- Ask an assistant questions grounded in those sources, with inline citations back to the exact chunk (and page, for PDFs)
- Generate learning **artifacts** — summaries, key takeaways, flashcards, quizzes, mind maps, and long-form reports
- Keep **user memory** (recalled in every notebook) and **notebook memory** (isolated to one workspace)

The backend is a standalone Express API (`server/`). The frontend is a Next.js App Router client (`client/`). They talk over HTTP with cookie-based sessions.

Workspaces are single-owner. There is no team sharing, and no OAuth provider other than Google (email/password is also supported). Free and Pro share the same product surface; usage is gated by credits, not by hiding features.

## Key features

Implemented in the codebase today:

- **Auth** — Google OAuth and email/password via Better Auth (email verification required; password reset). Cookie sessions shared between the client and API
- **Billing** — Stripe Pro (`@better-auth/stripe`) plus a Postgres credit counter. Chat costs **0.1** credit; artifacts and a successfully processed source cost **1**. Free: 10 credits once. Pro: ₹499/month INR, 500 credits per period (hard reset, no rollover)
- **Workspace CRUD** — create, search, edit, delete (delete cascades to sources, conversations, artifacts, notebook memories, and the workspace’s Pinecone namespace)
- **Five source types** — text, markdown, PDF upload, website scrape, YouTube transcript — plus a web-search-to-source import path
- **Background source pipeline** (Inngest) — extract → chunk → embed → index, with status tracking and reprocess of failed sources
- **Source library** — search, type/status filters, grid/list view, bulk delete, live polling while sources process
- **RAG chat** — multi-conversation streaming chat with numbered citations, model selection (`gpt-4o-mini` / `gpt-4o`), optional web search, conversation export, rolling summaries every 8 messages, query classification/corrective retrieval, and input/output guardrails. Opening a notebook resumes its latest chat; a thread stops at 10 stored messages
- **Learning tools** — six artifact types, each with a dedicated viewer (including an interactive mind map)
- **Memory** (Mem0) — user vs notebook scope, manual vs learned, managed at `/settings/memory`
- **Light/dark/system theme** via `next-themes` (dark default)

Not in scope: OAuth providers other than Google, shared workspaces, artifact in-place editing (delete and regenerate), source-library pagination, admin tooling, offline mode.

## Tech stack

| Layer | Tool | Role |
| --- | --- | --- |
| Client | Next.js 16 (App Router), React 19, TypeScript | UI and server-component shell over the Express API |
| Styling | Tailwind CSS v4 + shadcn/ui (`base-rhea`, `@base-ui/react`) | Design system |
| Client data | TanStack Query, Zustand | Server state + chat preferences / UI store |
| Chat | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) | Streaming chat and structured generation |
| Auth | Better Auth | Google OAuth, email/password, Stripe plugin |
| API | Express 5 (ESM) | REST + streamed chat |
| Database | PostgreSQL + Prisma 7 | Relational data |
| Vectors | Pinecone | Per-workspace RAG namespaces |
| LLM | OpenAI | `text-embedding-3-small`, `gpt-4o-mini` / `gpt-4o` |
| Guardrails | `@openai/guardrails` | Chat input and output gates |
| Jobs | Inngest | Source processing, artifact generation, conversation summaries, billing credit lifecycle |
| Files | Cloudinary | PDF storage |
| Ingestion | Firecrawl, `youtube-transcript`, `unpdf` | Websites, YouTube, PDFs |
| Web search | Tavily | Optional chat `web_search` tool |
| Memory | Mem0 | User memory and notebook memory |
| Email | Resend | Verification and password reset |
| Billing | Stripe | Pro subscription |
| Validation | Zod v4 | Request schemas |

## Architecture

The client is a thin App Router shell. Feature UI lives in `client/features/*`. The server is layered: **route → controller → validator → service → repository**.

```
Browser (localhost:3000)
        │  Next.js rewrites /api/*  (or CORS + cookies in production)
        ▼
Express API (localhost:8080)
        ├── PostgreSQL (Prisma)     users, workspaces, sources, chat, artifacts, credits
        ├── Pinecone                embeddings, one namespace per workspace
        ├── OpenAI                  embeddings + chat / artifact generation + guardrails
        ├── Inngest                 durable background jobs
        └── Cloudinary / Firecrawl / Tavily / Mem0 / Resend / Stripe
```

Auth is mounted on the **server** at `/api/auth/*` (including the Stripe webhook at `/api/auth/stripe/webhook`). In local dev, Next.js rewrites `/api/auth`, `/api/workspaces`, `/api/memory`, and `/api/billing` to the Express origin so the browser stays same-origin.

Stripe webhooks must hit the **Express** host (not the Next.js rewrite) so signature verification sees the raw body. Forward locally with:

```bash
stripe listen --forward-to localhost:8080/api/auth/stripe/webhook
```

Client route protection uses `client/proxy.ts` (there is no `middleware.ts`). Protected pages also call `requireAuth()`.

### Repository layout

```
SourceLab/
├── client/                      Next.js 16 frontend
│   ├── app/                     Routes only (auth guard + render a feature)
│   ├── features/                auth, billing, landing, chat, learn, memory, sources, workspaces
│   ├── components/ui/           shadcn/ui primitives
│   ├── shared/                  Cross-feature providers, hooks, apiFetch()
│   └── lib/utils.ts             cn() helper
├── server/                      Express API
│   ├── src/
│   │   ├── index.ts             Entrypoint (CORS, auth, Inngest, routes)
│   │   ├── routes/              Thin routers
│   │   ├── controllers/         Parse, validate, call one service
│   │   ├── validators/          Zod schemas
│   │   ├── services/            Business logic
│   │   ├── repositories/        Prisma queries
│   │   ├── lib/                 Third-party clients + RAG helpers
│   │   ├── inngest/             Background job definitions
│   │   └── middleware/          Auth, uploads, error handler
│   └── prisma/                  Schema + migrations
├── context/                     Project docs — read before implementing
├── deploy/                      EC2 bootstrap (API host; Postgres is managed)
├── docker-compose.yml           Local Postgres (port 5434)
├── docker-compose.prod.yml      Production server image (no Postgres)
└── AGENTS.md                    Agent/contributor reading order and skills
```

Each client feature follows `components/`, `hooks/`, `lib/{api,types,routes,constants}.ts`, and an `index.ts` barrel.

## Design system

Tokens live in `client/app/globals.css` (`:root` / `.dark` + `@theme inline`). There is **no** `tailwind.config.ts`.

- Never hardcode hex / oklch / rgb values, and never use raw Tailwind palette classes. Use semantic utilities: `bg-background`, `text-foreground`, `bg-primary`, `border-border`, etc.
- Warm-grey neutrals; brand accent is amber `--primary` (use `text-primary-ink` for amber text). Dark is the default theme.
- Text is **Manrope** (`font-sans`; `font-heading` is the same family and marks titles). JetBrains Mono (`font-mono`) is for data only.
- Radii: `rounded-lg` controls, `rounded-xl` cards, `rounded-2xl` dialogs, `rounded-full` pills. Nothing larger than `rounded-2xl`.
- Primitives are **`@base-ui/react`**, not Radix. Polymorphic rendering uses a `render` prop (and `nativeButton={false}` on `Button`), not `asChild`.
- Icons are `lucide-react` only.

Full token tables and UI conventions: [`context/ui-tokens.md`](context/ui-tokens.md), [`context/ui-rules.md`](context/ui-rules.md).

## Getting started

### Prerequisites

- Node.js 24 (server `engines` and Dockerfiles)
- Docker and Docker Compose (local Postgres)
- A [Google Cloud](https://console.cloud.google.com/) OAuth client (Web application)
- API keys for OpenAI and Pinecone
- Optional, per feature: Cloudinary (PDFs), Firecrawl (website import), Tavily (chat web search), Mem0 (memory), Resend (email), Stripe (billing)

There is no root `package.json`. Install `client/` and `server/` separately. The server package declares `packageManager: pnpm@11.5.2`.

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/SourceLab.git
cd SourceLab

cd server && pnpm install && cd ..
cd client && pnpm install && cd ..
```

### 2. Start Postgres

```bash
docker compose up -d
```

This runs `pgvector/pgvector:pg16` as `sourcelab-postgres-build`, exposing Postgres on **localhost:5434**. Database / user / password are `sourcelab` / `postgres` / `postgres`.

Pinecone is the vector store. The pgvector image is used as plain Postgres for Prisma.

### 3. Configure environment

**Server** — copy [`server/.env.example`](server/.env.example) to `server/.env`:

```bash
cp server/.env.example server/.env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | No | Defaults to `8080` |
| `DATABASE_URL` | Yes | Example file uses `…/projectname`. For Compose use `postgresql://postgres:postgres@localhost:5434/sourcelab` |
| `BETTER_AUTH_SECRET` | Yes | Random secret for signing sessions |
| `BETTER_AUTH_URL` | Yes | Client origin in local dev (`http://localhost:3000`) — Next rewrites `/api/auth` to the server |
| `CLIENT_URL` | Yes | CORS + Better Auth trusted origin (`http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth |
| `OPENAI_API_KEY` | Yes | Chat, artifacts, embeddings, guardrails |
| `PINECONE_API_KEY` | Yes | RAG index (auto-created if missing) |
| `PINECONE_INDEX` | No | Defaults to `sourcelab` (1536 dims, cosine) |
| `INNGEST_DEV` | Local | Set to `1` for the Inngest dev server |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Production | Inngest Cloud (instead of `INNGEST_DEV`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` | PDF uploads | Unsigned preset; API key/secret optional for signed re-download |
| `FIRECRAWL_API_KEY` | Website import | Website sources fail validation without it |
| `TAVILY_API_KEY` | Optional | Chat web-search toggle is a no-op if unset |
| `MEM0_API_KEY` | Optional | Memory APIs return empty / no-op if unset |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Optional | Verification and password-reset email; links are logged to the console if unset |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_PRICE_ID` | Billing | Plugin is skipped if any is missing. `STRIPE_PRO_PRICE_ID` must be a Price id (`price_…`) |
| `RAG_TRACE_ENABLED` | Optional | Set `true` to show “How this answer was found” in chat |
| `PG_POOL_MAX` | Optional | Postgres pool size (default 5) |

Configure the Google OAuth client’s authorized redirect URI to Better Auth’s callback on the client origin (local default: `http://localhost:3000/api/auth/callback/google`).

**Client** — there is no `.env.example`. Defaults work for local dev:

| Variable | Default | Used for |
| --- | --- | --- |
| `API_URL` | `http://localhost:8080` | Next rewrites + server-side workspace fetches |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Session fetch origin |

Create `client/.env` only if you need to override those.

### 4. Migrate the database

```bash
cd server
pnpm prisma:generate
pnpm prisma:migrate
```

### 5. Run the app

Use three terminals (plus Postgres from step 2):

```bash
# Terminal 1 — API
cd server
pnpm dev
```

```bash
# Terminal 2 — Inngest (source processing, artifacts, summaries, billing credits)
cd server
pnpm inngest:dev
```

```bash
# Terminal 3 — Next.js
cd client
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). API health: [http://localhost:8080/health](http://localhost:8080/health).

## Usage

| Route | What it is |
| --- | --- |
| `/` | Signed-out landing (always dark). Signed-in visitors redirect to `/dashboard` |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth |
| `/pricing` | Public Free vs Pro |
| `/dashboard` | Notebook list — search, create, edit, delete |
| `/settings/memory` | User memory. `?workspaceId=` is that notebook’s memory. `?source=manual` or `?source=learned` filters either list |
| `/settings/billing` | Plan, credits, Upgrade to Pro, Manage billing |
| `/workspace/[id]` | Chat (default when opening a notebook) |
| `/workspace/[id]/sources` | Source library |
| `/workspace/[id]/sources/[sourceId]` | Source detail |
| `/workspace/[id]/learn` | Learning tools hub |
| `/workspace/[id]/learn/[artifactId]` | Artifact viewer |
| `/workspace/[id]/settings` | Workspace settings |

Add sources from the workspace shell (Text / Markdown / PDF / Website / YouTube). Processing is asynchronous; the library polls until status is `READY` or `FAILED`. Chat answers from whatever is already indexed; a banner reports sources still processing.

## Available scripts

### `client/`

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `next dev` | Dev server (port 3000) |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve the production build |
| `lint` | `eslint` | Lint |

### `server/`

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `tsx watch src/index.ts` | API with reload (port 8080) |
| `build` | `prisma generate && tsc` + copy guardrails config | Compile to `dist/` |
| `start` | `prisma migrate deploy && node dist/index.js` | Run the compiled API |
| `test` | `tsx --test` on listed `*.test.ts` files | Server unit tests |
| `prisma:generate` | `prisma generate` | Generate the Prisma client (`server/src/generated/prisma`) |
| `prisma:migrate` | `prisma migrate dev` | Dev migrations |
| `prisma:deploy` | `prisma migrate deploy` | Apply migrations (production) |
| `prisma:studio` | `prisma studio` | Browse the database |
| `inngest:dev` | `inngest-cli dev` | Local Inngest Dev Server |

## Project conventions

See [`context/code-standards.md`](context/code-standards.md). In short:

- **Feature-first client** — new UI goes in `client/features/<name>/`. `app/` files stay thin.
- **Layered server** — controllers never call Prisma; services never touch `req`/`res`; repositories are Prisma-only.
- **kebab-case** files and folders. Server files are suffixed by role. React components: PascalCase export, kebab-case filename, one component per file.
- **Strict TypeScript** on both packages. Server is ESM — relative imports use explicit `.js` extensions in `.ts` source.
- **Zod** is the source of truth for request shapes. Responses are plain JSON, not a `{ success, data }` envelope.
- **`apiFetch`** in `client/shared/lib/api.ts` is the only JSON `fetch` wrapper. Components talk to the API through feature hooks.
- Client imports use `@/` aliases.

Before adding UI, check [`context/ui-registry.md`](context/ui-registry.md). After you add, rename, or remove a component, update that registry.

## Development workflow

This repo is set up for Cursor / Claude Code agents. Before implementing anything, read the files listed in [`AGENTS.md`](AGENTS.md) in order.

| Skill | When to use |
| --- | --- |
| `/architect` | Before any complex feature |
| `/imprint` | After any new UI component — capture patterns into `ui-registry.md` |
| `/review` | After a feature, before a demo, or when something feels off |
| `/recover` | When something breaks after one failed correction |
| `/remember save` | End of a session that spans more work |
| `/remember restore` | Start of a new session continuing that work |

If the same problem persists after **one** corrective prompt, stop and run `/recover`.

Also:

- Never hardcode colors or raw Tailwind palette classes
- Update `context/progress-tracker.md` and `context/ui-registry.md` after every feature
- Before adding a third-party library, read its installed skill (if any), then [`context/library-docs.md`](context/library-docs.md)

## Production notes

- Server image is built by GitHub Actions (`.github/workflows/deploy-server.yml`) and pulled on EC2 via `docker-compose.prod.yml`. The API host does not run Postgres; use managed Postgres.
- Production start runs `prisma migrate deploy` then `node dist/index.js`.
- Point Stripe at the Express origin: `POST /api/auth/stripe/webhook`. Required events are listed in [`context/billing-and-credits.md`](context/billing-and-credits.md).
- Bootstrap for a small EC2 host: [`deploy/ec2-bootstrap.sh`](deploy/ec2-bootstrap.sh).

## Current progress

**Phase:** Auth (Google + email/password), workspaces, sources/RAG, chat with query and context intelligence, learning artifacts, memory, billing (Stripe Pro) + credits.

**Operator setup still needed for a live billing/email stack:** Resend domain, Stripe test Product/Price (`STRIPE_PRO_PRICE_ID`), webhook to Express `/api/auth/stripe/webhook`.

Details: [`context/build-plan.md`](context/build-plan.md), [`context/progress-tracker.md`](context/progress-tracker.md), [`context/billing-and-credits.md`](context/billing-and-credits.md).

## Contributing

1. Read [`AGENTS.md`](AGENTS.md) and the `context/` docs before changing code.
2. Follow [`context/code-standards.md`](context/code-standards.md) and the design-system notes above.
3. Keep `app/` routes thin; put logic in features (client) or services (server).
4. For UI work, check and update [`context/ui-registry.md`](context/ui-registry.md).
5. After a feature, update [`context/progress-tracker.md`](context/progress-tracker.md).
