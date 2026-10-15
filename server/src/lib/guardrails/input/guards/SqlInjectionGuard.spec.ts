import { describe, it, expect } from 'vitest';
import { SqlInjectionGuard } from './SqlInjectionGuard';
import { GuardDecision } from '../../../core/models';

describe('SqlInjectionGuard', () => {
  const guard = new SqlInjectionGuard();

  it('should return ALLOW for normal text', async () => {
    const result = await guard.evaluate({ query: 'What is a SQL database?' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return REJECT for UNION SELECT', async () => {
    const result = await guard.evaluate({ query: 'UNION ALL SELECT * FROM users' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });

  it('should return REJECT for OR 1=1', async () => {
    const result = await guard.evaluate({ query: 'admin OR 1=1' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });

  it('should return REJECT for DROP TABLE', async () => {
    const result = await guard.evaluate({ query: 'DROP TABLE users;' });
    expect(result.decision).toBe(GuardDecision.REJECT);
  });
});
