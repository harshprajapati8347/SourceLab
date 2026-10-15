import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class XssGuard implements InputGuard {
  private readonly patterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /<iframe\b/i,
    /<img\b[^>]*src\s*=\s*(['"]?)javascript:/i,
  ];

  getName(): string {
    return 'XssGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential cross-site scripting (XSS) detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
