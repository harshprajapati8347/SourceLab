import { OutputGuard } from "../../../core/contracts.js";
import { ChatResponse, GuardDecision, GuardResult } from "../../../core/models.js";

export class MaximumLengthGuard implements OutputGuard {
  constructor(private readonly maxLength: number) {}

  getName(): string {
    return 'MaximumLengthGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    if (response.message.content.length > this.maxLength) {
      return {
        decision: GuardDecision.REJECT,
        message: `Generated response exceeds the maximum allowed length of ${this.maxLength} characters.`,
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
