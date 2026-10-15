# Library Docs

Project-specific usage notes for every third-party library actually installed in `client/package.json` and `server/package.json`. This file documents how **this project** uses each library — check here before assuming a general-knowledge API pattern, since these libraries version and change quickly.

---

## Before Using Any Library

1. Check the relevant installed skill (see `AGENTS.md`/`CLAUDE.md` at the repo root) for up-to-date API docs.
2. Check if an MCP server is configured for that library/service.
3. Read this file for the project-specific pattern already in use.
4. Fall back to general knowledge only if none of the above cover it — and note the version pinned in `package.json` before assuming an API shape.

---

## Server

### Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`, `prisma`)

- Generator output is customized: `output = "../src/generated/prisma"` in `server/prisma/schema.prisma` — the client is generated into `server/src/generated/prisma`, not `node_modules/.prisma`. Import types from there: `import type { Prisma } from "../generated/prisma/client.js"`.
- Client instance is a singleton in `server/src/lib/db.ts` (`import prisma from "../lib/db.js"`) — never instantiate a second `PrismaClient`.
- Repositories always `select` an explicit set of columns (a `const xSelect = {...} as const` object) rather than returning the full row — derive types with `Prisma.<Model>GetPayload<{ select: typeof xSelect }>`.
- Migrations live in `server/prisma/migrations/`; run `pnpm prisma:migrate` (dev). Production containers run `prisma migrate deploy` on boot (`server/Dockerfile.prod`). The `prisma` CLI is a **production** dependency (not only a devDependency) so `prisma.config.js` can resolve `prisma/config` inside the image. Do not use `npx prisma` at boot — npx downloads a detached CLI that cannot load that module. The config is JavaScript (not TypeScript) so the runtime image does not need the `typescript` package.
- Better Auth owns the `user`/`session`/`account`/`verification` models via `prismaAdapter(prisma, { provider: "postgresql" })` — don't hand-edit their schema without checking Better Auth's expectations first.

### Better Auth (`better-auth`)

```typescript
// server/src/lib/auth.ts
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? clientUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [clientUrl],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  },
  plugins: [stripe({ /* Pro plan from STRIPE_PRO_PRICE_ID; skipped if Stripe env is missing */ })],
});
```

- Mounted once in `server/src/index.ts`: `app.all("/api/auth/{*any}", toNodeHandler(auth))`, **before** `express.json()` (required for Stripe webhook signatures).
- Session check in middleware: `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` → attach to `req.session` (typed via `server/src/types/express.d.ts`).
- Google social provider plus email/password. Stripe plugin: `@better-auth/stripe` (server + client). See `context/billing-and-credits.md`.
- Better Auth 1.7 requires `Account.issuer`. Google accounts use `https://accounts.google.com`. Schema + unique `(issuer, accountId)` live in `prisma/schema.prisma`; do not drop that column.
- Client side uses `better-auth/react`'s `createAuthClient()` plus `stripeClient({ subscription: true })` — `signIn.social`, `signIn.email`, `signUp.email`, `signOut()`, `useSession()`, `subscription.upgrade` / `billingPortal`.

### Express 5 (`express`)

- ESM throughout; routes are `Router()` instances composed in `server/src/routes/index.ts`, with nested resource routers mounted via `workspaceRoutes.use("/:workspaceId/sources", sourceRoutes)` and `Router({ mergeParams: true })` on the nested routers so `req.params.workspaceId` is available.
- `cors({ origin: clientUrl, credentials: true })` is required for the cookie-based session to work cross-origin in dev (client on `:3000`, server on `:8080`).

### Zod v4 (`zod`)

- One `*.validator.ts` file per resource; schemas are composed (`workspaceIdParamSchema.extend({...})`) rather than duplicated.
- `z.discriminatedUnion("type", [...])` is used where a request body shape depends on a `type` field (see `createSourceSchema`).
- Error formatting on the server uses `flattenError(error).fieldErrors` (Zod v4 API) in the global error handler — not the v3 `error.flatten()` method.

### Inngest (`inngest`, `inngest-cli`)

```typescript
// server/src/inngest/index.ts
export const processSource = inngest.createFunction(
  { id: "process-source", retries: 3, triggers: [{ event: "source/created" }] },
  async ({ event, step }) => {
    await step.run("mark-processing", () => markSourceProcessing(event.data.sourceId));
    // ...
  },
);
export const functions = [processSource, generateArtifact, summarizeConversation];
```

- Served at `/api/inngest` via `serve({ client: inngest, functions })` (`inngest/express`) in `server/src/index.ts`.
- Local dev: run `pnpm inngest:dev` (or `npx inngest-cli@latest dev`) alongside `pnpm dev`; `INNGEST_DEV=1` in `.env` enables dev mode.
- Events are triggered with `inngest.send({ name: "...", data: {...} })` from services (e.g. after creating a source, after creating an artifact, when the summary interval is hit, from Stripe billing hooks) — never call the pipeline functions directly from a controller.
- Each `step.run(name, fn)` should be safely retryable; wrap the whole handler in `try/catch` when a failure needs to update a status field (see `processSource`'s `mark-failed` step).

### AI SDK — `ai` + `@ai-sdk/openai` (server-side generation/streaming)

```typescript
// Streaming chat (chat.service.ts)
const result = streamText({
  model: openai(chatModel),          // chatModel: "gpt-4o-mini" | "gpt-4o"
  system: systemPrompt,
  messages: await convertToModelMessages(contextMessages),
  tools: webSearchEnabled ? { web_search: tool({ description, inputSchema: z.object({...}), execute }) } : undefined,
  stopWhen: webSearchEnabled ? isStepCount(3) : undefined,
});
const drafted = (await result.text).trim();
// Grounding, then local output guardrails, run before any text chunk is written.
writer.write({ type: "data-citations", id: "citations", data: citations });
writer.write({ type: "text-start", id: "assistant-text" });
writer.write({ type: "text-delta", id: "assistant-text", delta: safeText });
writer.write({ type: "text-end", id: "assistant-text" });

// Non-streaming structured generation (artifact-generation.service.ts)
const result = await generateText({
  model: openai(CHAT_MODEL),
  system,
  output: Output.object({ schema: someZodSchema }),
  prompt: "...",
});
return result.output;
```

- Chat responses are wrapped with `createUIMessageStream({ originalMessages, execute, onFinish })` and sent with `pipeUIMessageStreamToResponse({ response: res, stream, headers: { "X-Conversation-Id": id } })` — this is how the client learns a new conversation's id (via a response header, not the JSON body, since the body is a streamed UI message stream).
- Tool calls use `tool({ description, inputSchema: z.object({...}), execute })`; `stopWhen: isStepCount(n)` caps how many tool-call round-trips the model can make.
- `Output.object({ schema })` + `generateText` is the pattern for structured (non-chat) generation — used for all six artifact types and conversation summaries.
- Model ids and allow-list live in `server/src/lib/ai-config.ts` (`CHAT_MODEL`, `CHAT_MODELS`) — always validate a client-supplied model against `CHAT_MODELS` before passing it to `openai(...)`.
- Query and context intelligence (`server/src/lib/rag/query-intelligence.ts`, `retrieval-quality.ts`, `context-intelligence.ts`, `answer-grounding.ts`, orchestrated by `server/src/services/rag-pipeline.service.ts` and `chat.service.ts`) uses `generateText` + `Output.object` on `RAG_INTELLIGENCE_MODEL` (`gpt-4o-mini`), even when the answer model is `gpt-4o`. Classification, HyDE, corrective rewrites, the coverage/contradiction judgement, and the output grounding judge go through this path. Embeddings stay on the `openai` SDK. The same steps are printed as `[rag]` console lines and streamed as a `data-rag` part, then saved on `Message.trace`.

### OpenAI SDK (`openai`) — embeddings only

- The raw `openai` SDK is used for embeddings (`server/src/lib/openai.ts`). Chat and artifact generation go through the AI SDK (`@ai-sdk/openai`). Don't send chat completions through the embeddings client. Query embedding, HyDE passage embedding, multi-query embedding, and semantic-dedup embedding all go through `embedTexts`.

### Local guardrails — chat input and output gates

- The chat gates are the local guards in `server/src/lib/guardrails`. Switches live in `server/src/lib/config/guardrails.ts`.
- `server/src/lib/input-guardrails.ts` runs `InputGuardService` on the latest user message before RAG or `streamText`. Always on: empty query, 4000-character max, NFKC normalization, and control-character removal. Enabled by config: prompt injection, jailbreak, SQL injection, XSS, path traversal, spam, and PII. `UrlGuard` runs only when `ALLOW_URLS` is false (it is true). `PiiGuard` still rejects http(s) URLs, plus emails, phone numbers, payment numbers, IPs, UUIDs, tokens, API keys, private keys, PAN, Aadhaar, GSTIN, and IFSC values that `PiiDetector` matches. Normalization and control-character removal change only the text sent to retrieval and the model. The stored user message stays the original text.
- A rejection becomes `InputBlockedError` (HTTP 400, `{ code: "INPUT_BLOCKED", guardrail, message }`). The banner is a short sentence for that guard and does not include the query or the detected value. `message` is the exact user text that was checked. The chat transport reads `error` from any non-OK JSON body and shows it in the existing banner, and puts `message` back in the composer.
- Blocked messages are not saved, not charged, and do not create a conversation. A guard that throws for any other reason fails the request closed.
- Output (`server/src/lib/output-guardrails.ts`) runs after grounding and the release transforms, and before any answer text is written to the client. The model token stream is not merged into the UI stream. Always on: NFKC normalization, control-character removal, and `MaximumLengthGuard` (25000 characters). Enabled by config: empty response, citation shape (`[]` and duplicate ids), sensitive data (`PiiDetector`), prompt leakage, chain-of-thought leakage, hallucinated numeric citations, markdown link sanitizing, and unsafe HTML. `sources` passed into the check is the workspace chunk list in `[1]` order. `[W#]` is not a numeric index into that list. A rejection replaces the reply with a fixed sentence. A sanitizing guard releases the modified text. The draft and the matched phrase are not sent. A check that throws uses the same withhold sentence as a failed check and does not release the model text. Citation excerpts are shortened to 280 characters and are not masked. `SensitiveDataGuard` replaces the whole reply when the generated text contains PII, including an http(s) URL or a value grounding kept because a source stated it.
- Grounding stays in `server/src/lib/rag/answer-grounding.ts`. It scores distinct facts against the Pinecone chunks and web snippets already retrieved, using `generateText` + `Output.object` on `RAG_INTELLIGENCE_MODEL`. A claim is removed when its citation is missing, or when the cited passage does not contain the claimed email, phone, number, or a name later in the sentence. A faithful paraphrase that cites a retrieved chunk or web result is kept. The first capitalized word of a sentence is not treated as a name. A sentence that says a detail is missing stays in the answer and is not counted. Repeated wording of the same fact counts once. The canned refusal is used only when the reply cites nothing that was retrieved. A check that throws does not release the model text. Web markers are one list: a later `web_search` call appends pages and continues `[W#]` numbering. A `[W#]` marker is removed when that page does not support the sentence. Pages are not cited just because they were retrieved. `HallucinatedCitationGuard` then rejects a numeric `[n]` outside the workspace chunk list. It does not rescore claims.
- Coverage (`supported / total`) and each output decision are `[rag]` trace steps on the assistant message. The trace is streamed and returned on the message API only when `RAG_TRACE_ENABLED=true`. It is still stored on the assistant message.
- Summarization questions sample an opening chunk from each READY source, then fill toward the context budget, and skip the corrective similarity pass.
- When coverage is below `RAG_TOPIC_COVERAGE_FLOOR` (0.35), or the question's content words are absent from the passages, the chat model is not asked to invent an answer. The same check runs after a classifier or quality-judgement fallback. If a content word from the question appears in the retrieved passages or ready source titles, the reply says the workspace sources do not specify that fact. A current or official external question with web search on runs Tavily immediately instead. Otherwise the reply names the missing topic and the notebook focus, and asks "Would you like me to perform web research on {topic}?" A suggestion chip says "Yes, search the web". A short yes runs Tavily for that topic even if the toggle is still off. Sending that same topic again runs Tavily only when the toggle is on. A later unrelated question does not inherit the yes. An empty or failed search, or results with no http(s) URL, becomes a failure reply with no citations. A question that names two numbers keeps both passages when they differ, and the answer states each value with the date in that source. After each released reply, one `gpt-4o-mini` call suggests at most three short next questions. They are streamed as `data-suggestions` and stored on `Message.trace.suggestions`, and the messages API returns them even when `RAG_TRACE_ENABLED` is not set. Web pages are labeled as outside the workspace. A factual draft with no supporting passage is replaced by the research offer when this request was not allowed to search.
- `EMBEDDING_MODEL = "text-embedding-3-small"`, `EMBEDDING_DIMENSIONS = 1536` (must match the Pinecone index dimension). `embedTexts(texts: string[])` batches internally is the caller's job (see `embedAndIndexSource`, batches of 50) — the function itself does not chunk large arrays.

### Pinecone (`@pinecone-database/pinecone`)

- Singleton client + lazy index creation (`ensurePineconeIndex()`), 1536 dims, cosine metric, serverless AWS `us-east-1` — auto-created on first use if the named index doesn't exist.
- **One namespace per workspace**: `index.namespace(workspaceId)`. All reads/writes/deletes go through the namespace, never the bare index.
- Batch upserts at 100 records; batch embeddings at 50 texts per OpenAI call (two independent batch sizes, don't conflate them).
- `deleteSourceVectors` filters by `{ sourceId: { $eq: sourceId } }` metadata; `deleteWorkspaceVectors` calls `namespace.deleteAll()` — used when a workspace is deleted (best-effort, wrapped in try/catch so a Pinecone failure never blocks the Postgres delete).

### Mem0 (`mem0ai`)

- Singleton `MemoryClient` (`getMem0Client()`), requires `MEM0_API_KEY`; every public function checks the key first and returns `[]`/no-ops instead of throwing when it's absent — memory is a soft dependency.
- Two scopes on the same Mem0 user, stored in metadata. `scope: "user"` has no `workspaceId` and is recalled in every notebook. `scope: "workspace"` plus `workspaceId` is recalled only in that notebook. `source: "manual" | "learned"` is unchanged, and `mapMemory()` derives both `source` and `scope` from metadata.
- `addUserMemory` (manual, `infer: false`) vs `addMemoriesFromMessages` (auto-learned, `infer: true`, fire-and-forget from chat). Chat learning and the summary sync write notebook memory. A manual add on `/settings/memory` is user memory; a manual add with `workspaceId` is notebook memory.
- Chat recall searches both scopes (`topK: 8`, `threshold: 0.1` each) and keeps 8 combined, ordered by score. Filters use `user_id` and a nested `metadata` object (`{ scope }` and, for a notebook, `workspaceId`). Dotted keys such as `metadata.scope` are rejected. Results that do not match the requested scope are dropped. `add` with `infer: false` returns `{ results: [{ id, data: { memory } }] }`, not a bare array.
- Rows with no `scope` are stamped once per process: a `conversationId` that still belongs to a notebook this user owns becomes notebook memory; every other row becomes user memory. Deleting a notebook deletes its notebook memories by id. Do not call `deleteAll` with only `user_id`.
- Never call the Mem0 SDK directly from a controller/service outside `server/src/lib/mem0.ts` — go through its exported functions. Scope rules and ownership checks live in `server/src/services/memory.service.ts`.

### Cloudinary (`cloudinary`)

- Upload uses an **unsigned preset** (`CLOUDINARY_UPLOAD_PRESET`) via raw `fetch` to `https://api.cloudinary.com/v1_1/{cloud_name}/raw/upload` with a `FormData` body — not the `cloudinary` SDK's own upload helper.
- The `cloudinary` SDK (`v2`) is used only for generating **signed download URLs** as a 401 fallback (`getSignedCloudinaryDownloadUrl`), which requires `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` in addition to the cloud name.
- PDFs are uploaded to the `sourcelab/pdfs` folder; `resourceType` is tracked per source (`"raw" | "image"`) since Cloudinary sometimes classifies PDFs as `image` resources.

### Firecrawl (`@mendable/firecrawl-js`)

- `client.scrape(url, { formats: ["markdown"] })` → `result.markdown`, `result.metadata?.title`, `result.metadata?.sourceURL`. Throws a `ValidationError` if the key is missing or no markdown comes back — website import has no silent-degradation path (unlike Mem0/Tavily), since a website source is useless without content.

### `youtube-transcript`

- Video id is extracted from the URL with a regex covering `watch?v=`, `youtu.be/`, `/embed/`, and `/shorts/` forms.
- `YoutubeTranscript.fetchTranscript(videoId)` returns caption segments; they're joined with spaces into one `content` string. Any failure (no captions, private video, etc.) is normalized to a single user-facing `ValidationError`.

### Tavily (`@tavily/core`)

- `tavily({ apiKey }).search(query, { searchDepth: "basic", maxResults: 5, includeAnswer: true })` — used only as the chat `web_search` tool, never for source ingestion.
- Results are formatted into `[W1]`, `[W2]`, … blocks (`formatTavilyResultsForPrompt`) for the model prompt, and separately mapped into `sourceType: "WEB"` citations saved on the assistant message. Rows without an `http` or `https` URL are dropped before those numbers are assigned. A later tool call returns the merged list, so `[W#]` stays aligned with those URLs. The same citation array is streamed as `data-citations` before the answer text. Every Tavily call goes through `searchWebIfAllowed`, which throws before the provider runs when this request has no consent.
- Soft dependency: `webSearchEnabled` on the server is `input.webSearch === true && !!process.env.TAVILY_API_KEY?.trim()` — the toggle is silently ineffective without a key rather than erroring.

### `unpdf`

- `getDocumentProxy(new Uint8Array(arrayBuffer))` + `extractText(pdf, { mergePages: false })` → per-page text array + `totalPages`. Used for both freshly uploaded PDFs and re-processing PDFs re-downloaded from Cloudinary.
- Per-page text is preserved specifically so chunks can carry a `page` number in their metadata (`chunkPages`) — don't flatten to a single string before chunking if page numbers matter.

### `multer`

- Single in-memory PDF upload (`multer.memoryStorage()`), 10 MB limit, `fileFilter` rejects non-`application/pdf` mimetypes with an `Error("Only PDF files are allowed")` that the global error handler special-cases into a `400`.

---

## Client

### Next.js 16 (App Router) + React 19

- The client's `client/AGENTS.md` explicitly warns this Next.js version has breaking changes vs. training data — check `node_modules/next/dist/docs/` before relying on remembered Next.js APIs, especially around async `params`/`searchParams` (already `Promise<{...}>` and awaited in every dynamic route in this codebase) and Route Groups (`(auth)`, `(protected)`).
- Server Components call `requireAuth()` directly (no middleware.ts in this project) — auth is enforced per-page, not via Next.js middleware.

### `@tanstack/react-query`

- `QueryProvider` (`shared/components/providers/query-provider.tsx`) wraps the whole app in the root layout.
- See `code-standards.md` for the query-key-factory + hook pattern used everywhere data is fetched.

### `zustand`

- Used sparingly, for small client-only preferences that should persist across sessions: `features/chat/stores/chat-preferences.ts` uses `create(persist(...))` keyed by `workspaceId`, persisted to `localStorage` under `"sourcelab-chat-preferences"`. Don't reach for zustand for server data — that's React Query's job.

### `ai` + `@ai-sdk/react` (client-side chat)

- `useChat({ transport })` from `@ai-sdk/react`, with a `DefaultChatTransport` pointed at `/api/workspaces/:workspaceId/chat`, `credentials: "include"`, and a custom `fetch` that reads the `X-Conversation-Id` response header to adopt a server-created conversation id.
- `status` values used: `"streaming"`, `"submitted"`, `"ready"` — `isStreaming = status === "streaming" || status === "submitted"`.
- Message text is extracted with `message.parts.filter(p => p.type === "text").map(p => p.text).join("")` — messages are parts-based (`UIMessage`), not a flat `content` string, on the client.

### `better-auth/react`

- `createAuthClient({ plugins: [stripeClient({ subscription: true })] })`; re-exports `signIn`, `signUp`, `signOut`, `useSession`, `requestPasswordReset`, `resetPassword` from the created client (`features/auth/lib/auth-client.ts`).

### Resend (`resend`) — server transactional email

- Wrapper: `server/src/lib/email.ts`. Used only for Better Auth verification and password-reset emails.
- If `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing, the email body (including the action URL) is logged instead of sent.

### Stripe (`stripe` + `@better-auth/stripe`)

- Server plugin in `lib/auth.ts`; SDK client in `lib/stripe.ts`. Do not create Checkout Sessions by hand — use `authClient.subscription.upgrade` / `billingPortal`.
- Webhook path: `/api/auth/stripe/webhook` on Express. See `context/billing-and-credits.md`.

### shadcn/ui on `@base-ui/react` (not Radix)

- See `ui-rules.md` for the `render` prop / `nativeButton={false}` pattern this implies for every interactive primitive.
- Regenerate/add primitives with the `shadcn` CLI using the config in `components.json` (style `base-rhea`, base color `stone`) rather than hand-writing new low-level primitives.

### `streamdown` (+ `@streamdown/code`)

- Renders markdown for streamed assistant text and for report/summary artifact content. Its stylesheet is imported once in `app/globals.css` (`@import "streamdown/styles.css";`) alongside `@source` directives pointing at its `dist` JS for Tailwind class scanning — don't remove those `@source` lines or streamdown's own utility classes stop being generated.

### `@xyflow/react`

- Powers the interactive mind map viewer only. Requires `import "@xyflow/react/dist/style.css"` in the component that renders it (already done in `mindmap-viewer.tsx`) — don't rely on global CSS to cover it.
- The mind map does its own tree layout (`buildTree`/`computeTreeLayout`) on top of raw `{ nodes, edges }` from the artifact content — `@xyflow/react` itself is just the rendering/interaction layer (pan/zoom/minimap/handles), not the layout engine.

### `date-fns`

- Used exclusively via `formatDistanceToNow(date, { addSuffix: true })` for relative timestamps ("3 hours ago"). Keep new relative-time UI consistent with this rather than introducing a second date library or manual formatting.

### `next-themes`

- `ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange` in the root layout; `UserMenu` (`features/auth/components/user-menu.tsx`) and the command palette call `setTheme`. Dark mode styling is handled entirely by the `.dark` CSS variable block in `globals.css` — components should never branch on theme in JS, only via CSS variables/Tailwind dark: if ever needed (not currently used anywhere).

### `recharts`

- Installed and wired into the shadcn `components/ui/chart.tsx` primitive, but **not currently used by any feature** — there is no dashboard/analytics chart in the app today. If you add one, use the existing `chart.tsx` wrapper rather than importing `recharts` directly.

### `lucide-react`

- The only icon set (`components.json` → `iconLibrary: "lucide"`). Don't add a second icon library.
