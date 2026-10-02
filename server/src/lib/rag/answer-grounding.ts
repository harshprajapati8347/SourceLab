/**
 * Grounding and citation check for one drafted answer.
 *
 * One structured call lists factual claims. Code decides the verdict, drops
 * unsupported sentences, and calculates citation coverage.
 */

import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { RAG_INTELLIGENCE_MODEL } from "../ai-config.js";

export const UNSUPPORTED_SOURCES_MESSAGE =
  "I can't support an answer from the sources retrieved for this question because they are not sufficient to support the answer.";
// "I can't support an answer from the sources retrieved for this question.";

export type GroundingVerdict =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "NOT_SCORED";

export type GroundingClaimInput = {
  span: string;
  citations: string[];
  supported: boolean;
};

export type SettledClaim = {
  span: string;
  supported: boolean;
  reason: string;
};

export type GroundingStep = {
  summary: string;
  lines: string[];
  safeLines: string[];
};

export type GroundingResult = {
  text: string;
  verdict: GroundingVerdict;
  withheld: boolean;
  claims: SettledClaim[];
  grounding: GroundingStep;
  citations: GroundingStep;
  coverage: GroundingStep;
};

const claimSchema = z.object({
  claims: z.array(
    z.object({
      span: z.string(),
      citations: z.array(z.string()),
      supported: z.boolean(),
    }),
  ),
});

type EvidencePassage = {
  marker: string;
  title: string;
  text: string;
};

type SpanRange = {
  start: number;
  end: number;
};

const JUDGE_SYSTEM = [
  "You check a drafted answer against retrieved evidence.",
  'Return only factual claims. Skip greetings, transitions, and hedges such as uncertainty or "I don\'t know".',
  "Do not return a statement whose only point is that a detail is missing, unknown, or not in the sources.",
  "Each span must be an exact copy of one sentence from the answer, including its citation marker.",
  'citations are the markers in that sentence, such as "1" or "W1", without brackets.',
  "supported is true when the cited passage states that fact, including a faithful paraphrase of a workspace passage or web snippet.",
  "supported is false when the sentence adds a name, number, date, or other detail the passage does not state.",
  "A citation to a related passage is not enough when the passage does not contain the claimed name, number, or date.",
  "A claim with no citation is not supported.",
  "Return one claim for each distinct fact. Do not repeat the same fact in another wording.",
  "Do not add claims that are not in the answer.",
  "Do not rewrite the answer.",
].join("\n");

/**
 * Judges an answer against workspace chunks and web snippets.
 *
 * With no evidence, the answer is returned unchanged and coverage is not scored.
 *
 * @param input - Question, drafted answer, and the evidence the answer was allowed to use
 * @returns Released text plus grounding, citation, and coverage steps
 * @throws When the judge returns no structured output
 */
export async function groundAnswer(input: {
  question: string;
  answer: string;
  chunks: Array<{ title: string; text: string }>;
  webResults: Array<{ title: string; text: string }>;
}): Promise<GroundingResult> {
  const evidence: EvidencePassage[] = [
    ...input.chunks.map((chunk, index) => ({
      marker: String(index + 1),
      title: chunk.title,
      text: chunk.text,
    })),
    ...input.webResults.map((result, index) => ({
      marker: `W${index + 1}`,
      title: result.title,
      text: result.text,
    })),
  ];

  if (evidence.length === 0) {
    return notScored(
      input.answer,
      "No retrieved evidence, so the answer was not scored.",
    );
  }

  const result = await generateText({
    model: openai(RAG_INTELLIGENCE_MODEL),
    output: Output.object({ schema: claimSchema }),
    system: JUDGE_SYSTEM,
    prompt: [
      "Question:",
      input.question,
      "",
      "Evidence:",
      formatEvidence(evidence),
      "",
      "Answer:",
      input.answer,
    ].join("\n"),
  });

  if (!result.output) {
    throw new Error("Grounding check returned no output");
  }

  return settleGrounding(
    input.answer,
    result.output.claims,
    new Map(evidence.map((passage) => [passage.marker, passage.text])),
  );
}

/**
 * Applies marker checks and removes unsupported sentences.
 *
 * The verdict is computed here. A claim is unsupported when its marker is
 * missing, or when the cited passage does not contain the claimed email,
 * phone number, number, or a name later in the sentence. A faithful paraphrase
 * that cites a retrieved passage is kept. The first capitalized word of a
 * sentence is not treated as a name. Statements that a detail is missing stay
 * in the answer and are not counted as claims. Repeated wording of the same
 * fact counts once. The whole reply is replaced only when it cites nothing
 * that was retrieved.
 *
 * @param answer - Draft after PII masking
 * @param claims - Exact spans returned by the judge
 * @param evidence - Marker to passage text, such as `1` or `W1`
 * @returns Text to release and the three trace steps
 */
export function settleGrounding(
  answer: string,
  claims: GroundingClaimInput[],
  evidence: ReadonlyMap<string, string>,
): GroundingResult {
  const present = claims.filter((claim) => claim.span.trim().length > 0);
  const factual = present.filter((claim) => !isAbsenceStatement(claim.span));
  const classified = factual.map((claim) => classifyClaim(claim, evidence));
  const meaningful = groupMeaningfulClaims(classified);

  if (meaningful.length === 0) {
    return notScored(answer, "No factual claims to score.");
  }

  const supported = meaningful.filter((claim) => claim.supported);
  const unsupported = meaningful.filter((claim) => !claim.supported);
  const verdict = verdictFor(supported.length, meaningful.length);
  const released = releaseText(
    answer,
    supported,
    unsupported,
    new Set(evidence.keys()),
  );
  const coverageSummary = formatCitationCoverage(
    supported.length,
    meaningful.length,
  );

  return {
    text: released.text,
    verdict,
    withheld: released.withheld,
    claims: meaningful.map((claim) => ({
      span: claim.span,
      supported: claim.supported,
      reason: claim.reason,
    })),
    grounding: groundingStep(
      verdict,
      meaningful.length,
      unsupported.length,
      released,
    ),
    citations: citationStep(meaningful),
    coverage: {
      summary: coverageSummary,
      lines: [coverageSummary],
      safeLines: [coverageSummary],
    },
  };
}

/**
 * Formats supported claims over total claims.
 *
 * @param supported - Claims whose markers and evidence held
 * @param total - Meaningful claims found in the answer
 * @returns A label such as `7 / 8 = 87.5%`, or `Not scored` when there are no claims
 */
export function formatCitationCoverage(supported: number, total: number) {
  if (total <= 0) {
    return "Not scored";
  }

  const percent = Math.round((supported / total) * 1000) / 10;
  const label = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(1);
  return `${supported} / ${total} = ${label}%`;
}

function notScored(answer: string, line: string): GroundingResult {
  const step = {
    summary: "Not scored",
    lines: [line],
    safeLines: [line],
  };

  return {
    text: answer,
    verdict: "NOT_SCORED",
    withheld: false,
    claims: [],
    grounding: step,
    citations: step,
    coverage: {
      summary: "Not scored",
      lines: ["Not scored"],
      safeLines: ["Not scored"],
    },
  };
}

function classifyClaim(
  claim: GroundingClaimInput,
  evidence: ReadonlyMap<string, string>,
): SettledClaim {
  const markers = [
    ...new Set(
      claim.citations
        .map(normalizeMarker)
        .filter((marker): marker is string => marker !== null),
    ),
  ];

  if (markers.length === 0) {
    return {
      span: claim.span,
      supported: false,
      reason: "no citation",
    };
  }

  const missing = markers.filter((marker) => !evidence.has(marker));
  if (missing.length > 0) {
    return {
      span: claim.span,
      supported: false,
      reason: `missing ${missing.map((marker) => `[${marker}]`).join(", ")}`,
    };
  }

  const cited = markers.map((marker) => evidence.get(marker) ?? "").join("\n");
  if (!citedTextSupports(claim.span, cited)) {
    return {
      span: claim.span,
      supported: false,
      reason: "evidence does not support the claim",
    };
  }

  return {
    span: claim.span,
    supported: true,
    reason: markers.map((marker) => `[${marker}]`).join(", "),
  };
}

function verdictFor(supported: number, total: number): GroundingVerdict {
  if (supported === total) {
    return "SUPPORTED";
  }

  if (supported === 0) {
    return "UNSUPPORTED";
  }

  return "PARTIALLY_SUPPORTED";
}

type MeaningfulClaim = SettledClaim & {
  removeSpans: Array<{ span: string; required: boolean }>;
};

function groupMeaningfulClaims(claims: SettledClaim[]): MeaningfulClaim[] {
  const groups = new Map<string, SettledClaim[]>();

  for (const claim of claims) {
    const key = factKey(claim.span);
    const group = groups.get(key) ?? [];
    group.push(claim);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const kept = group.find((claim) => claim.supported) ?? group[0];
    if (!kept) {
      throw new Error("Claim group was empty");
    }

    const removeSpans = group
      .filter((claim) => claim !== kept || !kept.supported)
      .map((claim) => ({
        span: claim.span,
        required: !kept.supported,
      }));

    return {
      span: kept.span,
      supported: kept.supported,
      reason: kept.reason,
      removeSpans,
    };
  });
}

function releaseText(
  answer: string,
  supported: MeaningfulClaim[],
  unsupported: MeaningfulClaim[],
  evidenceMarkers: ReadonlySet<string>,
) {
  const removals = [...supported, ...unsupported].flatMap(
    (claim) => claim.removeSpans,
  );

  if (removals.length === 0) {
    return { text: answer, withheld: false, unlocatable: false };
  }

  const stripped = removeClaimSpans(
    answer,
    removals,
    supported.map((claim) => claim.span),
  );
  if (stripped.unlocatable) {
    if (citesRetrievedEvidence(answer, evidenceMarkers)) {
      return { text: answer, withheld: false, unlocatable: true };
    }

    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: true,
    };
  }

  if (supported.length === 0) {
    if (isAbsenceStatement(stripped.text) && hasWords(stripped.text)) {
      return { text: stripped.text, withheld: false, unlocatable: false };
    }

    if (citesRetrievedEvidence(stripped.text, evidenceMarkers)) {
      return { text: stripped.text, withheld: false, unlocatable: false };
    }

    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: false,
    };
  }

  const kept = supported.every(
    (claim) => locateSpan(stripped.text, claim.span, []) !== null,
  );
  if (!hasWords(stripped.text)) {
    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: false,
    };
  }

  if (!kept) {
    if (citesRetrievedEvidence(stripped.text, evidenceMarkers)) {
      return { text: stripped.text, withheld: false, unlocatable: true };
    }

    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: true,
    };
  }

  return { text: stripped.text, withheld: false, unlocatable: false };
}

function groundingStep(
  verdict: GroundingVerdict,
  total: number,
  removed: number,
  released: { withheld: boolean; unlocatable: boolean },
): GroundingStep {
  const lines: string[] = [];

  if (verdict === "SUPPORTED") {
    lines.push(
      `${total} ${total === 1 ? "claim is" : "claims are"} supported by the retrieved evidence.`,
    );
  } else if (verdict === "UNSUPPORTED") {
    lines.push(
      released.withheld
        ? `${total} ${total === 1 ? "claim is" : "claims are"} not supported, so the answer was withheld.`
        : `${total} ${total === 1 ? "claim is" : "claims are"} not supported.`,
    );
  } else {
    lines.push(
      `${removed} of ${total} claims are not supported and were removed.`,
    );
  }

  if (released.unlocatable) {
    lines.push(
      released.withheld
        ? "The answer was withheld because an unsupported claim was not an exact sentence in the reply."
        : "An unsupported claim was not an exact sentence, so the cited reply was kept.",
    );
  }

  const summary =
    verdict === "SUPPORTED"
      ? "Supported"
      : verdict === "PARTIALLY_SUPPORTED"
        ? "Partially supported"
        : "Unsupported";

  return { summary, lines, safeLines: lines };
}

function citationStep(
  claims: Array<Pick<SettledClaim, "span" | "supported" | "reason">>,
): GroundingStep {
  const removed = claims.filter((claim) => !claim.supported).length;
  const lines = claims.map((claim) => {
    const preview = previewSpan(claim.span);
    return claim.supported
      ? `Supported ${claim.reason}: ${preview}`
      : `Removed (${claim.reason}): ${preview}`;
  });
  const supported = claims.length - removed;
  const safeLines = [
    supported > 0 ? `Supported claims: ${supported}` : null,
    removed > 0 ? `Removed claims: ${removed}` : null,
  ].filter((line): line is string => line !== null);

  return {
    summary: removed > 0 ? `${removed} removed` : `${claims.length} checked`,
    lines,
    safeLines,
  };
}

const ABSENCE_STATEMENT =
  /\b(?:not mentioned|isn'?t mentioned|not available|not provided|not in the (?:sources|source|documents|document|context|evidence)|cannot be determined|can'?t be determined|does not (?:mention|include|contain)|do not (?:mention|include|contain))\b/i;

const FIELD_LABELS = new Set([
  "email",
  "phone",
  "city",
  "company",
  "contact",
  "customer",
  "name",
  "address",
  "number",
]);

const PROPER_NOUN_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "their",
  "his",
  "her",
]);

function isAbsenceStatement(span: string) {
  return ABSENCE_STATEMENT.test(span.replace(/\[W?\d+\]/g, " "));
}

function citedTextSupports(span: string, evidenceText: string) {
  return distinctiveTokens(span).every((token) =>
    evidenceHasToken(token, evidenceText),
  );
}

function factKey(span: string) {
  const tokens = distinctiveTokens(span).sort();
  if (tokens.length > 0) {
    return tokens.join("|");
  }

  return span
    .replace(/\[W?\d+\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distinctiveTokens(span: string) {
  const plain = span.replace(/\[W?\d+\]/g, " ");
  const emails = [...plain.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map(
    (match) => match[0].toLowerCase(),
  );
  const phones = [...plain.matchAll(/\+?\d[\d\s().-]{7,}\d/g)]
    .map((match) => match[0].replace(/\D/g, ""))
    .filter((digits) => digits.length >= 8)
    .map((digits) => digits.slice(-10));
  const numbers = [...plain.matchAll(/\d[\d,]*/g)]
    .map((match) => match[0].replace(/\D/g, ""))
    .filter((digits) => digits.length >= 2);
  const nouns = properNouns(plain).map((noun) => noun.toLowerCase());

  return [...new Set([...emails, ...phones, ...numbers, ...nouns])];
}

function properNouns(span: string) {
  const nouns: string[] = [];
  const words = span.split(/\s+/);
  let skippedFirstWord = false;

  for (const word of words) {
    const clean = word.replace(/[^A-Za-z]/g, "");
    const lower = clean.toLowerCase();
    if (clean.length === 0) {
      continue;
    }

    if (!skippedFirstWord) {
      skippedFirstWord = true;
      continue;
    }

    if (
      clean.length < 3 ||
      FIELD_LABELS.has(lower) ||
      PROPER_NOUN_STOPWORDS.has(lower)
    ) {
      continue;
    }

    if (/^[A-Z][a-z]+$/.test(clean) || /^[A-Z]{2,}$/.test(clean)) {
      nouns.push(clean);
    }
  }

  return nouns;
}

function evidenceHasToken(token: string, evidenceText: string) {
  if (token.includes("@")) {
    return evidenceText.toLowerCase().includes(token);
  }

  if (/^\d+$/.test(token)) {
    return evidenceText.replace(/\D/g, "").includes(token);
  }

  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(evidenceText);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeClaimSpans(
  answer: string,
  removals: Array<{ span: string; required: boolean }>,
  protectedSpans: string[],
) {
  const ranges: SpanRange[] = [];

  for (const span of protectedSpans) {
    const found = locateSpan(answer, span, ranges);
    if (found) {
      ranges.push(found);
    }
  }

  const protectedCount = ranges.length;

  for (const removal of removals) {
    const found = locateSpan(answer, removal.span, ranges);
    if (!found) {
      if (removal.required) {
        return { text: answer, unlocatable: true };
      }
      continue;
    }

    ranges.push(found);
  }

  const removable = ranges.slice(protectedCount);
  return { text: tidy(removeRanges(answer, removable)), unlocatable: false };
}

function normalizeMarker(value: string) {
  const match = value.trim().match(/^\[?(W)?(\d+)\]?$/i);
  if (!match?.[2]) {
    return null;
  }

  return match[1] ? `W${match[2]}` : match[2];
}

function locateSpan(text: string, span: string, taken: SpanRange[]) {
  const exact = findLiteral(text, span, taken);
  if (exact) {
    return exact;
  }

  const words = span
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return null;
  }

  const pattern = new RegExp(words.map(escapeRegExp).join("\\s+"), "g");
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined) {
      continue;
    }

    const found = { start, end: start + match[0].length };
    if (!overlapsRange(found, taken)) {
      return found;
    }
  }

  return null;
}

function findLiteral(text: string, span: string, taken: SpanRange[]) {
  let from = 0;

  while (from < text.length) {
    const start = text.indexOf(span, from);
    if (start === -1) {
      return null;
    }

    const found = { start, end: start + span.length };
    if (!overlapsRange(found, taken)) {
      return found;
    }

    from = start + 1;
  }

  return null;
}

function overlapsRange(found: SpanRange, taken: SpanRange[]) {
  return taken.some((range) => found.start < range.end && found.end > range.start);
}

function citesRetrievedEvidence(text: string, evidenceMarkers: ReadonlySet<string>) {
  return [...text.matchAll(/\[(W?\d+)\]/g)].some((match) => {
    const marker = match[1] ? normalizeMarker(match[1]) : null;
    return marker !== null && evidenceMarkers.has(marker);
  });
}

function removeRanges(text: string, ranges: SpanRange[]) {
  const merged = mergeRanges(ranges);
  let cursor = 0;
  let next = "";

  for (const range of merged) {
    next += text.slice(cursor, range.start);
    cursor = range.end;
  }

  next += text.slice(cursor);
  return next;
}

function mergeRanges(ranges: SpanRange[]) {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: SpanRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }

    last.end = Math.max(last.end, range.end);
  }

  return merged;
}

function tidy(text: string) {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasWords(text: string) {
  const withoutMarkers = text.replace(/\[W?\d+\]/g, "");
  return /[\p{L}\p{N}]/u.test(withoutMarkers);
}

function previewSpan(span: string) {
  const flat = span.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 177)}...` : flat;
}

function formatEvidence(evidence: EvidencePassage[]) {
  return evidence
    .map((passage) => `[${passage.marker}] ${passage.title}\n${passage.text}`)
    .join("\n\n");
}
