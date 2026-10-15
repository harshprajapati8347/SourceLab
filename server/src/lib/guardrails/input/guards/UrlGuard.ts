import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class UrlGuard implements InputGuard {
  private readonly urlRegex = /(https?:\/\/[^\s]+)/gi;

  getName(): string {
    return 'UrlGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    if (this.urlRegex.test(request.query)) {
      return {
        decision: GuardDecision.REJECT,
        message: 'External URLs are not allowed in the query.',
      };
    }
    return { decision: GuardDecision.ALLOW };
  }
}
