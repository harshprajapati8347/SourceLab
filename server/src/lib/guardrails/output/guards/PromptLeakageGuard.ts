import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class PromptLeakageGuard implements OutputGuard {
  private readonly leakageKeywords = [
    'system prompt',
    'developer prompt',
    'hidden instructions',
    'internal reasoning',
    'ignore previous instructions',
    'you are a large language model',
    'you are an ai',
    'as an ai language model'
  ];

  getName(): string {
    return 'PromptLeakageGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const lowerText = response.message.content.toLowerCase();

    for (const keyword of this.leakageKeywords) {
      if (lowerText.includes(keyword)) {
        return {
          decision: GuardDecision.REJECT,
          message: `Prompt leakage detected. Found phrase: "${keyword}"`,
        };
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
