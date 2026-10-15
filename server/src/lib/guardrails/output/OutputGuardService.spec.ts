import { describe, it, expect, beforeEach } from 'vitest';
import { OutputGuardService } from './OutputGuardService';
import { GuardrailsConfig } from '../../config/guardrails';
import { ChatResponse } from '../../core/models';
import { OutputGuardError } from '../../shared/errors';

describe('OutputGuardService', () => {
  const mockConfig: GuardrailsConfig = {
    INPUT_MAX_QUERY_LENGTH: 4000,
    ALLOW_URLS: true,
    ENABLE_PROMPT_INJECTION_GUARD: true,
    ENABLE_JAILBREAK_GUARD: true,
    ENABLE_SQL_INJECTION_GUARD: true,
    ENABLE_XSS_GUARD: true,
    ENABLE_PATH_TRAVERSAL_GUARD: true,
    ENABLE_SPAM_GUARD: true,
    ENABLE_PII_GUARD: true,
    
    OUTPUT_MAX_RESPONSE_LENGTH: 25000,
    ENABLE_EMPTY_RESPONSE_GUARD: true,
    ENABLE_CITATION_GUARD: true,
    ENABLE_PROMPT_LEAKAGE_GUARD: true,
    ENABLE_CHAIN_OF_THOUGHT_GUARD: true,
    ENABLE_SENSITIVE_DATA_GUARD: true,
    ENABLE_HALLUCINATED_CITATION_GUARD: true,
    ENABLE_MARKDOWN_GUARD: true,
    ENABLE_HTML_GUARD: true,
  };

  let service: OutputGuardService;

  beforeEach(() => {
    service = new OutputGuardService(mockConfig);
  });

  const createResponse = (content: string): ChatResponse => ({
    message: { role: "assistant", content },
    sources: []
  });

  it('should allow a valid response', async () => {
    const response = createResponse('This is a safe and valid response.');
    const result = await service.validateAndSanitize(response);
    expect(result.message.content).toBe('This is a safe and valid response.');
  });

  it('should reject an empty response', async () => {
    const response = createResponse('   ');
    await expect(service.validateAndSanitize(response)).rejects.toThrow(OutputGuardError);
  });

  it('should sanitize unsafe markdown', async () => {
    const response = createResponse('Click [here](javascript:alert(1)) for info.');
    const result = await service.validateAndSanitize(response);
    expect(result.message.content).toBe('Click here for info.');
  });

  it('should reject response with prompt leakage', async () => {
    const response = createResponse('My system prompt is secret.');
    await expect(service.validateAndSanitize(response)).rejects.toThrow(OutputGuardError);
  });
});
