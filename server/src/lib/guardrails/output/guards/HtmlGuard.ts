import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class HtmlGuard implements OutputGuard {
  private readonly unsafeTags = [
    /<script\b[^>]*>/i,
    /<\/script>/i,
    /<iframe\b[^>]*>/i,
    /<\/iframe>/i,
    /<object\b[^>]*>/i,
    /<\/object>/i,
    /<embed\b[^>]*>/i,
    /<\/embed>/i,
    /javascript:/i
  ];

  getName(): string {
    return 'HtmlGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;

    for (const tag of this.unsafeTags) {
      if (tag.test(text)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Unsafe HTML detected in the generated response.',
        };
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
