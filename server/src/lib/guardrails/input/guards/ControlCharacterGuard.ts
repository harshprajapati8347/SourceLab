import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class ControlCharacterGuard implements InputGuard {
  getName(): string {
    return 'ControlCharacterGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    // Regex matches control characters except typical whitespace (tab, newline, carriage return)
    const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
    
    if (controlCharsRegex.test(request.query)) {
      const sanitized = request.query.replace(controlCharsRegex, '');
      return {
        decision: GuardDecision.MODIFY,
        modifiedRequest: { query: sanitized },
      };
    }
    return { decision: GuardDecision.ALLOW };
  }
}
