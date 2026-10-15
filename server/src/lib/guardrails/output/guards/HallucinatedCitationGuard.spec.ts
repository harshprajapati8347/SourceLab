import { describe, it, expect, beforeEach } from 'vitest';
import { HallucinatedCitationGuard } from './HallucinatedCitationGuard';
import { ChatResponse, GuardDecision } from '../../../core/models';

describe('HallucinatedCitationGuard', () => {
  let guard: HallucinatedCitationGuard;

  beforeEach(() => {
    guard = new HallucinatedCitationGuard();
  });

  const createResponse = (content: string, numSources: number): ChatResponse => {
    const sources = Array.from({ length: numSources }, (_, i) => ({
      chunk: { id: `chunk-${i}` },
      score: 0.9,
    }));
    return {
      message: { role: "assistant", content },
      sources,
    };
  };

  it('should allow valid citations', async () => {
    const response = createResponse('Here is a fact [1] and another [2].', 2);
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should reject out of bounds citation', async () => {
    const response = createResponse('This has citation [3].', 2);
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.message).toContain('Hallucinated citation detected');
  });

  it('should reject zero citation', async () => {
    const response = createResponse('This has citation [0].', 2);
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.message).toContain('Hallucinated citation detected');
  });
});
