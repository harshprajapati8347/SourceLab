import { describe, it, expect } from 'vitest';
import { SpamGuard } from './SpamGuard';
import { GuardDecision } from '../../../core/models';

describe('SpamGuard', () => {
  const guard = new SpamGuard();

  it('should return ALLOW for normal text', async () => {
    const result = await guard.evaluate({ query: 'This is a normal sentence.' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for excessive repeated characters', async () => {
    const result = await guard.evaluate({ query: 'aaaaaaaaaaa' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });

  it('should return REJECT for excessive punctuation', async () => {
    const result = await guard.evaluate({ query: 'Why???????' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });
});
