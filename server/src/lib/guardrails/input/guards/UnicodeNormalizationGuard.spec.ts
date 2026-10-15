import { describe, it, expect } from 'vitest';
import { UnicodeNormalizationGuard } from './UnicodeNormalizationGuard';
import { GuardDecision } from '../../../core/models';

describe('UnicodeNormalizationGuard', () => {
  const guard = new UnicodeNormalizationGuard();

  it('should return ALLOW if no normalization is needed', async () => {
    const result = await guard.evaluate({ query: 'hello world' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
    expect(result.modifiedRequest).toBeUndefined();
  });

  it('should return MODIFY with NFKC normalized query', async () => {
    // \u212B is the angstrom sign, which normalizes to A with ring above (\u00C5)
    const result = await guard.evaluate({ query: 'hello \u212B' });
    expect(result.decision).toBe(GuardDecision.MODIFY);
    expect(result.modifiedRequest?.query).toBe('hello \u00C5');
  });
});
