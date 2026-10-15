import { describe, it, expect } from 'vitest';
import { XssGuard } from './XssGuard';
import { GuardDecision } from '../../../core/models';

describe('XssGuard', () => {
  const guard = new XssGuard();

  it('should return ALLOW for normal text', async () => {
    const result = await guard.evaluate({ query: 'How to write a script?' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for script tags', async () => {
    const result = await guard.evaluate({ query: '<script>alert(1)</script>' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });

  it('should return REJECT for javascript protocol', async () => {
    const result = await guard.evaluate({ query: 'javascript:alert(1)' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });
});
