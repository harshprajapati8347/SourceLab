import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class EmptyQueryGuard implements InputGuard {
  getName(): string {
    return 'EmptyQueryGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    if (!request.query || request.query.trim().length === 0) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Query cannot be empty or whitespace only.',
      };
    }
    return { decision: GuardDecision.ALLOW };
  }
}
