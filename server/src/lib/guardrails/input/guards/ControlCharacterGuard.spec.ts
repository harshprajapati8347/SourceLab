import { describe, it, expect } from 'vitest';
import { ControlCharacterGuard } from './ControlCharacterGuard';
import { GuardDecision } from '../../../core/models';

describe('ControlCharacterGuard', () => {
  const guard = new ControlCharacterGuard();

  it('should return ALLOW for valid queries', async () => {
    const result = await guard.evaluate({ query: 'hello world' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return ALLOW for typical whitespace like tab and newline', async () => {
    const result = await guard.evaluate({ query: 'hello\tworld\n' });
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should return MODIFY and remove invalid control characters', async () => {
    // \x00 is null, \x1B is escape
    const result = await guard.evaluate({ query: 'hello\x00world\x1B' });
    expect(result.decision).toBe(GuardDecision.MODIFY);
    expect(result.modifiedRequest?.query).toBe('helloworld');
  });
});
