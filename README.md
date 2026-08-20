# SourceLab

A NotebookLM-style AI research workspace — drop in your documents, chat with them, and turn them into study tools.

## Overview

SourceLab is a full-stack “chat with your documents” app for students, researchers, and knowledge workers. You create **workspaces** (notebooks), add **sources** (PDFs, websites, YouTube transcripts, pasted text, or markdown), and the app indexes that material into a searchable vector store.

From there you can:

- Ask an assistant questions grounded in those sources, with inline citations back to the exact chunk (and page, for PDFs)
- Generate learning **artifacts** — summaries, key takeaways, flashcards, quizzes, mind maps, and long-form reports
- Build a personal, cross-workspace long-term memory that the assistant recalls in later conversations

The backend is a standalone Express API (`server/`). The frontend is a Next.js App Router client (`client/`). They talk over HTTP with cookie-based sessions.

Workspaces are single-owner. There is no team sharing, billing, or multi-provider auth.

## Key Features

Built and working in the codebase today:

- **Google OAuth** sign-in via Better Auth, with cookie sessions shared between the client and API
- **Workspace CRUD** — create, search, edit, delete (delete cascades to sources, conversations, artifacts, and the workspace’s Pinecone namespace)
- **Five source types** — text, markdown, PDF upload, website scrape, YouTube transcript — plus a web-search-to-source import path
- **Background source pipeline** (Inngest) — extract → chunk → embed → index, with status tracking and reprocess of failed sources
- **Source library** — search, type/status filters, grid/list view, bulk delete, live polling while sources process
- **RAG chat** — multi-conversation streaming chat with numbered citations, model selection (`gpt-4o-mini` / `gpt-4o`), optional web search, conversation export, and rolling summaries every 8 messages
- **Learning tools** — six artifact types, each with a dedicated viewer (including an interactive mind map)
- **Personal memory** (Mem0) — manual entries plus auto-learned memories, managed at `/settings/memory`
- **Light/dark theme** via `next-themes`

Not in scope / not started: automated tests, CI, artifact in-place editing, source-library pagination, providers other than Google, and shared workspaces.

## Tech Stack

| Layer       | Tool                                                        | Role                                                           |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Client      | Next.js 16 (App Router), React 19, TypeScript               | UI and server-component shell over the Express API             |
| Styling     | Tailwind CSS v4 + shadcn/ui (`base-rhea`, `@base-ui/react`) | Design system                                                  |
| Client data | TanStack Query, Zustand                                     | Server state + persisted chat preferences                      |
| Chat        | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`)     | Streaming chat and structured generation                       |
| Auth        | Better Auth                                                 | Google OAuth, cookie sessions                                  |
| API         | Express 5 (ESM)                                             | REST + streamed chat                                           |
| Database    | PostgreSQL + Prisma 7                                       | Relational data                                                |
| Vectors     | Pinecone                                                    | Per-workspace RAG namespaces                                   |
| LLM         | OpenAI                                                      | `text-embedding-3-small`, `gpt-4o-mini` / `gpt-4o`             |
| Jobs        | Inngest                                                     | Source processing, artifact generation, conversation summaries |
| Files       | Cloudinary                                                  | PDF storage                                                    |
| Ingestion   | Firecrawl, `youtube-transcript`, `unpdf`                    | Websites, YouTube, PDFs                                        |
| Web search  | Tavily                                                      | Optional chat `web_search` tool                                |
| Memory      | Mem0                                                        | Cross-workspace personal memory                                |
| Validation  | Zod v4                                                      | Request schemas                                                |

## Architecture

The client is a thin App Router shell. Feature UI lives in `client/features/*`. The server is layered: **route → controller → validator → service → repository**.

```
Browser (localhost:3000)
        │  Next.js rewrites /api/*  (or CORS + cookies in prod)
        ▼
Express API (localhost:8080)
        ├── PostgreSQL (Prisma)     workspaces, sources, chat, artifacts
        ├── Pinecone                embeddings, one namespace per workspace
        ├── OpenAI                  embeddings + chat / artifact generation
        ├── Inngest                 durable background jobs
        └── Cloudinary / Firecrawl / Tavily / Mem0   (feature-specific)
```

Auth is mounted on the **server** at `/api/auth/*`. In local dev, Next.js rewrites `/api/auth`, `/api/workspaces`, and `/api/memory` to the Express origin so the browser stays same-origin. Route protection on the client uses `client/proxy.ts` (not `middleware.ts`).

### Repository layout

```
SourceLab/
├── client/                      Next.js 16 frontend
│   ├── app/                     Routes only (auth guard + render a feature)
│   ├── features/                Feature modules (auth, chat, learn, memory, sources, workspaces)
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
│   │   ├── lib/                 Third-party clients (OpenAI, Pinecone, …)
│   │   ├── inngest/             Background job definitions
│   │   └── middleware/          Auth, uploads, error handler
│   └── prisma/                  Schema + migrations
├── context/                     Project docs — read before implementing
├── docker-compose.yml           Local Postgres (port 5434)
├── docker-compose.prod.yml      Production server image
└── AGENTS.md                    Agent/contributor reading order and skills
```

Each client feature follows `components/`, `hooks/`, `lib/{api,types,routes,constants}.ts`, and an `index.ts` barrel.

## Design System Notes

Tokens live in `client/app/globals.css` (`:root` / `.dark` + `@theme inline`). There is **no** `tailwind.config.ts`.

- **Never** hardcode hex / oklch / rgb values, and **never** use raw Tailwind palette classes (`bg-purple-500`, `text-gray-600`). Use semantic utilities: `bg-background`, `text-foreground`, `bg-primary`, `border-border`, etc.
- Base color family is **stone**; the brand accent is a lime-green `--primary`.
- Body text is **JetBrains Mono** (`font-mono` on `<html>`). Apply `font-heading` (Figtree) on titles.
- Prefer large radii (`rounded-2xl` / `rounded-3xl` / `rounded-full`) to match existing cards, dialogs, and pill controls.
- Primitives are **`@base-ui/react`**, not Radix. Polymorphic rendering uses a `render` prop (and `nativeButton={false}` on `Button`), not `asChild`.
- Icons are `lucide-react` only.

Full token tables and UI conventions: [`context/ui-tokens.md`](context/ui-tokens.md), [`context/ui-rules.md`](context/ui-rules.md).

## Getting Started

### Prerequisites

- Node.js (server Dockerfiles use Node 24)
- npm
- Docker and Docker Compose (local Postgres)
- A [Google Cloud](https://console.cloud.google.com/) OAuth client (Web application)
- API keys for OpenAI and Pinecone
- Optional, per feature: Cloudinary (PDFs), Firecrawl (website import), Tavily (chat web search), Mem0 (long-term memory)

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/SourceLab.git
cd SourceLab

cd server && npm install && cd ..
cd client && npm install && cd ..
```

There is no root `package.json`; client and server are installed separately.

### 2. Start Postgres

```bash
docker compose up -d
```

This runs `pgvector/pgvector:pg16` as `sourcelab-postgres-build`, exposing Postgres on **localhost:5434**. Database / user / password are `sourcelab` / `postgres` / `postgres`.

Pinecone is still the vector store; the pgvector image is used as plain Postgres for Prisma.

### 3. Configure environment

**Server** — copy [`server/.env.example`](server/.env.example) to `server/.env`:

```bash
cp server/.env.example server/.env
```

| Variable                                             | Required       | Notes                                                                                                               |
| ---------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                               | No             | Defaults to `8080`                                                                                                  |
| `DATABASE_URL`                                       | Yes            | Example file uses `…/projectname`. For the Compose DB use `postgresql://postgres:postgres@localhost:5434/sourcelab` |
| `BETTER_AUTH_SECRET`                                 | Yes            | Random secret for signing sessions                                                                                  |
| `BETTER_AUTH_URL`                                    | Yes            | Client origin in local dev (`http://localhost:3000`) — Next rewrites `/api/auth` to the server                      |
| `CLIENT_URL`                                         | Yes            | CORS + Better Auth trusted origin (`http://localhost:3000`)                                                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`          | Yes            | Google OAuth                                                                                                        |
| `OPENAI_API_KEY`                                     | Yes            | Chat, artifacts, embeddings                                                                                         |
| `PINECONE_API_KEY`                                   | Yes            | RAG index (auto-created if missing)                                                                                 |
| `PINECONE_INDEX`                                     | No             | Defaults to `sourcelab` (1536 dims, cosine)                                                                         |
| `INNGEST_DEV`                                        | Local          | Set to `1` for the Inngest dev server                                                                               |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` | PDF uploads    | Unsigned preset; API key/secret optional for signed re-download                                                     |
| `FIRECRAWL_API_KEY`                                  | Website import | Website sources fail validation without it                                                                          |
| `TAVILY_API_KEY`                                     | Optional       | Chat web-search toggle is a no-op if unset                                                                          |
| `MEM0_API_KEY`                                       | Optional       | Memory APIs return empty / no-op if unset                                                                           |

Configure the Google OAuth client’s authorized redirect URI to match Better Auth’s callback on the client origin (local default: `http://localhost:3000/api/auth/callback/google`).

**Client** — there is no `.env.example`. Defaults work for local dev:

| Variable              | Default                 | Used for                                      |
| --------------------- | ----------------------- | --------------------------------------------- |
| `API_URL`             | `http://localhost:8080` | Next rewrites + server-side workspace fetches |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Session fetch origin                          |

Create `client/.env` only if you need to override those.

### 4. Migrate the database

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

### 5. Run the app

Use three terminals (plus Postgres from step 2):

```bash
# Terminal 1 — API
cd server
npm run dev
```

```bash
# Terminal 2 — Inngest (source processing, artifacts, summaries)
cd server
npm run inngest:dev
```

```bash
# Terminal 3 — Next.js
cd client
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The API health check is [http://localhost:8080/health](http://localhost:8080/health).

## Available Scripts

### `client/`

| Script  | Command      | Purpose                    |
| ------- | ------------ | -------------------------- |
| `dev`   | `next dev`   | Dev server (port 3000)     |
| `build` | `next build` | Production build           |
| `start` | `next start` | Serve the production build |
| `lint`  | `eslint`     | Lint                       |

### `server/`

| Script            | Command                  | Purpose                                                    |
| ----------------- | ------------------------ | ---------------------------------------------------------- |
| `dev`             | `tsx watch src/index.ts` | API with reload (port 8080)                                |
| `build`           | `tsc`                    | Compile to `dist/`                                         |
| `start`           | `node dist/index.js`     | Run the compiled API                                       |
| `prisma:generate` | `prisma generate`        | Generate the Prisma client (`server/src/generated/prisma`) |
| `prisma:migrate`  | `prisma migrate dev`     | Dev migrations                                             |
| `prisma:studio`   | `prisma studio`          | Browse the database                                        |
| `inngest:dev`     | `inngest-cli dev`        | Local Inngest Dev Server                                   |

## Project Conventions

See [`context/code-standards.md`](context/code-standards.md) for the full list. The short version:

- **Feature-first client** — new UI goes in `client/features/<name>/`. `app/` files stay thin.
- **Layered server** — controllers never call Prisma; services never touch `req`/`res`; repositories are Prisma-only.
- **kebab-case** files and folders. Server files are suffixed by role (`*.controller.ts`, `*.service.ts`, …). React components: PascalCase export, kebab-case filename, one component per file.
- **Strict TypeScript** on both packages. Server is ESM — relative imports use explicit `.js` extensions in `.ts` source.
- **Zod** is the source of truth for request shapes (`z.infer<typeof schema>`). Responses are plain JSON, not a `{ success, data }` envelope.
- **`apiFetch`** in `client/shared/lib/api.ts` is the only JSON `fetch` wrapper. Components talk to the API through feature hooks, not directly.
- **JSDoc** on exported server service/lib functions — explain why, not the next line of code.
- **Commits** in this repo follow Conventional Commits (`feat:`, `chore:`, `init:`). Match that style.
- Client imports use `@/` aliases. Don’t add a package that shadcn, an existing `lib/` wrapper, or Zod/React Query already covers.

## Component Registry

Before adding UI, check [`context/ui-registry.md`](context/ui-registry.md). It inventories:

- Generated primitives in `client/components/ui/`
- Feature components under `client/features/*/components/`

Reuse an existing primitive or feature component instead of duplicating one. After you add, rename, or remove a component, update that registry (and run `/imprint` — see below).

## Development Workflow

This repo is set up for Cursor / Claude Code agents. Before implementing anything, read the files listed in [`AGENTS.md`](AGENTS.md) in order (`context/project-overview.md` through `context/progress-tracker.md`).

Custom skills:

| Skill               | When to use                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `/architect`        | Before any complex feature — align on language and plan before writing code |
| `/imprint`          | After any new UI component — capture patterns into `ui-registry.md`         |
| `/review`           | After a feature, before a demo, or when something feels off                 |
| `/recover`          | When something breaks after one failed correction                           |
| `/remember save`    | End of a session that spans more work                                       |
| `/remember restore` | Start of a new session continuing that work                                 |

If the same problem persists after **one** corrective prompt, stop and run `/recover`. Do not keep patching in a loop.

Also:

- Never hardcode colors or raw Tailwind palette classes
- Update `context/progress-tracker.md` and `context/ui-registry.md` after every feature
- Before adding a third-party library, read its installed skill (if any), then [`context/library-docs.md`](context/library-docs.md)

## Roadmap / Current Progress

**Phase:** Core product is feature-complete (auth, workspaces, sources/RAG, chat, learning artifacts, memory).

**Recently done:** Cleanup of leftover client auth/provider files from the feature-folder migration; optional `MEM0_API_KEY` and `TAVILY_API_KEY` documented in `server/.env.example`.

**Likely next** (not committed as in-repo priorities — confirm with the maintainer):

- Automated tests and CI (none exist today)
- Pagination on the source library
- In-place artifact editing (today: delete and regenerate)
- Decide whether unused `recharts` / toast primitives stay or get wired up

Details: [`context/build-plan.md`](context/build-plan.md), [`context/progress-tracker.md`](context/progress-tracker.md).

## Contributing

1. Read [`AGENTS.md`](AGENTS.md) and the `context/` docs before changing code.
2. Follow [`context/code-standards.md`](context/code-standards.md) and the design-system notes above.
3. Keep `app/` routes thin; put logic in features (client) or services (server).
4. For UI work, check and update [`context/ui-registry.md`](context/ui-registry.md).
5. After a feature, update [`context/progress-tracker.md`](context/progress-tracker.md).
6. Run `/architect` before large work and `/review` before considering it done.

There is no test suite or PR template in the repo yet.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
