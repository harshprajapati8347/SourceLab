# Project Overview

## About the Project

SourceLab is a full stack "chat with your documents" application — a NotebookLM-style AI research and learning workspace. Users create **workspaces** (notebooks), add **sources** into them (PDFs, websites, YouTube transcripts, pasted text, or markdown), and the app processes those sources into a searchable vector index. From there the user can:

- Chat with an AI assistant that answers questions grounded in the workspace's sources, with inline citations back to the exact chunk (and page, for PDFs) the answer came from
- Generate "learning tools" (**artifacts**) from the sources — summaries, key takeaways, flashcards, quizzes, mind maps, and long-form reports
- Build up a personal, cross-workspace long-term memory (via Mem0) that the assistant recalls in future conversations

The backend is a standalone Express API (`server/`) and the frontend is a Next.js 16 App Router client (`client/`), talking to each other over HTTP with cookie-based sessions.

---

## The Problem It Solves

Reading through long documents, PDFs, articles, and videos to find or remember specific facts is slow, and generic chatbots don't know anything about a user's own material and hallucinate when asked about it. SourceLab lets a user drop their source material into a workspace once, then treats that material as ground truth: answers are retrieved from the actual indexed content (RAG) rather than invented, every claim can be traced back to a citation, and the same material can be turned into study aids (flashcards, quizzes, summaries) without manual effort.

---

## Pages

```
/                                          → Homepage (redirects to /dashboard if signed in)
/login                                     → Google OAuth sign-in
/dashboard                                 → Workspace list ("Your notebooks") — search, create, edit, delete
/settings/memory                           → Personal Mem0 memory management (cross-workspace)
/workspace/[id]                            → Workspace chat (default view when opening a workspace)
/workspace/[id]/sources                    → Source library (grid/list, filter, search, bulk actions)
/workspace/[id]/sources/[sourceId]         → Source detail (extracted content preview, status, chunk count)
/workspace/[id]/learn                      → Learning tools hub (list of generated artifacts)
/workspace/[id]/learn/[artifactId]         → Artifact viewer (type-specific: summary/flashcards/quiz/mindmap/report/takeaways)
/workspace/[id]/settings                   → Workspace settings (title, description, icon, default chat model, delete)
```

---

## Navigation

Two distinct navigation contexts:

- **Dashboard** — a simple sticky top header: logo/home link, a "Memory" link, dark mode toggle, sign out. No sidebar.
- **Inside a workspace** — a persistent left sidebar (`WorkspaceShell`) with four sections: **Chat**, **Learn**, **Sources**, **Settings**, plus a live list of the workspace's sources beneath the nav, an "Add source" button, and an "All workspaces" link back to the dashboard. The main content area header shows the workspace title, an "Add source" button, and sign out.

---

## Core User Flow

### Authentication

- Google OAuth only, via Better Auth (`better-auth` + `better-auth/react`)
- Session cookies are shared between the Next.js client (`localhost:3000`) and the Express API (`localhost:8080`) via CORS with `credentials: true`
- Server-side pages call `requireAuth()` and redirect to `/login` if there is no session; the login page calls `unauth()` to redirect signed-in users away

### Dashboard

- Lists the current user's workspaces as cards, with client-side debounced search by title/description
- "Create workspace" opens a dialog for title, description, icon (emoji), and default chat model
- Each workspace card supports edit and delete (delete requires confirmation and cascades to sources, conversations, and the workspace's Pinecone namespace)

### Adding Sources

A single "Add source" dialog with five tabs, each hitting a different import path:

- **Text** — paste raw text with a title
- **Markdown** — paste markdown with a title
- **PDF** — upload a file (stored on Cloudinary, text extracted server-side)
- **Website** — paste a URL (scraped to markdown via Firecrawl)
- **YouTube** — paste a video URL (transcript fetched via `youtube-transcript`)

There is also a web-search import path (`POST /import/web-search`) used to save a Tavily web search result as a permanent source.

### Source Processing (async, via Inngest)

Every new source goes through a durable background pipeline (`source/created` event):

```
extractSourceContent  → chunkSourceContent → embedAndIndexSource
(status: PENDING → PROCESSING → READY, or FAILED with an error message)
```

The source library UI polls sources with pending/processing status every 3 seconds until they resolve. Failed sources can be reprocessed individually or in bulk.

### Chat

- Per-workspace, multi-conversation chat with streaming responses (AI SDK `useChat` + `DefaultChatTransport`)
- Each user message triggers, in parallel: Pinecone vector retrieval of the top relevant source chunks (RAG) and a Mem0 semantic search over the user's personal memories
- The system prompt is built from retrieved chunks, conversation summary (if any), user memories, and web-search availability
- Optional **web search** toggle exposes a `web_search` tool (Tavily) the model can call for up-to-date information outside the workspace
- Responses cite sources inline (`[1]`, `[2]`, …) and web results (`[W1]`, `[W2]`, …); citations render as hoverable source cards linking back to the source detail page or the external URL
- Conversations can be renamed implicitly (auto-titled from the first message), deleted, or exported to a markdown file
- Every 8 messages, a conversation summary is generated in the background and older messages are represented by that summary instead of full history (keeps context bounded); summarization also feeds recent turns to Mem0 for long-term learning

### Learning Tools ("Learn")

- Users generate an artifact by choosing a type (Summary, Key Takeaways, Flashcards, Quiz, Mind Map, AI Report) and an optional custom title
- Generation runs in the background (Inngest `artifact/generate` event) using OpenAI over the workspace's READY source content
- Each artifact type has its own structured schema and its own viewer component (e.g. flip cards, multiple choice with explanations, an interactive `@xyflow/react` mind map with expand/collapse and "ask in chat" on a selected node, a markdown report/summary)

### Memory

- Personal, cross-workspace, powered by Mem0
- Two kinds: **manual** (user adds/edits/deletes memory text directly) and **learned** (automatically inferred from chat messages and conversation summaries)
- The Memory Settings page (`/settings/memory`) lists all memories with their source badge and lets the user add, edit, or delete them

---

## Features In Scope

- Google OAuth sign-in via Better Auth
- Workspace CRUD (create, list/search, update settings, delete with cascading cleanup)
- Five source ingestion paths: text, markdown, PDF upload, website scrape, YouTube transcript (+ web-search-to-source)
- Background source processing pipeline: extraction → chunking → embedding → Pinecone indexing, with status tracking and reprocessing
- Source library with search, type/status filters, grid/list view, multi-select bulk delete, bulk reprocess of failed sources
- Per-workspace multi-conversation RAG chat with streaming, citations, model selection, optional web search tool, conversation export, and delete
- Rolling conversation summarization for long chats
- Six learning artifact types generated from workspace sources, each with a dedicated viewer
- Cross-workspace long-term memory (manual + auto-learned) via Mem0
- Light/dark theme toggle (`next-themes`)

## Features Out of Scope

- Any OAuth provider other than Google
- Team/multi-user or shared workspaces (workspaces are single-owner)
- Billing, subscriptions, or usage limits
- Admin dashboard or moderation tooling
- Offline mode
- Editing generated artifact content after creation (artifacts are regenerate-or-delete, not editable)
- add artifacts to generate audio podcasts and personalized learning roadmaps
- strict mode rag for only using the sources in the workspace otherwise deny answers
- Source Management: One-click source deletion, metadata inspection drawer, and re-indexing pipeline trigger.
- Query Transformation Strategies: Multi-query expansion (Rewrite, StepBack, SubQuestion, and Composite selector) to maximize retrieval recall.
- Corrective RAG (CRAG) Gate: CRAGService evaluates retrieved context relevance before LLM generation. Automatically adapts queries, relaxes similarity thresholds, or returns safe fallback responses to guarantee zero hallucinations.
- LLM Context Reranking: LLMRerankerProvider re-scores and re-orders accepted chunks so the most relevant context sits at the top of the prompt window.
- Multi-Layer Guardrails: Input guards (prompt injection, jailbreak defense, max length, PII detection) and Output guards (citation verification, response length validation).
- Server-Sent Events (SSE) Streaming: Low-latency token-by-token streaming using LLM Chat providers.
- Bonus AI Artifact Studios:
- AI Audio Podcast Studio: Synthesizes a two-speaker host dialogue podcast (male & female voice roles) from notebook sources with an interactive Web Speech API player, playback speed controls, transcript toggle, and text script download.
- Personalized Learning Path & Roadmap: Generates interactive concept roadmaps with deep-linked YouTube video timestamps and source citations.
- Interactive AI Flashcards: Auto-generates study flashcards from knowledge sources for active recall practice.

---

## Target User

Source ingestion, RAG chat with citations, and study-artifact generation (flashcards, quizzes, mind maps) — this is aimed at students, researchers, and knowledge workers who want to study or work through a body of documents/videos/notes.

## Success Criteria
