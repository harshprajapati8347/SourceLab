# Architecture

## Stack

| Layer                 | Tool                                                     | Purpose                                                             |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Client framework      | Next.js 16 (App Router), React 19, TypeScript             | Full stack-capable frontend, used here as a client + server-component shell over the Express API |
| Client styling        | Tailwind CSS v4 + shadcn/ui (`base-rhea` style, `base-ui/react` primitives) | Design system and components |
| Client state (server) | `@tanstack/react-query`                                    | Data fetching, caching, mutations against the API |
| Client state (local)  | `zustand`                                                  | Small persisted UI state (chat preferences: model + web search toggle) |
| Chat streaming        | `ai` (Vercel AI SDK) + `@ai-sdk/react` + `@ai-sdk/openai`  | `useChat`, `DefaultChatTransport`, `streamText`/`generateText` |
| Auth (client)         | `better-auth/react`                                        | `createAuthClient`, `signIn`, `signOut`, `useSession` |
| Markdown rendering    | `streamdown` (+ `@streamdown/code`)                        | Renders streamed/markdown chat and report content |
| Mind maps             | `@xyflow/react`                                            | Interactive node/edge mind map viewer |
| Dark mode             | `next-themes`                                              | Theme provider + toggle |
| Server framework      | Express 5 (ESM, TypeScript, `tsx` for dev)                 | REST API |
| Auth (server)         | `better-auth` + `better-auth/adapters/prisma`              | Google OAuth, session issuance, mounted at `/api/auth/*` |
| ORM / DB              | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) + PostgreSQL | Relational data: users, workspaces, sources, chunks, conversations, messages, artifacts |
| Vector store          | Pinecone (`@pinecone-database/pinecone`)                    | RAG embeddings, one namespace per workspace |
| Embeddings + chat LLM | OpenAI (`openai` SDK for embeddings, `@ai-sdk/openai` for chat/generation) | `text-embedding-3-small` embeddings, `gpt-4o-mini`/`gpt-4o` chat |
| Background jobs       | Inngest (`inngest`, `inngest-cli`)                          | Durable pipelines: source processing, artifact generation, conversation summarization |
| File storage          | Cloudinary                                                  | PDF upload storage (unsigned preset, signed fallback for re-download) |
| Website scraping      | Firecrawl (`@mendable/firecrawl-js`)                        | Converts a URL into clean markdown for indexing |
| YouTube transcripts   | `youtube-transcript`                                        | Extracts caption text from a YouTube URL |
| Web search            | Tavily (`@tavily/core`)                                     | Chat "web_search" tool for up-to-date info outside the workspace |
| Long-term memory      | Mem0 (`mem0ai`)                                              | Per-user semantic memory, manual + auto-learned from chat |
| PDF text extraction   | `unpdf`                                                      | Extracts text (and per-page text) from PDF buffers |
| Validation            | `zod` (v4)                                                   | Request body/param/query schemas on the server |
| Uploads               | `multer`                                                     | Multipart PDF upload middleware |

---

## Folder Structure

```
/
├── context/                       → This documentation (read before implementation)
├── docker-compose.yml             → Local Postgres (pgvector image, port 5434) for dev
├── client/                        → Next.js 16 App Router frontend
│   ├── app/
│   │   ├── layout.tsx             → Root layout — fonts, ThemeProvider, QueryProvider
│   │   ├── page.tsx               → Homepage — redirects to dashboard or shows sign-in CTA
│   │   ├── globals.css            → Tailwind v4 theme tokens (CSS variables)
│   │   ├── (auth)/
│   │   │   └── login/page.tsx     → Login page (renders LoginForm)
│   │   └── (protected)/
│   │       ├── dashboard/page.tsx
│   │       ├── settings/memory/page.tsx
│   │       └── workspace/[id]/
│   │           ├── page.tsx                       → Chat
│   │           ├── learn/page.tsx                 → Learn hub
│   │           ├── learn/[artifactId]/page.tsx    → Artifact viewer
│   │           ├── sources/page.tsx               → Source library
│   │           ├── sources/[sourceId]/page.tsx    → Source detail
│   │           └── settings/page.tsx              → Workspace settings
│   ├── features/                  → Feature-based modules (primary organizational unit)
│   │   ├── auth/                  → login form, sign-out button, session hook, auth-client/server, route helpers
│   │   ├── chat/                  → chat UI, citations, conversation hooks, chat-preferences store, markdown export
│   │   ├── learn/                 → artifact hub, generate dialog, per-type viewers
│   │   ├── memory/                → memory settings page, form dialog, hooks
│   │   ├── sources/                → source library, add-source dialog, source card/detail, hooks
│   │   └── workspaces/             → dashboard, workspace shell (sidebar), workspace CRUD dialogs, hooks
│   │       Each feature folder follows: components/, hooks/, lib/{api,types,routes,constants}.ts, index.ts (barrel export)
│   ├── components/ui/              → shadcn/ui primitives (button, dialog, sidebar, message, attachment, etc.) — generated, not hand-rolled
│   ├── shared/
│   │   ├── components/providers/   → QueryProvider, ThemeProvider (active app-wide providers)
│   │   ├── components/streamdown-content.tsx
│   │   ├── hooks/                  → use-mobile, use-debounced-value
│   │   └── lib/api.ts              → apiFetch() + ApiError — single fetch wrapper for all client API calls
│   ├── lib/utils.ts                → cn() helper (used everywhere)
│   ├── lib/auth-*.ts, unauth.ts, require-auth.ts, components/auth/, components/providers/, hooks/use-mobile.ts
│   │                                → ⚠️ Legacy duplicates of features/auth and shared/*. Nothing in the app
│   │                                  imports these anymore — see "Known Issues" below.
│   └── components.json             → shadcn config (style: base-rhea, base color: stone, icon lib: lucide)
└── server/                         → Express API
    ├── src/
    │   ├── index.ts                → App entrypoint — CORS, Better Auth mount, Inngest mount, route registration
    │   ├── routes/                 → Express routers (thin, no logic) — nested under /api/workspaces/:workspaceId/*
    │   ├── controllers/             → Parse + validate request, call a service, shape the response
    │   ├── validators/              → Zod schemas per resource
    │   ├── services/                → Business logic (auth-agnostic of Express req/res)
    │   ├── repositories/            → Prisma queries only — no business logic
    │   ├── lib/                     → Third-party client wrappers (openai, pinecone, mem0, cloudinary, firecrawl,
    │   │                              tavily, youtube, pdf, chunking, auth, db, ai-config) + lib/rag/retrieve.ts
    │   ├── inngest/                 → Inngest client + durable function definitions
    │   ├── middleware/              → requireAuth, upload (multer), error-handler
    │   ├── types/                   → AppError hierarchy, Express type augmentation (req.session)
    │   └── utils/                   → asyncHandler, chat-message helpers, zod error formatting
    └── prisma/
        ├── schema.prisma            → Data model (see below)
        └── migrations/               → Applied migrations (better_auth, workspace_and_source, chat_and_artifact)
```

---

## System Boundaries

| Layer                                  | Owns                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `client/app/`                            | Route entrypoints only — auth guard (`requireAuth`), data prefetch, render a feature component. No business logic. |
| `client/features/*/components/`          | UI + local interaction state. Talk to the server only through the feature's `lib/api.ts` (via hooks). |
| `client/features/*/hooks/`               | React Query hooks — wrap `lib/api.ts` calls in `useQuery`/`useMutation`, own cache keys/invalidation. |
| `client/features/*/lib/api.ts`           | Thin wrappers around `apiFetch()` — one function per endpoint. No React. |
| `client/shared/`, `client/components/ui/`| Cross-feature primitives and utilities. `components/ui` is shadcn-generated; don't hand-edit patterns that would be lost on regeneration without noting it. |
| `server/routes/`                         | URL → controller wiring only. |
| `server/controllers/`                    | Parse `req`, validate with a Zod schema, call one service function, send the response. No Prisma, no third-party SDK calls. |
| `server/services/`                       | All business logic and orchestration across repositories + third-party libs. Never touch `req`/`res`. |
| `server/repositories/`                   | Prisma queries only, one file per model/aggregate. No business rules. |
| `server/lib/`                            | Singleton clients and pure integration helpers for third-party services. |
| `server/inngest/`                        | Durable, retryable multi-step workflows that call into `services/`. |

---

## Data Flow

### Client request lifecycle

```
Page/Component (Server Component reads via requireAuth + direct fetch, or Client Component via a React Query hook)
        ↓
features/<name>/lib/api.ts → apiFetch(path, options)   (shared/lib/api.ts, credentials: "include")
        ↓
Express route → requireAuth middleware → controller → validator (zod) → service → repository → Prisma → Postgres
        ↓
JSON response (or streamed UI message stream for chat)
```

### Source ingestion → RAG indexing (Inngest: `process-source`)

```
User adds a source (text/markdown/PDF/website/YouTube)
        ↓
Source row created with status PENDING; source-specific import fetches/scrapes/uploads content
        ↓
inngest.send("source/created", { sourceId })
        ↓
step: mark-processing        → status = PROCESSING
step: extract-content        → read source.content, or download PDF from Cloudinary + unpdf extract
step: chunk-content           → chunkText/chunkPages (recursive separator splitter, ~1000 chars, 100 overlap)
                                 → SourceChunk rows saved to Postgres
step: embed-and-index         → OpenAI embeddings (batches of 50) → Pinecone upsert (workspace namespace, batches of 100)
                                 → status = READY, metadata.chunkCount/indexedAt set
        ↓ (on any step throwing)
step: mark-failed             → status = FAILED, metadata.processingError set; Inngest retries the function up to 3x
```

### Chat (RAG + streaming)

```
Client useChat → POST /api/workspaces/:workspaceId/chat  (DefaultChatTransport, streamed)
        ↓
streamWorkspaceChat():
  - resolve/create Conversation, save user Message
  - in parallel: retrieveWorkspaceContext() [embed query → Pinecone query, filter by RAG_MIN_SCORE, top RAG_TOP_K]
                 searchUserMemories() [Mem0 semantic search]
  - buildChatSystemPrompt() from chunks + memories + conversation summary + web-search availability
  - streamText() (AI SDK) with optional web_search tool (Tavily), streamed back as a UI message stream
  - onFinish: save assistant Message + citations, touch conversation, auto-title if new,
              every CONVERSATION_SUMMARY_INTERVAL (8) messages → enqueue conversation/summarize,
              fire-and-forget Mem0 addMemoriesFromMessages()
        ↓
Response headers include X-Conversation-Id so the client can adopt a newly created conversation
```

### Learning artifact generation (Inngest: `generate-artifact`)

```
User picks an artifact type + optional title → POST /api/workspaces/:workspaceId/artifacts
        ↓
LearningArtifact row created (status PENDING) → inngest.send("artifact/generate", { artifactId })
        ↓
step: generate → gatherSourceContext() [concatenate READY sources, max 120k chars]
               → generateArtifactContent() [AI SDK generateText/Output.object with a type-specific Zod schema]
               → artifact saved with content JSON, status READY (or FAILED)
```

### Conversation summarization (Inngest: `summarize-conversation`)

```
Message count % 8 === 0 → conversation/summarize event
        ↓
summarizeConversationById(): generateText() rolls the previous summary + full transcript into an updated summary,
saves it on Conversation, and feeds the last 16 messages to Mem0 for long-term learning
```

---

## Database Schema (Prisma / PostgreSQL)

Auth tables (`user`, `session`, `account`, `verification`) are owned by Better Auth's Prisma adapter — do not hand-edit their shape without checking Better Auth's migration expectations.

### `workspace`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | |
| userId | String | Owner, FK → user, cascade delete |
| title | String | |
| description | String? | |
| icon | String? | Emoji shown in sidebar/cards |
| defaultModel | String | Default `"gpt-4o-mini"` |
| createdAt / updatedAt | DateTime | |

### `source`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | |
| workspaceId | String | FK → workspace, cascade delete |
| type | enum `SourceType` | `PDF \| WEBSITE \| YOUTUBE \| TEXT \| MARKDOWN` |
| title | String | |
| content | String? | Extracted/raw text (null until processed for PDFs) |
| url | String? | Original URL for WEBSITE/YOUTUBE sources |
| status | enum `SourceStatus` | `PENDING \| PROCESSING \| READY \| FAILED` |
| metadata | Json? | `fileUrl`, `fileName`, `fileSize`, `publicId`, `resourceType`, `importedFrom`, `videoId`, `processingError`, `chunkCount`, `pageCount`, `indexedAt` |

### `source_chunk`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | Reused as the Pinecone vector id |
| sourceId | String | FK → source, cascade delete |
| index | Int | Sequential within a source (unique with sourceId) |
| content | String | Chunk text |
| tokenCount | Int? | Estimated as `content.length / 4` |
| metadata | Json? | `{ page?: number }` for PDF chunks |

### `conversation`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | |
| workspaceId | String | FK → workspace, cascade delete |
| title | String? | Auto-generated from the first user message |
| summary | String? | Rolling summary, updated every 8 messages |
| summaryMessageCount | Int | Message count at last summarization |
| summarizedAt | DateTime? | |

### `message`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | |
| conversationId | String | FK → conversation, cascade delete |
| role | enum `MessageRole` | `USER \| ASSISTANT` |
| content | String | Plain text |
| citations | Json? | Array of `{ sourceId, sourceTitle, sourceType, chunkId, chunkIndex, page?, excerpt, score? }` or web citations `{ sourceType: "WEB", sourceTitle, url, excerpt }` |

### `learning_artifact`
| Column | Type | Notes |
| --- | --- | --- |
| id | String (cuid) | |
| workspaceId | String | FK → workspace, cascade delete |
| type | enum `ArtifactType` | `SUMMARY \| TAKEAWAYS \| FLASHCARDS \| QUIZ \| MINDMAP \| REPORT` |
| title | String | |
| content | Json? | Type-specific structured payload (see `library-docs.md` for shapes) |
| sourceIds | String[] | Sources actually used to generate this artifact |
| status | enum `ArtifactStatus` | `PENDING \| PROCESSING \| READY \| FAILED` |
| metadata | Json? | |

---

## Vector Storage (Pinecone)

- One Pinecone index (`PINECONE_INDEX`, default `sourcelab`), auto-created with 1536 dimensions / cosine metric on first use if missing
- **One namespace per workspace** (`index.namespace(workspaceId)`) — deleting a workspace deletes its whole namespace
- Each vector's id is the `source_chunk.id`; metadata carries everything retrieval needs without a second Postgres round-trip (`workspaceId`, `sourceId`, `chunkId`, `chunkIndex`, `sourceTitle`, `sourceType`, `text` (truncated to 35k chars), optional `page`)
- Note: `docker-compose.yml` runs a `pgvector/pgvector` Postgres image for local dev, but pgvector itself is **not** used for embeddings in this codebase — all vector search goes through Pinecone. The pgvector image is only relevant if it's providing the plain Postgres database for Prisma.

---

## Authentication

- Provider: Google OAuth only, via Better Auth
- Better Auth is mounted on the **server** at `app.all("/api/auth/{*any}", toNodeHandler(auth))` — the client's `better-auth/react` client talks directly to this server route
- Sessions are cookie-based; the client always calls `fetch` with `credentials: "include"` (`shared/lib/api.ts`)
- Server routes: `requireAuth` middleware (`server/src/middleware/require-auth.middleware.ts`) validates the session via `auth.api.getSession()` and attaches it to `req.session`; every workspace-scoped and memory route requires it
- Client pages: Server Components call `requireAuth()` (`features/auth/lib/require-auth.ts`) which redirects to `/login` if there's no session; the login page calls `unauth()` to redirect signed-in users to the dashboard
- Every workspace-scoped query/mutation on the server is additionally scoped by `userId` (`findWorkspaceByIdAndUserId`) so users can only access their own workspaces/sources/conversations/artifacts

---

## Known Issues / Cleanup Candidates

- `client/lib/auth-client.ts`, `auth-server.ts`, `auth-routes.ts`, `require-auth.ts`, `unauth.ts`, `client/components/auth/*`, `client/components/providers/*`, and `client/hooks/use-mobile.ts` are **orphaned duplicates** of `client/features/auth/*` and `client/shared/*`. Nothing in the active app imports them (verified by search). They appear to be leftovers from a migration to the feature-based folder structure and are candidates for deletion.
- `client/app/(auth)/layout.tsx` and `client/lib/utils.ts` vs feature-local equivalents should be checked the same way before assuming any top-level `client/lib` or `client/components` file (outside `components/ui`) is still live.
