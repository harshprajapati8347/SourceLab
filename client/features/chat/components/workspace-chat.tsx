"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DownloadIcon,
  MessageSquarePlusIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useSources } from "@/features/sources/hooks/use-sources";
import { BrandMark } from "@/shared/components/brand-mark";
import { useUIStore } from "@/shared/stores/ui-store";
import {
  buildCitationMap,
  chatKeys,
  useConversationMessages,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
} from "../hooks/use-conversations";
import { ChatMessageBody } from "./chat-message-body";
import { ChatEmptyState } from "./chat-empty-state";
import { RagTracePanel } from "./rag-trace-panel";
import { CitationSources } from "./citation-sources";
import { ChatComposer, type RestoredDraft } from "./chat-composer";
import { SourceStatusBanner } from "./source-status-banner";
import type { ChatCitation, ChatMessage } from "../lib/types";
import { InputBlockedError } from "../lib/errors";
import { parseRagTrace, type RagTrace } from "../lib/rag-trace";
import { workspaceRoutes } from "@/features/workspaces/lib/routes";
import { billingKeys } from "@/features/billing/hooks/use-billing";
import { INSUFFICIENT_CREDITS_MESSAGE } from "@/features/billing/lib/constants";
import { useChatPreferences } from "../stores/chat-preferences";
import {
  downloadMarkdown,
  exportConversationMarkdown,
} from "../lib/export-chat";

type WorkspaceChatProps = {
  workspaceId: string;
  defaultModel?: string;
};

type SourceLabMessage = UIMessage<unknown, { rag: RagTrace }>;

function getMessageText(message: SourceLabMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function readRagTrace(message: SourceLabMessage) {
  const part = message.parts.find((item) => item.type === "data-rag");
  if (!part || part.type !== "data-rag") {
    return null;
  }

  return parseRagTrace(part.data);
}

function toStoredParts(message: ChatMessage): SourceLabMessage["parts"] {
  const parts: SourceLabMessage["parts"] = [
    { type: "text", text: message.content },
  ];
  const trace = parseRagTrace(message.trace);
  if (trace) {
    parts.push({ type: "data-rag", id: "rag-trace", data: trace });
  }

  return parts;
}

export function WorkspaceChat({
  workspaceId,
  defaultModel,
}: WorkspaceChatProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const askPrompt = searchParams.get("ask");
  const handledAskPrompt = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<RestoredDraft | null>(
    null,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const setAddSourceOpen = useUIStore((state) => state.setAddSourceOpen);

  const getPrefs = useChatPreferences((state) => state.getPrefs);
  const setWebSearch = useChatPreferences((state) => state.setWebSearch);
  const chatPrefs = getPrefs(workspaceId, defaultModel);

  const { data: sources } = useSources(workspaceId);
  const { data: conversations = [], isLoading: conversationsLoading } =
    useConversations(workspaceId);
  const { data: storedMessages, isLoading: messagesLoading } =
    useConversationMessages(workspaceId, conversationId);
  const createConversation = useCreateConversation(workspaceId);
  const deleteConversation = useDeleteConversation(workspaceId);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );

  const handleConversationId = useCallback(
    (id: string) => {
      setConversationId(id);
      void queryClient.invalidateQueries({
        queryKey: chatKeys(workspaceId).conversations(),
      });
    },
    [queryClient, workspaceId],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/workspaces/${workspaceId}/chat`,
        credentials: "include",
        body: {
          ...(conversationId ? { conversationId } : {}),
          model: chatPrefs.model,
          webSearch: chatPrefs.webSearch,
        },
        fetch: async (url, init) => {
          const response = await fetch(url, {
            ...init,
            credentials: "include",
          });

          if (!response.ok) {
            if (response.status === 402) {
              void queryClient.invalidateQueries({ queryKey: billingKeys.all });
            }
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
              details?: {
                code?: string;
                message?: string;
              };
            } | null;
            const message =
              payload?.error ??
              (response.status === 402
                ? INSUFFICIENT_CREDITS_MESSAGE
                : "Something went wrong. Please try again.");

            if (
              payload?.details?.code === "INPUT_BLOCKED" &&
              typeof payload.details.message === "string"
            ) {
              throw new InputBlockedError(message, payload.details.message);
            }

            throw new Error(message);
          }

          const newConversationId = response.headers.get("X-Conversation-Id");
          if (newConversationId) {
            handleConversationId(newConversationId);
          }

          return response;
        },
      }),
    [
      workspaceId,
      conversationId,
      handleConversationId,
      chatPrefs.model,
      chatPrefs.webSearch,
      queryClient,
    ],
  );

  const { messages, sendMessage, setMessages, status, error } =
    useChat<SourceLabMessage>({
      transport,
      onError: (chatError) => {
        // A refused message goes back into the composer instead of staying in the thread.
        if (chatError instanceof InputBlockedError) {
          const { draft } = chatError;
          setRestoredDraft((current) => ({
            id: (current?.id ?? 0) + 1,
            text: draft,
          }));
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === "user" && getMessageText(last) === draft) {
              return current.slice(0, -1);
            }
            return current;
          });
        }
      },
    });

  const isStreaming = status === "streaming" || status === "submitted";
  const isWaitingForFirstToken = status === "submitted";

  // Citations are fully derived from the fetched messages, so compute them
  // during render instead of syncing them into state via an effect.
  const citationsByMessageId = useMemo<Record<string, ChatCitation[]>>(
    () => (storedMessages ? buildCitationMap(storedMessages) : {}),
    [storedMessages],
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    if (!storedMessages || isStreaming) {
      return;
    }

    setMessages(
      storedMessages.map((message) => ({
        id: message.id,
        role: message.role === "USER" ? "user" : "assistant",
        parts: toStoredParts(message),
      })),
    );
  }, [conversationId, storedMessages, setMessages, isStreaming]);

  useEffect(() => {
    if (status !== "ready" || !conversationId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: chatKeys(workspaceId).messages(conversationId),
    });
    void queryClient.invalidateQueries({ queryKey: billingKeys.all });
  }, [status, conversationId, queryClient, workspaceId]);

  useEffect(() => {
    if (
      !askPrompt ||
      status !== "ready" ||
      conversationId ||
      messages.length > 0 ||
      handledAskPrompt.current === askPrompt
    ) {
      return;
    }

    handledAskPrompt.current = askPrompt;
    void sendMessage({ text: askPrompt });
    router.replace(workspaceRoutes.detail(workspaceId));
  }, [
    askPrompt,
    status,
    conversationId,
    messages.length,
    sendMessage,
    router,
    workspaceId,
  ]);

  function handleNewChat() {
    setConversationId(null);
    setMessages([]);
  }

  async function handleDeleteConversation() {
    if (!conversationId) {
      return;
    }

    try {
      await deleteConversation.mutateAsync(conversationId);
      setConfirmDeleteOpen(false);
      handleNewChat();
      toast.add({ title: "Conversation deleted", type: "success" });
    } catch {
      toast.add({
        title: "Could not delete the conversation",
        description: "Try again in a moment.",
        type: "error",
      });
    }
  }

  function handleExportChat() {
    if (messages.length === 0) {
      return;
    }

    const markdown = exportConversationMarkdown({
      conversation: activeConversation ?? null,
      messages,
      citationsByMessageId,
    });
    const slug =
      activeConversation?.title?.replace(/[^\w-]+/g, "-").toLowerCase() ??
      "chat";
    downloadMarkdown(markdown, `${slug}-${Date.now()}.md`);
    toast.add({ title: "Conversation exported", type: "success" });
  }

  const isLoadingThread = conversationsLoading || messagesLoading;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Select
          value={conversationId ?? "new"}
          items={[
            { value: "new", label: "New chat" },
            ...conversations.map((conversation) => ({
              value: conversation.id,
              label: conversation.title ?? "Untitled chat",
            })),
          ]}
          onValueChange={(value) => {
            if (value === "new") {
              handleNewChat();
              return;
            }
            setConversationId(value);
          }}
        >
          <SelectTrigger
            aria-label="Conversation"
            className="h-8 min-w-0 max-w-xs flex-1 border-transparent bg-transparent hover:bg-muted"
          >
            <SelectValue placeholder="Select conversation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New chat</SelectItem>
            {conversations.map((conversation) => (
              <SelectItem key={conversation.id} value={conversation.id}>
                {conversation.title ?? "Untitled chat"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleNewChat}>
            <MessageSquarePlusIcon />
            <span className="hidden sm:inline">New chat</span>
            <span className="sr-only sm:hidden">New chat</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={messages.length === 0}
            onClick={handleExportChat}
            aria-label="Export conversation as Markdown"
            title="Export as Markdown"
          >
            <DownloadIcon />
          </Button>
          {conversationId ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">
              {isLoadingThread ? (
                <div className="space-y-4" aria-busy="true">
                  <Skeleton className="h-14 w-2/3 rounded-xl" />
                  <Skeleton className="ml-auto h-10 w-1/2 rounded-xl" />
                  <Skeleton className="h-20 w-3/4 rounded-xl" />
                </div>
              ) : messages.length === 0 ? (
                <ChatEmptyState
                  hasSources={sources ? sources.length > 0 : undefined}
                  disabled={isStreaming || createConversation.isPending}
                  onPrompt={(text) => void sendMessage({ text })}
                  onAddSource={() => setAddSourceOpen(true)}
                />
              ) : (
                <MessageGroup className="gap-6">
                  {messages.map((message, messageIndex) => {
                    const isUser = message.role === "user";
                    const text = getMessageText(message);
                    const trace = isUser ? null : readRagTrace(message);
                    const citations = citationsByMessageId[message.id];
                    const isLastMessage = messageIndex === messages.length - 1;
                    const isAnimatingMessage =
                      !isUser && isStreaming && isLastMessage;

                    return (
                      <MessageScrollerItem
                        key={message.id}
                        className="[content-visibility:visible]"
                      >
                        <Message align={isUser ? "end" : "start"}>
                          {!isUser ? (
                            <MessageAvatar className="mt-0.5 min-w-7 self-start bg-transparent">
                              <BrandMark showWordmark={false} size="md" />
                            </MessageAvatar>
                          ) : null}
                          <MessageContent>
                            {trace ? <RagTracePanel trace={trace} /> : null}
                            {text ? (
                              <Bubble
                                align={isUser ? "end" : "start"}
                                variant={isUser ? "secondary" : "ghost"}
                              >
                                <BubbleContent className="leading-relaxed">
                                  {isUser ? (
                                    <span className="whitespace-pre-wrap">
                                      {text}
                                    </span>
                                  ) : (
                                    <ChatMessageBody
                                      text={text}
                                      citations={citations}
                                      workspaceId={workspaceId}
                                      isAnimating={isAnimatingMessage}
                                    />
                                  )}
                                </BubbleContent>
                              </Bubble>
                            ) : null}
                            {!isUser && citations?.length ? (
                              <MessageFooter className="mt-1 w-full max-w-full flex-col items-start gap-0 px-0">
                                <CitationSources
                                  workspaceId={workspaceId}
                                  citations={citations}
                                />
                              </MessageFooter>
                            ) : null}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}

                  {isWaitingForFirstToken ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 pl-9 text-sm text-muted-foreground"
                    >
                      <Spinner className="size-3.5" />
                      Searching your sources
                    </div>
                  ) : null}
                </MessageGroup>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>

      {error ? (
        <div
          role="alert"
          className="shrink-0 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error.message}
        </div>
      ) : null}

      <SourceStatusBanner workspaceId={workspaceId} sources={sources} />

      <ChatComposer
        disabled={createConversation.isPending}
        isStreaming={isStreaming}
        webSearchEnabled={chatPrefs.webSearch}
        onWebSearchChange={(enabled) => setWebSearch(workspaceId, enabled)}
        restoredDraft={restoredDraft}
        onSubmit={(text) => {
          void sendMessage({ text });
        }}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeConversation?.title ?? "This conversation"} and its
              messages will be deleted for good. Export it first if you want a
              copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConversation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteConversation();
              }}
            >
              {deleteConversation.isPending ? <Spinner /> : null}
              Delete conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
