/**
 * Chat and conversation business logic.
 *
 * Handles CRUD for conversations/messages and the main RAG chat streaming pipeline:
 *
 * ```
 * User message
 *   → input guardrails
 *   → save to DB
 *   → query intelligence, RAG retrieval, context processing + Mem0 memories
 *   → streamText (AI SDK) with optional web search tool
 *   → grounding, then output guardrails, then release the safe reply
 *   → save assistant reply + citations
 *   → optional summary job + Mem0 learning
 * ```
 */

import { openai } from "@ai-sdk/openai";
import type { Response } from "express";
import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStream,
  isStepCount,
  pipeUIMessageStreamToResponse,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import {
  CHAT_MESSAGE_LIMIT,
  CHAT_MODEL,
  CHAT_MODELS,
  CONVERSATION_SUMMARY_INTERVAL,
  RECENT_MESSAGE_WINDOW,
} from "../lib/ai-config.js";
import { enqueueConversationSummarize } from "../lib/conversation-events.js";
import { groundAnswer } from "../lib/rag/answer-grounding.js";
import {
  assembleCitations,
  pruneUnsupportedWebMarkers,
  retainCitedWebSentences,
  type SavedCitation,
} from "../lib/rag/citations.js";
import { logRagEvent } from "../lib/rag/rag-log.js";
import {
  appendEmbeddedInstructionNote,
  asksConflictingValues,
} from "../lib/rag/request-disposition.js";
import { buildChatSystemPrompt } from "../lib/rag/retrieve.js";
import {
  readStoredSuggestions,
  suggestFollowUpQuestions,
  type NotebookPassage,
} from "../lib/rag/suggested-questions.js";
import {
  focusFromTitles,
  topicFromQuestion,
  WEB_RESEARCH_ACCEPTANCE,
} from "../lib/rag/topic-gap.js";
import {
  replaceUnauthorizedAnswer,
  searchWebIfAllowed,
  WebSearchNotAuthorizedError,
  webSearchFailedReply,
} from "../lib/rag/web-search-policy.js";
import type { RagTrace, RagTraceStep } from "../lib/rag/rag-trace.js";
import { isRagTraceEnabled, logTraceStep } from "../lib/rag/rag-trace.js";
import { runRagPipeline } from "./rag-pipeline.service.js";
import {
  createConversationRecord,
  findConversationByIdAndWorkspaceId,
  findConversationsByWorkspaceId,
  touchConversation,
  updateConversationRecord,
  deleteConversationRecord,
} from "../repositories/conversation.repository.js";
import {
  createMessageRecord,
  countMessagesByConversationId,
  findMessagesByConversationId,
} from "../repositories/message.repository.js";
import { addMemoriesFromMessages } from "../lib/mem0.js";
import { searchMemoriesForChat } from "./memory.service.js";
import {
  formatTavilyResultsForPrompt,
  mergeWebSearchResults,
  type TavilySearchResponse,
} from "../lib/tavily.js";
import { CREDIT_COSTS } from "../config/plans.js";
import { assertChatInputAllowed } from "../lib/input-guardrails.js";
import {
  OUTPUT_BLOCKED_MESSAGE,
  OUTPUT_CHECK_FAILED_MESSAGE,
  checkOutputGuards,
  textReleasedAfterOutputCheck,
} from "../lib/output-guardrails.js";
import { checkAndDeductCredits } from "./credits.service.js";
import { NotFoundError, ValidationError } from "../types/app-error.js";
import {
  buildConversationTitle,
  getLastUserMessageText,
  getTextFromUIMessage,
  replaceLastUserMessageText,
} from "../utils/chat-message.js";
import { getWorkspaceByIdForUser } from "./workspace.service.js";

/**
 * Lists all conversations in a workspace for the sidebar/history UI.
 *
 * @param workspaceId - Workspace to list conversations from
 * @param userId - Authenticated user's id
 * @returns Conversation records ordered by most recent activity
 *
 */
export async function listConversationsForWorkspace(
  workspaceId: string,
  userId: string,
) {
  await getWorkspaceByIdForUser(workspaceId, userId);
  return findConversationsByWorkspaceId(workspaceId);
}

/**
 * Creates an empty conversation (optional title).
 *
 * Most chats are created implicitly on first message via {@link streamWorkspaceChat};
 * this endpoint supports explicit "new chat" actions from the UI.
 *
 * @param workspaceId - Workspace to attach the conversation to
 * @param userId - Authenticated user's id
 * @param title - Optional display title
 * @returns New conversation record
 *
 */
export async function createConversationForWorkspace(
  workspaceId: string,
  userId: string,
  title?: string,
) {
  await getWorkspaceByIdForUser(workspaceId, userId);
  return createConversationRecord(workspaceId, title);
}

/**
 * Loads persisted message history for a conversation.
 *
 * @param workspaceId - Workspace the conversation belongs to
 * @param conversationId - Conversation to load messages for
 * @param userId - Authenticated user's id
 * @returns Message rows with role, content, citations, and timestamps
 * @throws {NotFoundError} When the conversation does not exist in this workspace
 *
 */
export async function getConversationMessagesForWorkspace(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  await getWorkspaceByIdForUser(workspaceId, userId);

  const conversation = await findConversationByIdAndWorkspaceId(
    conversationId,
    workspaceId,
  );

  if (!conversation) {
    throw new NotFoundError("Conversation not found");
  }

  const messages = await findMessagesByConversationId(conversationId);
  const includeTrace = isRagTraceEnabled();

  return messages.map((message) => ({
    ...message,
    trace: includeTrace ? message.trace : null,
    suggestions: readStoredSuggestions(message.trace),
  }));
}

/**
 * Deletes a conversation and all its messages (cascade).
 *
 * @param workspaceId - Workspace the conversation belongs to
 * @param conversationId - Conversation to delete
 * @param userId - Authenticated user's id
 * @returns Resolves when the conversation row is deleted
 * @throws {NotFoundError} When the conversation does not exist
 *
 */
export async function deleteConversationForWorkspace(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  await getWorkspaceByIdForUser(workspaceId, userId);

  const conversation = await findConversationByIdAndWorkspaceId(
    conversationId,
    workspaceId,
  );

  if (!conversation) {
    throw new NotFoundError("Conversation not found");
  }

  await deleteConversationRecord(conversationId);
}

/**
 * Finds an existing conversation or creates one from the first user message.
 *
 * @param workspaceId - Workspace scope
 * @param conversationId - Existing id from client, or undefined for a new chat
 * @param firstMessage - User text used to auto-generate a title for new conversations
 * @returns Conversation record (existing or newly created)
 * @throws {NotFoundError} When `conversationId` is provided but not found
 *
 *
 */
async function resolveConversation(
  workspaceId: string,
  conversationId: string | undefined,
  firstMessage: string,
) {
  if (conversationId) {
    const existing = await findConversationByIdAndWorkspaceId(
      conversationId,
      workspaceId,
    );

    if (!existing) {
      throw new NotFoundError("Conversation not found");
    }

    return existing;
  }

  return createConversationRecord(
    workspaceId,
    buildConversationTitle(firstMessage),
  );
}

/**
 * Main RAG chat endpoint: streams an AI reply with workspace context and optional web search.
 *
 * **Pipeline:**
 * 1. Validate user message and run input guardrails
 * 2. Resolve/create conversation, reject a thread already at the message limit, and save the user message
 * 3. Parallel: query and context pipeline + Mem0 search (user memory and this notebook)
 * 4. Build system prompt and generate the model response via AI SDK
 * 5. Check grounding and citations, then run local output guards
 * 6. On finish: save the safe assistant message, citations, title, summary job, Mem0 learning
 *
 * @param res - Express response (streamed via `pipeUIMessageStreamToResponse`)
 * @param workspaceId - Workspace whose sources to search
 * @param userId - Authenticated user's id
 * @param input - Client chat payload from `useChat`
 * @returns Writes UI message stream to `res`; sets `X-Conversation-Id` header
 * @throws {ValidationError} When no user message text is present, or the conversation is already at the message limit
 * @throws {InputBlockedError} When input guardrails reject the user message
 * @throws {NotFoundError} When conversation or workspace is not found
 * @throws {PaymentRequiredError} When the user has fewer than 0.1 credits
 *
 *
 */
export async function streamWorkspaceChat(
  res: Response,
  workspaceId: string,
  userId: string,
  input: {
    conversationId?: string;
    messages: UIMessage[];
    model?: string;
    webSearch?: boolean;
  },
) {
  const workspace = await getWorkspaceByIdForUser(workspaceId, userId);
  const requestedModel = input.model ?? workspace.defaultModel;
  const chatModel =
    CHAT_MODELS.find((model) => model === requestedModel) ?? CHAT_MODEL;
  const webSearchEnabled =
    input.webSearch === true && !!process.env.TAVILY_API_KEY?.trim();

  const userText = getLastUserMessageText(input.messages);
  if (!userText) {
    throw new ValidationError("A user message is required");
  }

  const decision = await assertChatInputAllowed(userText);
  const textForModel = decision.textForModel;
  const ignoredEmbeddedInstructions = decision.ignoredEmbeddedInstructions;

  const conversation = await resolveConversation(
    workspaceId,
    input.conversationId,
    userText,
  );

  const existingMessageCount = await countMessagesByConversationId(
    conversation.id,
  );
  if (existingMessageCount >= CHAT_MESSAGE_LIMIT) {
    throw new ValidationError(
      `This chat has reached the ${CHAT_MESSAGE_LIMIT}-message limit. Start a new chat to continue.`,
      { code: "CHAT_MESSAGE_LIMIT" },
    );
  }

  await checkAndDeductCredits(userId, CREDIT_COSTS.chatMessage);

  await createMessageRecord({
    conversationId: conversation.id,
    role: "USER",
    content: userText,
  });

  const modelMessages = ignoredEmbeddedInstructions
    ? replaceLastUserMessageText(input.messages, textForModel)
    : input.messages;
  const contextMessages =
    conversation.summary && modelMessages.length > RECENT_MESSAGE_WINDOW
      ? modelMessages.slice(-RECENT_MESSAGE_WINDOW)
      : modelMessages;

  let webSearchResults: TavilySearchResponse | null = null;
  let webSearchFailed = false;
  let suggestions: string[] = [];
  let citations: Array<{
    sourceId?: string;
    sourceTitle: string;
    sourceType: string;
    chunkId?: string;
    chunkIndex?: number;
    page?: number;
    excerpt: string;
    score?: number;
    url?: string;
    cited?: boolean;
  }> = [];
  let trace: RagTrace = { steps: [] };

  const stream = createUIMessageStream({
    originalMessages: input.messages,
    execute: async ({ writer }) => {
      const publishTrace = (next: RagTrace) => {
        trace = next;
        if (!isRagTraceEnabled()) {
          return;
        }

        writer.write({
          type: "data-rag",
          id: "rag-trace",
          data: next,
        });
      };

      const [pipeline, memories] = await Promise.all([
        runRagPipeline({
          workspaceId,
          userText: textForModel,
          conversationSummary: conversation.summary,
          recentTurns: formatRecentTurns(modelMessages),
          webSearchEnabled,
          onTrace: publishTrace,
        }),
        searchMemoriesForChat(userId, workspaceId, textForModel),
      ]);

      trace = pipeline.trace;
      citations = pipeline.chunks.map((chunk) => ({
        sourceId: chunk.sourceId,
        sourceTitle: chunk.sourceTitle,
        sourceType: chunk.sourceType,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        page: chunk.page,
        excerpt: chunk.text,
        score: chunk.score,
      }));
      const chunkCitations = citations.map((citation) => ({ ...citation }));
      webSearchResults = pipeline.webResults;

      const systemPrompt = buildChatSystemPrompt({
        chunks: pipeline.chunks,
        conversationSummary: conversation.summary,
        userMemories: memories.userMemories,
        workspaceMemories: memories.workspaceMemories,
        webSearchEnabled,
        webResults: pipeline.webResults,
        contradictions: pipeline.contradictions,
        weakEvidence: pipeline.weakEvidence,
        overview:
          pipeline.queryClass === "summarization" &&
          pipeline.chunks.length > 0,
        researchTopic: pipeline.researchTopic,
        stateBothSides: asksConflictingValues(textForModel),
        conversational: pipeline.queryClass === "conversational",
      });

      const pushStep = (step: RagTraceStep) => {
        const steps = [...trace.steps];
        const index = steps.findIndex((item) => item.id === step.id);
        if (index === -1) {
          steps.push(step);
        } else {
          steps[index] = step;
        }

        trace = { steps };
        logTraceStep(step);
        if (!isRagTraceEnabled()) {
          return;
        }

        writer.write({
          type: "data-rag",
          id: "rag-trace",
          data: trace,
        });
      };

      const evidenceChunks = pipeline.chunks;
      let drafted = pipeline.directReply?.trim() ?? "";

      if (drafted) {
        pushStep({
          id: "generating",
          label: "Generating",
          status: "done",
          summary: "Prepared from the notebook",
          lines: [],
        });
      } else {
        publishTrace({
          steps: [
            ...pipeline.trace.steps,
            {
              id: "generating",
              label: "Generating",
              status: "active",
              summary: "Writing the answer",
              lines: [],
            },
          ],
        });
        console.info("[rag] Generating → started");
        const tools = webSearchEnabled
          ? {
              web_search: tool({
                description:
                  "Search the web for up-to-date information outside the workspace sources. Cite the [W#] markers in the result. They continue any web results already in the prompt and match the links shown to the user.",
                inputSchema: z.object({
                  query: z
                    .string()
                    .describe("The search query for current web information"),
                }),
                execute: async ({ query }) => {
                  let results;
                  try {
                    results = await searchWebIfAllowed({
                      allowed: webSearchEnabled,
                      query,
                    });
                  } catch (error) {
                    webSearchFailed = true;
                    if (error instanceof WebSearchNotAuthorizedError) {
                      return "Web search is not authorized for this request. Do not answer from general knowledge.";
                    }

                    return "Web search failed. Do not invent sources or answer from general knowledge.";
                  }

                  if (
                    results.results.length === 0 &&
                    (webSearchResults?.results.length ?? 0) === 0
                  ) {
                    webSearchFailed = true;
                    return "Web search returned no usable results. Do not answer from general knowledge or invent sources.";
                  }

                  const before = webSearchResults?.results.length ?? 0;
                  webSearchResults = mergeWebSearchResults(
                    webSearchResults,
                    results,
                  );
                  const added = webSearchResults.results.slice(before);
                  if (added.length === 0) {
                    return "No new web results were found. Keep citing the [W#] pages already listed.";
                  }

                  return formatTavilyResultsForPrompt(
                    { ...webSearchResults, results: added },
                    before,
                  );
                },
              }),
            }
          : undefined;

        const result = streamText({
          model: openai(chatModel),
          system: systemPrompt,
          messages: await convertToModelMessages(contextMessages),
          tools,
          stopWhen: webSearchEnabled ? isStepCount(3) : undefined,
        });

        drafted = (await result.text).trim();
      }
      if (!drafted) {
        pushStep({
          id: "generating",
          label: "Generating",
          status: "done",
          summary: "No answer",
          lines: [],
        });
        return;
      }

      pushStep({
        id: "generating",
        label: "Generating",
        status: "done",
        summary: "Checking the answer",
        lines: [],
      });

      let finalText = OUTPUT_CHECK_FAILED_MESSAGE;

      try {
        pushStep({
          id: "grounding",
          label: "Grounding",
          status: "active",
          summary: "Checking claims",
          lines: [],
        });
        const grounded = await groundAnswer({
          question: textForModel,
          answer: drafted,
          chunks: evidenceChunks.map((chunk) => ({
            title: chunk.sourceTitle,
            text: chunk.text,
          })),
          webResults: (webSearchResults?.results ?? []).map((item) => ({
            title: item.title,
            text: item.content,
          })),
        });

        pushStep({
          id: "grounding",
          label: "Grounding",
          status: "done",
          summary: grounded.grounding.summary,
          lines: grounded.grounding.lines,
        });
        pushStep({
          id: "citations",
          label: "Citations",
          status: "done",
          summary: grounded.citations.summary,
          lines: grounded.citations.lines,
        });
        pushStep({
          id: "coverage",
          label: "Coverage",
          status: "done",
          summary: grounded.coverage.summary,
          lines: grounded.coverage.lines,
        });

        const searchAllowed =
          webSearchEnabled || Boolean(pipeline.researchTopic);
        let candidate = pruneUnsupportedWebMarkers(
          grounded.text,
          webSearchResults?.results ?? [],
        );
        if ((webSearchResults?.results.length ?? 0) > 0) {
          candidate = retainCitedWebSentences(candidate);
        }

        let offeredResearch = false;
        if (
          webSearchFailed &&
          (webSearchResults?.results.length ?? 0) === 0 &&
          evidenceChunks.length === 0 &&
          pipeline.queryClass !== "conversational"
        ) {
          candidate = webSearchFailedReply(topicFromQuestion(textForModel));
        } else {
          const beforeConsent = candidate;
          candidate = replaceUnauthorizedAnswer({
            answer: candidate,
            searchAllowed,
            chunkCount: evidenceChunks.length,
            withheld: grounded.withheld,
            conversational: pipeline.queryClass === "conversational",
            topic: topicFromQuestion(textForModel),
            focus: focusFromTitles(
              pipeline.sourceSamples.map((sample) => sample.title),
            ),
          });
          offeredResearch = candidate !== beforeConsent;
        }
        if (ignoredEmbeddedInstructions) {
          candidate = appendEmbeddedInstructionNote(candidate);
        }

        pushStep({
          id: "output-guard",
          label: "Output guard",
          status: "active",
          summary: "Checking the reply",
          lines: [],
        });
        const checked = await checkOutputGuards(candidate);
        pushStep({
          id: "output-guard",
          label: "Output guard",
          status: "done",
          summary: checked.summary,
          lines: checked.lines,
        });

        finalText = textReleasedAfterOutputCheck(checked, false);
        if (!checked.blocked && offeredResearch) {
          suggestions = [WEB_RESEARCH_ACCEPTANCE];
        }
        citations = await shortenCitationExcerpts(
          assembleCitations({
            chunks: chunkCitations,
            webResults: webSearchResults,
            answer: finalText,
          }),
        );
      } catch (error) {
        logRagEvent("output-check", {
          failed: true,
          error: error instanceof Error ? error.name : "Error",
        });
        finalText = textReleasedAfterOutputCheck(undefined, true);
        citations = clearCitationExcerpts(
          assembleCitations({
            chunks: chunkCitations,
            webResults: webSearchResults,
            answer: finalText,
          }),
        );
        const active = trace.steps.filter((step) => step.status === "active");
        if (active.length > 0) {
          for (const step of active) {
            pushStep({
              ...step,
              status: "done",
              summary: "Check failed",
              lines: [
                "The answer was withheld because a check could not finish.",
              ],
            });
          }
        } else {
          pushStep({
            id: "output-check",
            label: "Output check",
            status: "done",
            summary: "Check failed",
            lines: [
              "The answer was withheld because a check could not finish.",
            ],
          });
        }
      }

      if (
        suggestions.length === 0 &&
        finalText !== OUTPUT_CHECK_FAILED_MESSAGE &&
        finalText !== OUTPUT_BLOCKED_MESSAGE
      ) {
        const prepared = pipeline.suggestions ?? [];
        const passages = passagesForSuggestions(
          evidenceChunks,
          webSearchResults,
          pipeline.sourceSamples,
        );
        if (prepared.length > 0) {
          suggestions = prepared;
        } else if (passages.length > 0 || pipeline.researchTopic) {
          suggestions = await suggestFollowUpQuestions({
            question: pipeline.researchTopic ?? textForModel,
            answer: finalText,
            passages,
            preferNotebook:
              evidenceChunks.length === 0 &&
              (webSearchResults?.results.length ?? 0) === 0,
          });
        }
      }

      writer.write({
        type: "data-citations",
        id: "citations",
        data: citations,
      });
      if (suggestions.length > 0) {
        writer.write({
          type: "data-suggestions",
          id: "suggestions",
          data: suggestions,
        });
      }
      writer.write({ type: "text-start", id: "assistant-text" });
      writer.write({
        type: "text-delta",
        id: "assistant-text",
        delta: finalText,
      });
      writer.write({ type: "text-end", id: "assistant-text" });
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) {
        return;
      }

      const assistantText = getTextFromUIMessage(responseMessage).trim();
      if (!assistantText) {
        return;
      }

      console.info("[rag] Generating → Answer complete");

      await createMessageRecord({
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: assistantText,
        citations,
        trace: {
          steps: trace.steps.map((step) =>
            step.id === "generating"
              ? { ...step, status: "done", summary: "Answer complete" }
              : step,
          ),
          suggestions,
        },
      });

      await touchConversation(conversation.id);

      if (!conversation.title) {
        await updateConversationRecord(conversation.id, {
          title: buildConversationTitle(userText),
        });
      }

      const messageCount = await countMessagesByConversationId(conversation.id);

      if (messageCount % CONVERSATION_SUMMARY_INTERVAL === 0) {
        await enqueueConversationSummarize({
          conversationId: conversation.id,
          userId,
        });
      }

      void addMemoriesFromMessages(
        userId,
        [
          { role: "user", content: userText },
          { role: "assistant", content: assistantText },
        ],
        {
          source: "learned",
          scope: "workspace",
          workspaceId,
          conversationId: conversation.id,
        },
      ).catch((error) => {
        console.error("Mem0 add failed:", error);
      });
    },
  });

  await pipeUIMessageStreamToResponse({
    response: res,
    stream,
    headers: {
      "X-Conversation-Id": conversation.id,
    },
  });
}

function passagesForSuggestions(
  chunks: Array<{ sourceTitle: string; text: string }>,
  webResults: TavilySearchResponse | null,
  samples: NotebookPassage[],
): NotebookPassage[] {
  const fromChunks = chunks.map((chunk) => ({
    title: chunk.sourceTitle,
    text: chunk.text.slice(0, 700),
  }));
  const fromWeb = (webResults?.results ?? []).map((result) => ({
    title: result.title,
    text: result.content.slice(0, 700),
  }));

  if (fromChunks.length > 0 || fromWeb.length > 0) {
    return [...fromChunks, ...fromWeb];
  }

  return samples;
}

function formatRecentTurns(messages: UIMessage[]) {
  return messages
    .slice(-RECENT_MESSAGE_WINDOW)
    .map((message) => {
      const text = getTextFromUIMessage(message)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
      if (!text) {
        return null;
      }

      return `${message.role}: ${text}`;
    })
    .filter((turn) => turn !== null)
    .join("\n");
}

/**
 * Keeps the first 280 characters of each citation excerpt.
 *
 * @param items - Citations about to be saved
 * @returns The same citations with shortened excerpts
 */
function shortenCitationExcerpts(items: SavedCitation[]) {
  return items.map((citation) => {
    if (!citation.excerpt.trim()) {
      return citation;
    }

    return { ...citation, excerpt: citation.excerpt.slice(0, 280) };
  });
}

/**
 * Drops excerpt text when an output check fails closed.
 *
 * @param items - Citations assembled for the withheld answer
 * @returns Citations with empty excerpts and no cited markers
 */
function clearCitationExcerpts(items: SavedCitation[]): SavedCitation[] {
  return items.map((citation) => ({
    ...citation,
    excerpt: "",
    cited: false,
  }));
}
