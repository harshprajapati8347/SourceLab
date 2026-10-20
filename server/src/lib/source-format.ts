/**
 * Cleans text extracted from PDFs, YouTube captions, and web pages.
 *
 * The rewrite is mechanical. Words, numbers, links, and code stay as extracted.
 * Nothing is summarized, explained, or added. Pasted text and Markdown are
 * left untouched because those sources are already authored as-is.
 */

const FORMATTED_TYPES = new Set(["PDF", "WEBSITE", "YOUTUBE"]);
const CODE_MARK = "\uE000";
const BULLET_GLYPH = /[•●▪◦►]/;
const CAPTION_NOISE =
  /\[(?:music|applause|laughter|inaudible|silence|blank_audio)\]/gi;
const BOILERPLATE =
  /^(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s+of\s+\d+|[-–—]?\s*\d+\s*[-–—]?|skip to (?:main )?content|accept(?: all)? cookies|we use cookies\.?)$/i;

type ExtractedContent = {
  text: string;
  pages?: string[];
  pageCount?: number;
};

/**
 * Normalizes extracted source text before it is saved or chunked.
 *
 * @param type - Source type. TEXT and MARKDOWN pass through unchanged
 * @param extracted - Text and, for a freshly parsed PDF, per-page strings
 * @returns Text safe to index. Empty cleanup falls back to the original text
 */
export function prepareExtractedContent(
  type: string,
  extracted: ExtractedContent,
): ExtractedContent {
  if (!FORMATTED_TYPES.has(type)) {
    return extracted;
  }

  if (type === "PDF" && extracted.pages?.length) {
    const pages = normalizePdfPages(extracted.pages);
    const text = pages.filter(Boolean).join("\n\n").trim();
    if (!hasWords(text)) {
      return extracted;
    }
    return { text, pages, pageCount: extracted.pageCount };
  }

  const text = normalizeExtractedContent(extracted.text, type);
  if (!hasWords(text)) {
    return extracted;
  }

  return { text, pages: extracted.pages, pageCount: extracted.pageCount };
}

/**
 * Cleans one extracted document.
 *
 * @param input - Raw extracted text
 * @param type - PDF, WEBSITE, or YOUTUBE
 * @returns Cleaned text, or the trimmed original when cleanup removes every word
 */
export function normalizeExtractedContent(input: string, type: string) {
  if (!FORMATTED_TYPES.has(type)) {
    return input;
  }

  const { text, blocks } = protectCode(cleanControls(input));
  let next = decodeEntities(text);
  next = htmlToMarkdown(next);
  next = cleanMarkdownImages(next);
  if (type === "YOUTUBE") {
    next = next.replace(CAPTION_NOISE, " ");
  }
  next = dropRepeatedSentences(next);

  let lines = next.split("\n").flatMap(splitInlineLists);
  lines = lines.map(normalizeListMarker);
  lines = repairHeadingSyntax(lines);
  lines = repairHeadingLevels(lines);
  lines = convertTabTables(lines);
  lines = repairPipeTables(lines);
  lines = unwrapLines(lines);
  lines = dropBoilerplateAndEmptyBullets(lines);
  lines = dropConsecutiveDuplicates(lines);
  lines = dropSingleLongBullets(lines);
  if (type === "YOUTUBE") {
    lines = paragraphTranscript(lines);
  }
  lines = spaceBlocks(lines);

  const cleaned = restoreCode(lines.join("\n"), blocks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return hasWords(cleaned) ? cleaned : input.trim();
}

/**
 * Drops running headers and footers that repeat across PDF pages, then cleans each page.
 *
 * @param pages - Per-page text from PDF extraction
 * @returns One cleaned string per page. A page that was only a header becomes empty
 */
export function normalizePdfPages(pages: string[]) {
  const stripped = stripRepeatedPageChrome(pages.map(cleanControls));
  return stripped.map((page) =>
    page.trim() ? normalizeExtractedContent(page, "PDF") : "",
  );
}

function cleanControls(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000\u200B\uFEFF]/g, "")
    .replace(/\u00AD/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\f/g, "\n");
}

function protectCode(input: string) {
  const blocks: string[] = [];
  const text = input.replace(/```[\s\S]*?(?:```|$)/g, (match) => {
    const token = `${CODE_MARK}${blocks.length}${CODE_MARK}`;
    blocks.push(match);
    return token;
  });
  return { text, blocks };
}

function restoreCode(input: string, blocks: string[]) {
  return input.replace(
    new RegExp(`${CODE_MARK}(\\d+)${CODE_MARK}`, "g"),
    (_, index: string) => blocks[Number(index)] ?? "",
  );
}

function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) => fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value: string) =>
      fromCodePoint(Number.parseInt(value, 16)),
    );
}

function fromCodePoint(code: number) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
    return "";
  }
  if (code < 32 && code !== 9 && code !== 10) {
    return "";
  }
  return String.fromCodePoint(code);
}

function htmlToMarkdown(input: string) {
  let text = input.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<img\b([^>]*)\/?>/gi, (_, attrs: string) =>
    imageFromAttrs(attrs),
  );
  text = text.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (_, attrs: string, body: string) => {
      const href = attr(attrs, "href");
      const label = innerText(body);
      if (!href) {
        return label;
      }
      return `[${label || href}](${href})`;
    },
  );
  text = text.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, body: string) =>
      `\n${"#".repeat(Number(level))} ${innerText(body)}\n`,
  );
  text = text.replace(
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi,
    (_, body: string) => `\n${tableToMarkdown(body)}\n`,
  );
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, body: string) => {
    return `\n- ${innerText(body)}\n`;
  });
  text = text.replace(/<\/?(?:ul|ol|p|div|section|article|header|footer|nav|main)\b[^>]*>/gi, "\n");
  text = text.replace(/<\/?(?:strong|b)\b[^>]*>/gi, "**");
  text = text.replace(/<\/?(?:em|i)\b[^>]*>/gi, "*");
  return text;
}

function imageFromAttrs(attrs: string) {
  const width = Number(attr(attrs, "width"));
  const height = Number(attr(attrs, "height"));
  if (width > 0 && width <= 2 && height > 0 && height <= 2) {
    return "";
  }
  const src = attr(attrs, "src");
  if (!src) {
    return "";
  }
  const alt = attr(attrs, "alt");
  return `![${alt}](${src})`;
}

function tableToMarkdown(body: string) {
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (row) =>
      [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        innerText(cell[1]).replace(/\|/g, "\\|"),
      ),
  );
  const filled = rows.filter((row) => row.length > 0);
  if (filled.length === 0) {
    return "";
  }
  const width = Math.max(...filled.map((row) => row.length));
  const padded = filled.map((row) => {
    const cells = [...row];
    while (cells.length < width) {
      cells.push("");
    }
    return `| ${cells.join(" | ")} |`;
  });
  padded.splice(1, 0, `| ${Array(width).fill("---").join(" | ")} |`);
  return padded.join("\n");
}

function innerText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function attr(attrs: string, name: string) {
  const match = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(attrs);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function cleanMarkdownImages(input: string) {
  return input.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s*=\s*\d+x\d+)?(?:\s+"([^"]*)")?\)(?:\{[^}]*\})?/g,
    (_, alt: string, url: string, title?: string) =>
      title ? `![${alt}](${url} "${title}")` : `![${alt}](${url})`,
  );
}

function splitInlineLists(line: string) {
  if (line.includes(CODE_MARK)) {
    return [line];
  }
  const trimmed = line.trim();
  const glyphs = trimmed.match(new RegExp(BULLET_GLYPH, "g")) ?? [];
  if (glyphs.length >= 2) {
    const parts = trimmed
      .split(/\s*[•●▪◦►]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return parts.map((part) => `- ${part}`);
    }
  }
  if (glyphs.length === 1 && BULLET_GLYPH.test(trimmed[0] ?? "")) {
    return [`- ${trimmed.replace(/^[•●▪◦►]\s*/, "")}`];
  }

  if (/^[-*+]\s+\S/.test(trimmed)) {
    const parts = trimmed.replace(/^[-*+]\s+/, "").split(/\s+[-*+]\s+/);
    if (
      parts.length >= 2 &&
      parts.every((part) => part.length > 1 && !/^\d+$/.test(part))
    ) {
      return parts.map((part) => `- ${part}`);
    }
  }

  if (/^\d+[.)]\s*\S/.test(trimmed)) {
    const parts = trimmed.split(/\s+(?=\d+[.)]\s*[A-Z])/);
    if (
      parts.length >= 2 &&
      parts.every((part, index) => index === 0 || /^\d+[.)]\s*[A-Z]/.test(part))
    ) {
      return parts;
    }
  }

  return [line];
}

function normalizeListMarker(line: string) {
  if (line.includes(CODE_MARK)) {
    return line;
  }
  const marker = /^(\s*)(?:[-*+]|[•●▪◦►])\s+(?=\S)/.exec(line);
  if (marker) {
    return `${marker[1]}- ${line.slice(marker[0].length)}`;
  }
  const ordered = /^(\s*)(\d+)[.)](?=\S)/.exec(line);
  if (ordered) {
    return `${ordered[1]}${ordered[2]}. ${line.slice(ordered[0].length)}`;
  }
  const spaced = /^(\s*)(\d+)[.)]\s+/.exec(line);
  if (spaced) {
    return `${spaced[1]}${spaced[2]}. ${line.slice(spaced[0].length)}`;
  }
  return line.replace(/^(\s*)-\s+-\s+/, "$1- ");
}

function repairHeadingSyntax(lines: string[]) {
  return lines.map((line) => {
    if (line.includes(CODE_MARK)) {
      return line;
    }
    const match = /^(\s*)(#{1,6})([^\s#].*)$/.exec(line);
    if (!match) {
      return line;
    }
    return `${match[1]}${match[2]} ${match[3]}`;
  });
}

function repairHeadingLevels(lines: string[]) {
  const found: { index: number; level: number }[] = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)(#{1,6}) (?=\S)/.exec(line);
    if (match && !line.includes(CODE_MARK)) {
      found.push({ index, level: match[2].length });
    }
  });
  if (found.length === 0) {
    return lines;
  }

  const ranks = [...new Set(found.map((item) => item.level))].sort(
    (left, right) => left - right,
  );
  const map = new Map(ranks.map((level, rank) => [level, rank + 1]));
  const next = [...lines];
  for (const item of found) {
    const level = map.get(item.level) ?? item.level;
    next[item.index] = next[item.index].replace(
      /^(\s*)#{1,6}/,
      `$1${"#".repeat(level)}`,
    );
  }
  return next;
}

function convertTabTables(lines: string[]) {
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!isTabRow(lines[index] ?? "")) {
      out.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    const block: string[][] = [];
    while (index < lines.length && isTabRow(lines[index] ?? "")) {
      block.push((lines[index] ?? "").trim().split("\t").map((cell) => cell.trim()));
      index += 1;
    }
    const width = block[0]?.length ?? 0;
    if (block.length >= 2 && block.every((row) => row.length === width)) {
      const rows = block.map((row) => `| ${row.join(" | ")} |`);
      rows.splice(1, 0, `| ${Array(width).fill("---").join(" | ")} |`);
      out.push(...rows);
    } else {
      out.push(...block.map((row) => row.join("\t")));
    }
  }
  return out;
}

function isTabRow(line: string) {
  return line.includes("\t") && !line.includes(CODE_MARK);
}

function repairPipeTables(lines: string[]) {
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!isPipeRow(lines[index] ?? "")) {
      out.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    const block: string[] = [];
    while (index < lines.length && isPipeRow(lines[index] ?? "")) {
      block.push((lines[index] ?? "").trim());
      index += 1;
    }
    if (block.length >= 2 && !isSeparatorRow(block[1] ?? "")) {
      const columns = pipeCells(block[0] ?? "").length;
      block.splice(1, 0, `| ${Array(columns).fill("---").join(" | ")} |`);
    }
    out.push(...block);
  }
  return out;
}

function isPipeRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isSeparatorRow(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function pipeCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|");
}

function unwrapLines(lines: string[]) {
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    let current = lines[index] ?? "";
    if (!canContinue(current)) {
      out.push(current);
      continue;
    }
    while (index + 1 < lines.length && shouldJoin(current, lines[index + 1] ?? "")) {
      const next = (lines[index + 1] ?? "").trim();
      if (/[A-Za-z]-$/.test(current.trim()) && /^[a-z]/.test(next)) {
        current = `${current.trimEnd().replace(/-$/, "")}${next}`;
      } else {
        current = `${current.trimEnd()} ${next}`;
      }
      index += 1;
    }
    out.push(current);
  }
  return out;
}

function canContinue(line: string) {
  const trimmed = line.trim();
  return Boolean(trimmed) && !isStructural(trimmed);
}

function shouldJoin(current: string, next: string) {
  const left = current.trim();
  const right = next.trim();
  if (!left || !right || isStructural(right) || right.includes(CODE_MARK)) {
    return false;
  }
  if (/[A-Za-z]-$/.test(left) && /^[a-z]/.test(right)) {
    return true;
  }
  return left.length >= 40 && !/[.!?:;]$/.test(left) && /^[a-z("'[]/.test(right);
}

function isStructural(line: string) {
  return (
    /^(?:[-*+]|\d+[.)])\s+\S/.test(line) ||
    /^#{1,6}\s+\S/.test(line) ||
    isPipeRow(line) ||
    isSeparatorRow(line) ||
    line.startsWith("```") ||
    line.includes(CODE_MARK) ||
    /^\[[^\]]+\]\([^)]+\)$/.test(line) ||
    /^!\[[^\]]*\]\([^)]+\)$/.test(line)
  );
}

function dropBoilerplateAndEmptyBullets(lines: string[]) {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }
    if (trimmed.includes(CODE_MARK)) {
      return true;
    }
    if (/^(?:[-*+]|\d+[.)])\s*$/.test(trimmed)) {
      return false;
    }
    if (/^#{1,6}\s*$/.test(trimmed)) {
      return false;
    }
    return !BOILERPLATE.test(trimmed);
  });
}

function dropRepeatedSentences(input: string) {
  return input.replace(/([^.!?\n]{12,}[.!?])(?:\s+\1)+/g, "$1");
}

function dropConsecutiveDuplicates(lines: string[]) {
  const kept: string[] = [];
  let previous = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed === previous && !trimmed.includes(CODE_MARK)) {
      continue;
    }
    kept.push(line);
    previous = trimmed;
  }

  const paragraphs: string[] = [];
  let block: string[] = [];
  const flush = () => {
    const text = block.join("\n").trim();
    if (text && text === paragraphs.at(-1)) {
      block = [];
      return;
    }
    if (block.length > 0) {
      paragraphs.push(text);
    }
    block = [];
  };

  for (const line of kept) {
    if (!line.trim()) {
      flush();
      continue;
    }
    block.push(line);
  }
  flush();
  return paragraphs.flatMap((paragraph, index) =>
    index === 0 ? paragraph.split("\n") : ["", ...paragraph.split("\n")],
  );
}

function dropSingleLongBullets(lines: string[]) {
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!isListLine(lines[index] ?? "")) {
      out.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    const block: string[] = [];
    while (index < lines.length && isListLine(lines[index] ?? "")) {
      block.push(lines[index] ?? "");
      index += 1;
    }
    if (block.length === 1) {
      const text = (block[0] ?? "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
      out.push(text.length > 160 ? text : (block[0] ?? ""));
      continue;
    }
    out.push(...block);
  }
  return out;
}

function isListLine(line: string) {
  return /^(?:[-*+]|\d+[.)])\s+\S/.test(line.trim());
}

function paragraphTranscript(lines: string[]) {
  return lines.flatMap((line) => {
    if (isStructural(line.trim()) || line.trim().length < 400) {
      return [line];
    }
    const sentences = line
      .trim()
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .filter(Boolean);
    if (sentences.length < 2) {
      return [wrapWords(line.trim(), 600)];
    }
    const paragraphs: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (current && next.length > 500) {
        paragraphs.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current) {
      paragraphs.push(current);
    }
    return paragraphs.flatMap((paragraph, index) =>
      index === 0 ? [paragraph] : ["", paragraph],
    );
  });
}

function wrapWords(line: string, size: number) {
  if (line.length <= size) {
    return line;
  }
  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > size) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.join("\n\n");
}

function spaceBlocks(lines: string[]) {
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const previous = out.at(-1)?.trim() ?? "";
    const needsGap =
      trimmed &&
      previous &&
      (isHeading(trimmed) ||
        isHeading(previous) ||
        (isListLine(trimmed) && !isListLine(previous) && !isStructural(previous)) ||
        (isPipeRow(trimmed) && !isPipeRow(previous) && !isSeparatorRow(previous)));
    if (needsGap && previous !== "") {
      out.push("");
    }
    out.push(line.trimEnd());
  }
  return out;
}

function isHeading(line: string) {
  return /^#{1,6}\s+\S/.test(line);
}

function stripRepeatedPageChrome(pages: string[]) {
  if (pages.length < 2) {
    return pages;
  }
  const first = pages.map((page) => edgeLine(page));
  const last = pages.map((page) => edgeLine(page, true));
  const dropFirst = repeatedEdge(first, pages.length);
  const dropLast = repeatedEdge(last, pages.length);

  return pages.map((page, index) => {
    const lines = page.split("\n");
    const content = lines.filter((line) => line.trim());
    if (content.length < 2) {
      return page;
    }
    if (dropFirst && first[index] === dropFirst) {
      const at = lines.findIndex((line) => line.trim() === dropFirst);
      if (at >= 0) {
        lines.splice(at, 1);
      }
    }
    if (dropLast && dropLast !== dropFirst && last[index] === dropLast) {
      for (let at = lines.length - 1; at >= 0; at -= 1) {
        if (lines[at]?.trim() === dropLast) {
          lines.splice(at, 1);
          break;
        }
      }
    }
    return lines.join("\n").trim();
  });
}

function edgeLine(page: string, fromEnd = false) {
  const lines = page
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const line = fromEnd ? lines.at(-1) : lines[0];
  if (!line || line.length > 80) {
    return "";
  }
  return line;
}

function repeatedEdge(lines: string[], total: number) {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!line) {
      continue;
    }
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  let best = "";
  let count = 0;
  for (const [line, seen] of counts) {
    if (seen > count) {
      best = line;
      count = seen;
    }
  }
  return count >= Math.max(2, Math.ceil(total * 0.6)) ? best : "";
}

function hasWords(text: string) {
  return /[A-Za-z0-9]/.test(text);
}
