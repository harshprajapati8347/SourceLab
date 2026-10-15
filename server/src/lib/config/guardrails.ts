/**
 * Switches for the local guards in `server/src/lib/guardrails`.
 *
 * Always-on guards (empty query, input length, Unicode normalization, control
 * characters, output length) do not have a switch. `UrlGuard` runs only when
 * `ALLOW_URLS` is false.
 */

export interface GuardrailsConfig {
  INPUT_MAX_QUERY_LENGTH: number;
  ALLOW_URLS: boolean;
  ENABLE_PROMPT_INJECTION_GUARD: boolean;
  ENABLE_JAILBREAK_GUARD: boolean;
  ENABLE_SQL_INJECTION_GUARD: boolean;
  ENABLE_XSS_GUARD: boolean;
  ENABLE_PATH_TRAVERSAL_GUARD: boolean;
  ENABLE_SPAM_GUARD: boolean;
  ENABLE_PII_GUARD: boolean;

  OUTPUT_MAX_RESPONSE_LENGTH: number;
  ENABLE_EMPTY_RESPONSE_GUARD: boolean;
  ENABLE_CITATION_GUARD: boolean;
  ENABLE_PROMPT_LEAKAGE_GUARD: boolean;
  ENABLE_CHAIN_OF_THOUGHT_GUARD: boolean;
  ENABLE_SENSITIVE_DATA_GUARD: boolean;
  ENABLE_HALLUCINATED_CITATION_GUARD: boolean;
  ENABLE_MARKDOWN_GUARD: boolean;
  ENABLE_HTML_GUARD: boolean;
}

export const guardrailsConfig: GuardrailsConfig = {
  INPUT_MAX_QUERY_LENGTH: 4000,
  ALLOW_URLS: true,
  ENABLE_PROMPT_INJECTION_GUARD: true,
  ENABLE_JAILBREAK_GUARD: true,
  ENABLE_SQL_INJECTION_GUARD: true,
  ENABLE_XSS_GUARD: true,
  ENABLE_PATH_TRAVERSAL_GUARD: true,
  ENABLE_SPAM_GUARD: true,
  ENABLE_PII_GUARD: true,

  OUTPUT_MAX_RESPONSE_LENGTH: 25000,
  ENABLE_EMPTY_RESPONSE_GUARD: true,
  ENABLE_CITATION_GUARD: true,
  ENABLE_PROMPT_LEAKAGE_GUARD: true,
  ENABLE_CHAIN_OF_THOUGHT_GUARD: true,
  ENABLE_SENSITIVE_DATA_GUARD: true,
  ENABLE_HALLUCINATED_CITATION_GUARD: true,
  ENABLE_MARKDOWN_GUARD: true,
  ENABLE_HTML_GUARD: true,
};
