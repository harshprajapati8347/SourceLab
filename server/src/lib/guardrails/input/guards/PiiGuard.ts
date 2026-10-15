import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';
import { PiiDetector, type DetectedItem } from '../../shared/pii-detector.js';

export type { DetectedItem };

export class PiiGuard implements InputGuard {
  private readonly detector = new PiiDetector();

  getName(): string {
    return 'PiiGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    const detectedItems = this.detector.detect(request.query);

    if (detectedItems.length > 0) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Personally Identifiable Information (PII) detected.',
        details: {
          pii: detectedItems,
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}

