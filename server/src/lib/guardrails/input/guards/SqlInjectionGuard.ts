import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class SqlInjectionGuard implements InputGuard {
  private readonly patterns = [
    /UNION(?:\s+ALL)?\s+SELECT/i,
    /OR\s+\d+=\d+/i, // OR 1=1
    /OR\s+'[^']+'='[^']+'/i, // OR 'a'='a'
    /DROP\s+(?:TABLE|DATABASE|INDEX|VIEW)\b/i,
    /INSERT\s+INTO\b/i,
    /UPDATE\s+.*?\s+SET\b/i,
    /DELETE\s+FROM\b/i,
    /;\s*--/, // statement terminator followed by comment
  ];

  getName(): string {
    return 'SqlInjectionGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential SQL injection detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
