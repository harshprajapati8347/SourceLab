import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class EmptyResponseGuard implements OutputGuard {
  getName(): string {
    return 'EmptyResponseGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    if (!response.message.content || response.message.content.trim() === '') {
      return {
        decision: GuardDecision.REJECT,
        message: 'Generated response is empty or contains only whitespace.',
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
