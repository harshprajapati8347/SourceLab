import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class UnicodeNormalizationGuard implements OutputGuard {
  getName(): string {
    return 'UnicodeNormalizationGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;
    const normalized = text.normalize('NFKC');

    if (text !== normalized) {
      return {
        decision: GuardDecision.MODIFY,
        message: 'Response text was Unicode normalized (NFKC).',
        modifiedResponse: {
          ...response,
          message: {
            ...response.message,
            content: normalized,
          }
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
