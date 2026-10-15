import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownSanitizationGuard } from './MarkdownSanitizationGuard';
import { ChatResponse, GuardDecision } from '../../../core/models';

describe('MarkdownSanitizationGuard', () => {
  let guard: MarkdownSanitizationGuard;

  beforeEach(() => {
    guard = new MarkdownSanitizationGuard();
  });

  const createResponse = (content: string): ChatResponse => ({
    message: { role: "assistant", content },
    sources: []
  });

  it('should allow valid markdown', async () => {
    const response = createResponse('Here is a [link](https://example.com).');
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.ALLOW);
  });

  it('should sanitize javascript links', async () => {
    const response = createResponse('Check this [XSS](javascript:alert(1)) out.');
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.MODIFY);
    expect(result.modifiedResponse?.message.content).toBe('Check this XSS out.');
  });

  it('should sanitize empty links', async () => {
    const response = createResponse('Check this [empty]() out.');
    const result = await guard.evaluate(response);
    expect(result.decision).toBe(GuardDecision.MODIFY);
    expect(result.modifiedResponse?.message.content).toBe('Check this empty out.');
  });
});
