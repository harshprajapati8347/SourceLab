import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class MaxLengthGuard implements InputGuard {
  constructor(private readonly maxLength: number) {}

  getName(): string {
    return 'MaxLengthGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    if (request.query.length > this.maxLength) {
      return {
        decision: GuardDecision.REJECT,
        message: `Query exceeds maximum allowed length of ${this.maxLength} characters.`,
      };
    }
    return { decision: GuardDecision.ALLOW };
  }
}
