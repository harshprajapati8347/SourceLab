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
 *   → output guardrails, then release the safe reply
 *   → save assistant reply + citations
 *   → optional summary job + Mem0 learning
 * ```
 */

import { GuardrailTripwireTriggered } from "@openai/guardrails";
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
import { logRagEvent } from "../lib/rag/rag-log.js";
import {
  appendEmbeddedInstructionNote,
  asksConflictingValues,
  ensureWebSourceMarkers,
} from "../lib/rag/request-disposition.js";
import { buildChatSystemPrompt } from "../lib/rag/retrieve.js";
import {
  readStoredSuggestions,
  suggestFollowUpQuestions,
  type NotebookPassage,
} from "../lib/rag/suggested-questions.js";
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
import { addMemoriesFromMessages, searchUserMemories } from "../lib/mem0.js";
import {
  formatTavilyResultsForPrompt,
  mergeWebSearchResults,
  searchWeb,
  type TavilySearchResponse,
} from "../lib/tavily.js";
import { CREDIT_COSTS } from "../config/plans.js";
import {
  assertChatInputAllowed,
  toInputBlockedError,
} from "../lib/input-guardrails.js";
import {
  OUTPUT_CHECK_FAILED_MESSAGE,
  OUTPUT_POLICY_MESSAGE,
  checkOutputPolicy,
  checkOutputSecrets,
  maskOutputPii,
  outputSpansAreDisclosable,
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
 * 3. Parallel: query and context pipeline + Mem0 memory search
 * 4. Build system prompt and generate the model response via AI SDK
 * 5. Mask PII, check grounding and citations, then run policy and secret checks
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

  let textForModel = userText;
  let ignoredEmbeddedInstructions = false;

  try {
    const decision = await assertChatInputAllowed(userText, {
      webSearchEnabled,
    });
    textForModel = decision.textForModel;
    ignoredEmbeddedInstructions = decision.ignoredEmbeddedInstructions;
  } catch (error) {
    if (error instanceof GuardrailTripwireTriggered) {
      throw toInputBlockedError(error, userText);
    }
    throw error;
  }

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

      const [pipeline, userMemories] = await Promise.all([
        runRagPipeline({
          workspaceId,
          userText: textForModel,
          conversationSummary: conversation.summary,
          recentTurns: formatRecentTurns(modelMessages),
          webSearchEnabled,
          onTrace: publishTrace,
        }),
        searchUserMemories(userId, textForModel),
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
        userMemories: userMemories.map((memory) => memory.memory),
        webSearchEnabled,
        webResults: pipeline.webResults,
        contradictions: pipeline.contradictions,
        weakEvidence: pipeline.weakEvidence,
        overview:
          pipeline.queryClass === "summarization" &&
          pipeline.chunks.length > 0,
        researchTopic: pipeline.researchTopic,
        stateBothSides: asksConflictingValues(textForModel),
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
                  const results = await searchWeb(query);
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
          id: "output-pii",
          label: "Output PII",
          status: "active",
          summary: "Masking sensitive details",
          lines: [],
        });
        const pii = await maskOutputPii(drafted);
        pushStep({
          id: "output-pii",
          label: "Output PII",
          status: "done",
          summary: pii.summary,
          lines: pii.lines,
        });

        pushStep({
          id: "grounding",
          label: "Grounding",
          status: "active",
          summary: "Checking claims",
          lines: [],
        });
        const grounded = await groundAnswer({
          question: textForModel,
          answer: pii.text,
          chunks: evidenceChunks.map((chunk) => ({
            title: chunk.sourceTitle,
            text: chunk.text,
          })),
          webResults: (webSearchResults?.results ?? []).map((item) => ({
            title: item.title,
            text: item.content,
          })),
        });

        const policy = await checkOutputPolicy(grounded.text);
        const secrets = await checkOutputSecrets(policy.text);
        const released = secrets.text;

        const quoteClaims =
          !policy.blocked &&
          secrets.text === policy.text &&
          (await outputSpansAreDisclosable(
            grounded.claims.map((claim) => claim.span).join("\n"),
          ));

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
          lines: quoteClaims
            ? grounded.citations.lines
            : grounded.citations.safeLines,
        });
        pushStep({
          id: "coverage",
          label: "Coverage",
          status: "done",
          summary: grounded.coverage.summary,
          lines: grounded.coverage.lines,
        });
        pushStep({
          id: "policy",
          label: "Policy",
          status: "done",
          summary: policy.summary,
          lines: policy.lines,
        });
        pushStep({
          id: "sensitive",
          label: "Sensitive data",
          status: "done",
          summary: secrets.summary,
          lines: secrets.lines,
        });

        finalText = released;
        if (
          finalText !== OUTPUT_CHECK_FAILED_MESSAGE &&
          finalText !== OUTPUT_POLICY_MESSAGE
        ) {
          finalText = ensureWebSourceMarkers(
            finalText,
            webSearchResults?.results.length ?? 0,
          );
          if (ignoredEmbeddedInstructions) {
            finalText = appendEmbeddedInstructionNote(finalText);
          }
        }
        citations = await maskCitationExcerpts(
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
        finalText = OUTPUT_CHECK_FAILED_MESSAGE;
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
        finalText !== OUTPUT_CHECK_FAILED_MESSAGE &&
        finalText !== OUTPUT_POLICY_MESSAGE
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

type SavedCitation = {
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
};

/**
 * Keeps retrieved citations in prompt order and marks the ones still in the answer.
 *
 * Workspace markers use `[1]`. Web markers use `[W1]` and follow the web result order.
 *
 * @param input - Chunk citations, web results, and the text that will be saved
 * @returns Citations in the order inline markers expect
 */
function assembleCitations(input: {
  chunks: SavedCitation[];
  webResults: TavilySearchResponse | null;
  answer: string;
}): SavedCitation[] {
  const markers = new Set(
    [...input.answer.matchAll(/\[(W?\d+)\]/g)]
      .map((match) => match[1])
      .filter((marker): marker is string => typeof marker === "string"),
  );

  const chunks = input.chunks.map((citation, index) => ({
    ...citation,
    cited: markers.has(String(index + 1)),
  }));
  const web = (input.webResults?.results ?? []).map((result, index) => ({
    sourceType: "WEB",
    sourceTitle: result.title,
    url: result.url,
    excerpt: result.content,
    cited: markers.has(`W${index + 1}`),
  }));

  return [...chunks, ...web];
}

/**
 * Masks PII in the full excerpt, then keeps the first 280 characters.
 *
 * Masking runs on the full excerpt first. The saved preview is the first 280 characters of that masked text.
 *
 * @param items - Citations about to be saved
 * @returns The same citations with masked, shortened excerpts
 */
async function maskCitationExcerpts(items: SavedCitation[]) {
  return Promise.all(
    items.map(async (citation) => {
      if (!citation.excerpt.trim()) {
        return citation;
      }

      const masked = await maskOutputPii(citation.excerpt);
      return { ...citation, excerpt: masked.text.slice(0, 280) };
    }),
  );
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
