import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class JailbreakGuard implements InputGuard {
  private readonly patterns = [
    /\bDAN\b/i, // Do Anything Now
    /developer mode/i,
    /roleplay as /i,
    /ignore (?:all )?safety rules/i,
    /pretend (?:you are|to be)/i,
    /unfiltered response/i,
  ];

  getName(): string {
    return 'JailbreakGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential jailbreak attempt detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
