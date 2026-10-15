import { describe, it, expect } from 'vitest';
import { EmptyQueryGuard } from './EmptyQueryGuard';
import { GuardDecision } from '../../../core/models';

describe('EmptyQueryGuard', () => {
  const guard = new EmptyQueryGuard();

  it('should return ALLOW for valid queries', async () => {
    const result = await guard.evaluate({ query: 'hello world' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for empty strings', async () => {
    const result = await guard.evaluate({ query: '' });
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.message).toBeDefined();
  });

  it('should return REJECT for whitespace strings', async () => {
    const result = await guard.evaluate({ query: '   \n  \t ' });
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.message).toBeDefined();
  });
});
