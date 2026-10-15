import { OutputGuard } from "../../../core/contracts.js";
import { ChatResponse, GuardDecision, GuardResult } from "../../../core/models.js";

export class ChainOfThoughtGuard implements OutputGuard {
  private readonly chainKeywords = [
    "let's think step by step",
    "let us think step by step",
    "thinking process:",
    "scratchpad",
    "step 1:",
    "step 2:",
    "internal reasoning",
    "my reasoning:"
  ];

  getName(): string {
    return 'ChainOfThoughtGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const lowerText = response.message.content.toLowerCase();

    // Check for explicit XML/JSON tags often used for thinking
    if (lowerText.includes('<scratchpad>') || lowerText.includes('<thinking>')) {
      return {
        decision: GuardDecision.REJECT,
        message: "Chain of thought or scratchpad leakage detected in the response.",
      };
    }

    for (const keyword of this.chainKeywords) {
      if (lowerText.includes(keyword)) {
        return {
          decision: GuardDecision.REJECT,
          message: `Chain of thought leakage detected. Found phrase: "${keyword}"`,
        };
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
