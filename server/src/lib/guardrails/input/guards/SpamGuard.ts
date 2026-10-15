import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class SpamGuard implements InputGuard {
  // Matches 10 or more of the same character in a row
  private readonly repeatedCharPattern = /(.)\1{9,}/i;
  // Matches excessive punctuation (e.g., ????????, !!!!!!!)
  private readonly excessivePunctuationPattern = /[!?.]{5,}/;

  getName(): string {
    return 'SpamGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    if (this.repeatedCharPattern.test(request.query)) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Spam detected: excessive repeated characters.',
      };
    }

    if (this.excessivePunctuationPattern.test(request.query)) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Spam detected: excessive punctuation.',
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
