import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class PathTraversalGuard implements InputGuard {
  private readonly patterns = [
    /\.\.\//, // ../
    /\.\.\\/, // ..\
    /\/etc\/passwd/i,
    /file:\/\//i,
    /c:\\windows\\system32/i,
  ];

  getName(): string {
    return 'PathTraversalGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential path traversal detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
