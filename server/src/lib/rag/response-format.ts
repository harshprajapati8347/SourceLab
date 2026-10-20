/**
 * Repairs a drafted chat reply so Markdown renders consistently.
 *
 * The rewrite is mechanical. Wording, citations, and facts stay as written.
 * A reply that would lose a citation, or that has no words left after cleanup,
 * is replaced with a fallback instead of a guessed rewrite.
 */

/** Shown when a reply cannot be repaired without dropping evidence. */
export const RESPONSE_FORMAT_FALLBACK =
  "I couldn't format this answer reliably, so I didn't send it.";

const CITATION = /\[(?:W)?\d+\]/g;
const FENCE = /^```/;
const HEADING = /^#{1,6}\s+\S/;
const EMPTY_HEADING = /^#{1,6}\s*$/;
const EMPTY_BULLET = /^(?:[-*+]|\d+[.)])\s*$/;
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s+\S/;
const WORDS = /[a-z0-9]/i;

export type ResponseFormatResult = {
  text: string;
  repaired: boolean;
  fallback: boolean;
};

/**
 * Cleans empty bullets, empty headings, broken markers, and repeated lines.
 *
 * Already valid Markdown is returned unchanged. Citations that do not survive
 * the cleanup cause the fallback.
 *
 * @param input - Assistant text after grounding and output guards
 * @returns The text to display
 */
export function repairResponseFormatting(input: string): ResponseFormatResult {
  const original = input.replace(/\r\n/g, "\n").replace(/\u0000/g, "");
  const originalCitations = uniqueCitations(original);

  if (!hasWords(original)) {
    return fallbackResult();
  }

  const cleaned = closeDanglingFence(dropBrokenLines(original.split("\n")));
  const deduped = dropConsecutiveDuplicates(cleaned);
  const sectioned = dropEmptySections(deduped);
  const text = normalizeBlockSpacing(sectioned).replace(/\n{3,}/g, "\n\n").trim();

  if (!hasWords(text)) {
    return fallbackResult();
  }

  const kept = new Set(uniqueCitations(text));
  if (originalCitations.some((marker) => !kept.has(marker))) {
    return fallbackResult();
  }

  return {
    text,
    repaired: text !== original.trim(),
    fallback: false,
  };
}

function fallbackResult(): ResponseFormatResult {
  return {
    text: RESPONSE_FORMAT_FALLBACK,
    repaired: true,
    fallback: true,
  };
}

function dropBrokenLines(lines: string[]) {
  const kept: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      inFence = !inFence;
      kept.push(trimmed);
      continue;
    }

    if (inFence) {
      kept.push(line.replace(/[ \t]+$/g, ""));
      continue;
    }

    if (!trimmed || EMPTY_BULLET.test(trimmed) || EMPTY_HEADING.test(trimmed)) {
      if (!trimmed) {
        kept.push("");
      }
      continue;
    }

    if (isStrayMarkup(trimmed)) {
      continue;
    }

    kept.push(closeInlineMarkers(repairBrokenLink(line.replace(/[ \t]+$/g, ""))));
  }

  return kept;
}

function closeDanglingFence(lines: string[]) {
  const fences = lines.filter((line) => FENCE.test(line.trim())).length;
  if (fences % 2 === 0) {
    return lines;
  }

  return [...lines, "```"];
}

function dropConsecutiveDuplicates(lines: string[]) {
  const kept: string[] = [];
  let previous = "";

  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key) {
      kept.push(line);
      continue;
    }

    if (key === previous) {
      continue;
    }

    previous = key;
    kept.push(line);
  }

  return kept;
}

function dropEmptySections(lines: string[]) {
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!HEADING.test(line.trim())) {
      kept.push(line);
      continue;
    }

    let next = index + 1;
    while (next < lines.length && !(lines[next] ?? "").trim()) {
      next += 1;
    }

    if (next >= lines.length || HEADING.test((lines[next] ?? "").trim())) {
      continue;
    }

    kept.push(line.trim());
  }

  return kept;
}

function normalizeBlockSpacing(lines: string[]) {
  const spaced: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      if (!inFence) {
        pushBlank(spaced);
      }
      spaced.push(trimmed);
      inFence = !inFence;
      if (!inFence) {
        pushBlank(spaced);
      }
      continue;
    }

    if (inFence) {
      spaced.push(line);
      continue;
    }

    if (!trimmed) {
      pushBlank(spaced);
      continue;
    }

    const heading = HEADING.test(trimmed);
    const listItem = LIST_ITEM.test(trimmed);
    const previous = spaced.at(-1);

    if ((heading || listItem) && previous && previous !== "") {
      const previousIsList = LIST_ITEM.test(previous.trim());
      if (!(listItem && previousIsList)) {
        spaced.push("");
      }
    }

    if (listItem && previous === "") {
      const beforeBlank = spaced.at(-2);
      if (beforeBlank && LIST_ITEM.test(beforeBlank.trim())) {
        spaced.pop();
      }
    }

    if (previous && HEADING.test(previous.trim())) {
      spaced.push("");
    }

    spaced.push(heading ? trimmed : line.trimEnd());
  }

  while (spaced[0] === "") {
    spaced.shift();
  }
  while (spaced.at(-1) === "") {
    spaced.pop();
  }

  return spaced.join("\n");
}

function pushBlank(lines: string[]) {
  if (lines.length > 0 && lines.at(-1) !== "") {
    lines.push("");
  }
}

function closeInlineMarkers(line: string) {
  let next = line;
  if (oddCount(next, "**")) {
    next = `${next}**`;
  }
  if (oddCount(next, "__")) {
    next = `${next}__`;
  }
  if (oddCount(next.replace(/```/g, ""), "`")) {
    next = `${next}\``;
  }
  return next;
}

function repairBrokenLink(line: string) {
  return line.replace(/\[([^\]]+)\]\(([^)\n]*)$/g, "$1");
}

function isStrayMarkup(line: string) {
  if (HEADING.test(line) || LIST_ITEM.test(line) || FENCE.test(line)) {
    return false;
  }

  if (/^(?:---|\*\*\*|___)$/.test(line)) {
    return false;
  }

  return /^[\s*_`~#>]+$/.test(line);
}

function oddCount(line: string, marker: string) {
  const flags = marker === "`" ? "g" : "g";
  const matches = line.match(new RegExp(escapeRegExp(marker), flags));
  return (matches?.length ?? 0) % 2 === 1;
}

function uniqueCitations(text: string) {
  return [...new Set(text.match(CITATION) ?? [])];
}

function hasWords(text: string) {
  return WORDS.test(text.replace(CITATION, " "));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
