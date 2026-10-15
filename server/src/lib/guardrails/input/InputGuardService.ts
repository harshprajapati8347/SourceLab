import { GuardrailsConfig } from "../../config/guardrails.js";
import { InputGuard } from "../../core/contracts.js";
import { GuardDecision, GuardRequest } from "../../core/models.js";
import { InputGuardError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { PiiGuard } from "./guards/index.js";

export class InputGuardService {
  private guards: InputGuard[] = [];

  constructor(config: GuardrailsConfig) {
    if (config.ENABLE_PII_GUARD) {
      this.guards.push(new PiiGuard());
    }

    logger.info(
      `Initialized InputGuardService with ${this.guards.length} guards.`,
    );
  }

  async validateAndSanitize(request: GuardRequest): Promise<GuardRequest> {
    let currentRequest = request;

    for (const guard of this.guards) {
      logger.debug({ guardName: guard.getName() }, "Guard execution started");

      const result = await guard.evaluate(currentRequest);

      logger.debug(
        { guardName: guard.getName(), decision: result.decision },
        "Guard decision",
      );

      if (result.decision === GuardDecision.REJECT) {
        logger.warn(
          { guardName: guard.getName(), message: result.message },
          "Request rejected by guard",
        );
        throw new InputGuardError(
          result.message || "Request was rejected by input guard.",
          guard.getName(),
        );
      }

      if (result.decision === GuardDecision.MODIFY && result.modifiedRequest) {
        logger.info({ guardName: guard.getName() }, "Request modified by guard");
        currentRequest = result.modifiedRequest;
      }
    }

    return currentRequest;
  }
}
