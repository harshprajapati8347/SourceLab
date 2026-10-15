import { describe, it, expect } from 'vitest';
import { PathTraversalGuard } from './PathTraversalGuard';
import { GuardDecision } from '../../../core/models';

describe('PathTraversalGuard', () => {
  const guard = new PathTraversalGuard();

  it('should return ALLOW for normal text', async () => {
    const result = await guard.evaluate({ query: 'What is the path to success?' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for ../', async () => {
    const result = await guard.evaluate({ query: '../../secret.txt' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });

  it('should return REJECT for /etc/passwd', async () => {
    const result = await guard.evaluate({ query: 'cat /etc/passwd' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });
});
