import { GuardrailsConfig } from '../../config/guardrails.js';
import { OutputGuard } from '../../core/contracts.js';
import { ChatResponse, GuardDecision } from '../../core/models.js';
import { OutputGuardError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

import {
  EmptyResponseGuard,
  MaximumLengthGuard,
  CitationGuard,
  SensitiveDataGuard,
  PromptLeakageGuard,
  ChainOfThoughtGuard,
  HallucinatedCitationGuard,
  MarkdownSanitizationGuard,
  HtmlGuard,
  UnicodeNormalizationGuard,
  ControlCharacterGuard
} from './guards/index.js';

export class OutputGuardService {
  private guards: OutputGuard[] = [];

  constructor(config: GuardrailsConfig) {
    // 1. Mandatory / Always-on Deterministic Guards
    this.guards.push(new UnicodeNormalizationGuard());
    this.guards.push(new ControlCharacterGuard());
    this.guards.push(new MaximumLengthGuard(config.OUTPUT_MAX_RESPONSE_LENGTH));

    // 2. Configurable Guards
    if (config.ENABLE_EMPTY_RESPONSE_GUARD) {
      this.guards.push(new EmptyResponseGuard());
    }
    if (config.ENABLE_CITATION_GUARD) {
      this.guards.push(new CitationGuard());
    }
    if (config.ENABLE_SENSITIVE_DATA_GUARD) {
      this.guards.push(new SensitiveDataGuard());
    }
    if (config.ENABLE_PROMPT_LEAKAGE_GUARD) {
      this.guards.push(new PromptLeakageGuard());
    }
    if (config.ENABLE_CHAIN_OF_THOUGHT_GUARD) {
      this.guards.push(new ChainOfThoughtGuard());
    }
    if (config.ENABLE_HALLUCINATED_CITATION_GUARD) {
      this.guards.push(new HallucinatedCitationGuard());
    }
    if (config.ENABLE_MARKDOWN_GUARD) {
      this.guards.push(new MarkdownSanitizationGuard());
    }
    if (config.ENABLE_HTML_GUARD) {
      this.guards.push(new HtmlGuard());
    }

    logger.info(`Initialized OutputGuardService with ${this.guards.length} guards.`);
  }

  async validateAndSanitize(response: ChatResponse): Promise<ChatResponse> {
    let currentResponse = response;

    for (const guard of this.guards) {
      logger.debug({ guardName: guard.getName() }, 'Output guard execution started');
      
      const result = await guard.evaluate(currentResponse);
      
      logger.debug({ guardName: guard.getName(), decision: result.decision }, 'Output guard decision');

      if (result.decision === GuardDecision.REJECT) {
        logger.warn({ guardName: guard.getName(), message: result.message }, 'Response rejected by output guard');
        throw new OutputGuardError(result.message || 'Response was rejected by output guard.', guard.getName());
      }

      if (result.decision === GuardDecision.MODIFY && result.modifiedResponse) {
        logger.info({ guardName: guard.getName() }, 'Response modified by output guard');
        currentResponse = result.modifiedResponse;
      }
    }

    return currentResponse;
  }
}
