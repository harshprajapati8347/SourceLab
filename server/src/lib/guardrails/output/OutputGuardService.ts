import { GuardrailsConfig } from "../../config/guardrails.js";
import { OutputGuard } from "../../core/contracts.js";
import { ChatResponse, GuardDecision } from "../../core/models.js";
import { OutputGuardError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { ChainOfThoughtGuard, MaximumLengthGuard } from "./guards/index.js";

export class OutputGuardService {
  private guards: OutputGuard[] = [];

  constructor(config: GuardrailsConfig) {
    this.guards.push(new MaximumLengthGuard(config.OUTPUT_MAX_RESPONSE_LENGTH));

    if (config.ENABLE_CHAIN_OF_THOUGHT_GUARD) {
      this.guards.push(new ChainOfThoughtGuard());
    }

    logger.info(
      `Initialized OutputGuardService with ${this.guards.length} guards.`,
    );
  }

  async validateAndSanitize(response: ChatResponse): Promise<ChatResponse> {
    let currentResponse = response;

    for (const guard of this.guards) {
      logger.debug(
        { guardName: guard.getName() },
        "Output guard execution started",
      );

      const result = await guard.evaluate(currentResponse);

      logger.debug(
        { guardName: guard.getName(), decision: result.decision },
        "Output guard decision",
      );

      if (result.decision === GuardDecision.REJECT) {
        logger.warn(
          { guardName: guard.getName(), message: result.message },
          "Response rejected by output guard",
        );
        throw new OutputGuardError(
          result.message || "Response was rejected by output guard.",
          guard.getName(),
        );
      }

      if (
        result.decision === GuardDecision.MODIFY &&
        result.modifiedResponse
      ) {
        logger.info(
          { guardName: guard.getName() },
          "Response modified by output guard",
        );
        currentResponse = result.modifiedResponse;
      }
    }

    return currentResponse;
  }
}
