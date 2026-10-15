import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';
import { PiiDetector } from '../../shared/pii-detector.js';
import { logger } from '../../../shared/logger.js';

export class SensitiveDataGuard implements OutputGuard {
  private readonly detector = new PiiDetector();

  getName(): string {
    return 'SensitiveDataGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;
    const detectedItems = this.detector.detect(text);

    if (detectedItems.length > 0) {
      logger.warn(
        {
          detectedTypes: detectedItems.map((i) => i.type),
          detectedValues: detectedItems.map((i) => i.value),
        },
        '[SensitiveDataGuard] Sensitive data/PII detected in generated response',
      );
      return {
        decision: GuardDecision.REJECT,
        message: `Sensitive data detected in generated response (${detectedItems.map((i) => i.type).join(', ')})`,
        details: {
          pii: detectedItems,
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
