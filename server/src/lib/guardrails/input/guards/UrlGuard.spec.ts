import { describe, it, expect } from 'vitest';
import { UrlGuard } from './UrlGuard';
import { GuardDecision } from '../../../core/models';

describe('UrlGuard', () => {
  const guard = new UrlGuard();

  it('should return ALLOW for normal text', async () => {
    const result = await guard.evaluate({ query: 'Check out this website' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for URLs', async () => {
    const result = await guard.evaluate({ query: 'Go to https://example.com' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });
});
