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
  "Each span must be an exact copy of one sentence from the answer, including its citation marker.",
  'citations are the markers in that sentence, such as "1" or "W1", without brackets.',
  "supported is true only when every cited passage supports the claim.",
  "A claim with no citation is not supported.",
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
    new Set(evidence.map((passage) => passage.marker)),
  );
}

/**
 * Applies marker checks and removes unsupported sentences.
 *
 * The verdict is computed here. A claim the judge marks supported is still
 * unsupported when its marker is missing or does not exist in the evidence.
 *
 * @param answer - Draft after PII masking
 * @param claims - Exact spans returned by the judge
 * @param validMarkers - Markers present in the evidence, such as `1` or `W1`
 * @returns Text to release and the three trace steps
 */
export function settleGrounding(
  answer: string,
  claims: GroundingClaimInput[],
  validMarkers: ReadonlySet<string>,
): GroundingResult {
  const settled = claims
    .filter((claim) => claim.span.trim().length > 0)
    .map((claim) => classifyClaim(claim, validMarkers));

  if (settled.length === 0) {
    return notScored(answer, "No factual claims to score.");
  }

  const supported = settled.filter((claim) => claim.supported);
  const unsupported = settled.filter((claim) => !claim.supported);
  const verdict = verdictFor(supported.length, settled.length);
  const released = releaseText(answer, supported, unsupported);
  const coverageSummary = formatCitationCoverage(
    supported.length,
    settled.length,
  );

  return {
    text: released.text,
    verdict,
    withheld: released.withheld,
    claims: settled,
    grounding: groundingStep(
      verdict,
      settled.length,
      unsupported.length,
      released,
    ),
    citations: citationStep(settled),
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
  validMarkers: ReadonlySet<string>,
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

  const missing = markers.filter((marker) => !validMarkers.has(marker));
  if (missing.length > 0) {
    return {
      span: claim.span,
      supported: false,
      reason: `missing ${missing.map((marker) => `[${marker}]`).join(", ")}`,
    };
  }

  if (!claim.supported) {
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

function releaseText(
  answer: string,
  supported: SettledClaim[],
  unsupported: SettledClaim[],
) {
  if (unsupported.length === 0) {
    return { text: answer, withheld: false, unlocatable: false };
  }

  if (supported.length === 0) {
    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: false,
    };
  }

  const ranges: SpanRange[] = [];

  for (const claim of unsupported) {
    const start = locateSpan(answer, claim.span, ranges);
    if (start === -1) {
      return {
        text: UNSUPPORTED_SOURCES_MESSAGE,
        withheld: true,
        unlocatable: true,
      };
    }

    ranges.push({ start, end: start + claim.span.length });
  }

  const stripped = tidy(removeRanges(answer, ranges));
  const kept = supported.every((claim) => stripped.includes(claim.span));
  if (!kept || !hasWords(stripped)) {
    return {
      text: UNSUPPORTED_SOURCES_MESSAGE,
      withheld: true,
      unlocatable: !kept,
    };
  }

  return { text: stripped, withheld: false, unlocatable: false };
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
      `${total} ${total === 1 ? "claim is" : "claims are"} not supported, so the answer was withheld.`,
    );
  } else {
    lines.push(
      `${removed} of ${total} claims are not supported and were removed.`,
    );
  }

  if (released.unlocatable) {
    lines.push(
      "The answer was withheld because an unsupported claim was not an exact sentence in the reply.",
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

function citationStep(claims: SettledClaim[]): GroundingStep {
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

function normalizeMarker(value: string) {
  const match = value.trim().match(/^\[?(W)?(\d+)\]?$/i);
  if (!match?.[2]) {
    return null;
  }

  return match[1] ? `W${match[2]}` : match[2];
}

function locateSpan(text: string, span: string, taken: SpanRange[]) {
  let from = 0;

  while (from < text.length) {
    const start = text.indexOf(span, from);
    if (start === -1) {
      return -1;
    }

    const end = start + span.length;
    const overlaps = taken.some(
      (range) => start < range.end && end > range.start,
    );
    if (!overlaps) {
      return start;
    }

    from = start + 1;
  }

  return -1;
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
