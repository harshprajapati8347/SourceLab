import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class ControlCharacterGuard implements OutputGuard {
  getName(): string {
    return 'ControlCharacterGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;
    // Allow tabs, newlines, carriage returns, but remove other control characters (0x00-0x1F and 0x7F)
    const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    if (text !== sanitized) {
      return {
        decision: GuardDecision.MODIFY,
        message: 'Invalid control characters were removed from the response.',
        modifiedResponse: {
          ...response,
          message: {
            ...response.message,
            content: sanitized,
          }
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
