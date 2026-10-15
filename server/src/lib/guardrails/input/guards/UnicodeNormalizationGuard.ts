import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class UnicodeNormalizationGuard implements InputGuard {
  getName(): string {
    return 'UnicodeNormalizationGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    const normalized = request.query.normalize('NFKC');
    if (normalized !== request.query) {
      return {
        decision: GuardDecision.MODIFY,
        modifiedRequest: { query: normalized },
      };
    }
    return { decision: GuardDecision.ALLOW };
  }
}
