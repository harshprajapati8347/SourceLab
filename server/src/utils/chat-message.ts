import type { UIMessage } from "ai";

/**
 * Extracts plain text from an AI SDK {@link UIMessage} by joining all text parts.
 *
 * @param message - UI message with `parts` array
 * @returns Concatenated text from all `type: "text"` parts
 *
 */
export function getTextFromUIMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Replaces the latest user message text before it is sent to the model.
 *
 * The stored conversation keeps the original text. This is used when a mixed
 * request is reduced to its safe task.
 *
 * @param messages - Full UI message history from the client
 * @param text - Safe task text
 * @returns A copy of `messages` with that user text replaced
 */
export function replaceLastUserMessageText(
  messages: UIMessage[],
  text: string,
): UIMessage[] {
  let target = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && getTextFromUIMessage(message).trim()) {
      target = index;
      break;
    }
  }

  if (target === -1) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index !== target) {
      return message;
    }

    let replaced = false;
    const parts: UIMessage["parts"] = [];

    for (const part of message.parts) {
      if (part.type !== "text") {
        parts.push(part);
        continue;
      }

      if (replaced) {
        continue;
      }

      replaced = true;
      parts.push({ type: "text", text });
    }

    return { ...message, parts };
  });
}

/**
 * Finds the most recent non-empty user message text in a UI message array.
 *
 * Walks backwards from the end of the array (supports multi-turn history).
 *
 * @param messages - Full UI message history from the client
 * @returns Latest user message text, or `null` when none found
 */
export function getLastUserMessageText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      const text = getTextFromUIMessage(message).trim();
      if (text) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Builds a short conversation title from the first user message.
 *
 * Truncates to 72 characters with an ellipsis when longer.
 *
 * @param text - Raw user message text
 * @returns Title string for the conversation sidebar
 *
 */
export function buildConversationTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 72
    ? `${normalized.slice(0, 72).trim()}…`
    : normalized;
}
