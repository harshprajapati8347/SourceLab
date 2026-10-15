import { GuardrailsConfig } from '../../config/guardrails.js';
import { InputGuard } from '../../core/contracts.js';
import { GuardDecision, GuardRequest } from '../../core/models.js';
import { InputGuardError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

import {
  EmptyQueryGuard,
  MaxLengthGuard,
  UnicodeNormalizationGuard,
  ControlCharacterGuard,
  PromptInjectionGuard,
  JailbreakGuard,
  SqlInjectionGuard,
  XssGuard,
  PathTraversalGuard,
  UrlGuard,
  SpamGuard,
  PiiGuard,
} from './guards/index.js';

export class InputGuardService {
  private guards: InputGuard[] = [];

  constructor(config: GuardrailsConfig) {
    // 1. Mandatory / Always-on Deterministic Guards
    this.guards.push(new EmptyQueryGuard());
    this.guards.push(new MaxLengthGuard(config.INPUT_MAX_QUERY_LENGTH));
    this.guards.push(new UnicodeNormalizationGuard());
    this.guards.push(new ControlCharacterGuard());

    // 2. Configurable Guards
    if (config.ENABLE_PROMPT_INJECTION_GUARD) {
      this.guards.push(new PromptInjectionGuard());
    }
    if (config.ENABLE_JAILBREAK_GUARD) {
      this.guards.push(new JailbreakGuard());
    }
    if (config.ENABLE_SQL_INJECTION_GUARD) {
      this.guards.push(new SqlInjectionGuard());
    }
    if (config.ENABLE_XSS_GUARD) {
      this.guards.push(new XssGuard());
    }
    if (config.ENABLE_PATH_TRAVERSAL_GUARD) {
      this.guards.push(new PathTraversalGuard());
    }
    if (!config.ALLOW_URLS) {
      this.guards.push(new UrlGuard());
    }
    if (config.ENABLE_SPAM_GUARD) {
      this.guards.push(new SpamGuard());
    }
    if (config.ENABLE_PII_GUARD) {
      this.guards.push(new PiiGuard());
    }

    logger.info(`Initialized InputGuardService with ${this.guards.length} guards.`);
  }

  async validateAndSanitize(request: GuardRequest): Promise<GuardRequest> {
    let currentRequest = request;

    for (const guard of this.guards) {
      logger.debug({ guardName: guard.getName() }, 'Guard execution started');
      
      const result = await guard.evaluate(currentRequest);
      
      logger.debug({ guardName: guard.getName(), decision: result.decision }, 'Guard decision');

      if (result.decision === GuardDecision.REJECT) {
        logger.warn({ guardName: guard.getName(), message: result.message }, 'Request rejected by guard');
        throw new InputGuardError(result.message || 'Request was rejected by input guard.', guard.getName());
      }

      if (result.decision === GuardDecision.MODIFY && result.modifiedRequest) {
        logger.info({ guardName: guard.getName() }, 'Request modified by guard');
        currentRequest = result.modifiedRequest;
      }
    }

    return currentRequest;
  }
}
