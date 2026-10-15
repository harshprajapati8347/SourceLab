/**
 * Switches for the local guards that exist in this repo.
 *
 * PII rejection, output length, and chain-of-thought rejection are the only
 * checks. Missing open-source guards are not represented here.
 */

export interface GuardrailsConfig {
  ENABLE_PII_GUARD: boolean;
  OUTPUT_MAX_RESPONSE_LENGTH: number;
  ENABLE_CHAIN_OF_THOUGHT_GUARD: boolean;
}

export const guardrailsConfig: GuardrailsConfig = {
  ENABLE_PII_GUARD: true,
  OUTPUT_MAX_RESPONSE_LENGTH: 25000,
  ENABLE_CHAIN_OF_THOUGHT_GUARD: true,
};
