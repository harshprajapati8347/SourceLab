import { describe, it, expect } from 'vitest';
import { MaxLengthGuard } from './MaxLengthGuard';
import { GuardDecision } from '../../../core/models';

describe('MaxLengthGuard', () => {
  const guard = new MaxLengthGuard(10);

  it('should return ALLOW for valid queries', async () => {
    const result = await guard.evaluate({ query: 'hello' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return ALLOW for queries exactly equal to max length', async () => {
    const result = await guard.evaluate({ query: '1234567890' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for queries exceeding max length', async () => {
    const result = await guard.evaluate({ query: '12345678901' });
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.message).toContain('10');
  });
});
