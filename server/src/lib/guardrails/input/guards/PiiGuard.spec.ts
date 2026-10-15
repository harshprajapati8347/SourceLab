/// <reference types="vitest/globals" />
import { PiiGuard, type DetectedItem } from './PiiGuard';
import { GuardDecision } from '../../../core/models';

describe('PiiGuard', () => {
  const guard = new PiiGuard();

  const evaluateAndExpectRejection = async (query: string, expectedType: string, expectedValue?: string) => {
    const result = await guard.evaluate({ query });
    expect(result.decision).toBe(GuardDecision.REJECT);
    expect(result.details).toBeDefined();
    expect(result.details?.pii).toBeDefined();
    expect((result?.details?.pii as DetectedItem[])?.length).toBeGreaterThan(0);
    
    const pii = result.details?.pii as DetectedItem[];
    const item = pii.find((p) => p.type === expectedType);
    expect(item).toBeDefined();
    
    if (expectedValue) {
      expect(item?.value).toBe(expectedValue);
    }
  };

  describe('Valid Cases', () => {
    it('should return ALLOW for normal text', async () => {
      const result = await guard.evaluate({ query: 'What is your name?' });
      expect(result.decision).toBe(GuardDecision.ALLOW);
    });
  });

  describe('Emails', () => {
    it('should return REJECT for email addresses', async () => {
      await evaluateAndExpectRejection('My email is test@example.com', 'Email', 'test@example.com');
      await evaluateAndExpectRejection('Contact test.user+123@gmail.com', 'Email', 'test.user+123@gmail.com');
    });
  });

  describe('Phone Numbers', () => {
    it('should return REJECT for phone numbers', async () => {
      await evaluateAndExpectRejection('Call me at +91 9876543210', 'Phone');
      await evaluateAndExpectRejection('Call me at +1 555-123-4567', 'Phone');
    });
  });

  describe('Credit Cards (Luhn)', () => {
    it('should return REJECT for valid credit card (Luhn)', async () => {
      // 4242 4242 4242 4242 is a test stripe number that passes luhn
      await evaluateAndExpectRejection('Card: 4242 4242 4242 4242', 'Credit Card', '4242 4242 4242 4242');
    });

    it('should return ALLOW for mathematically invalid credit card (Fails Luhn)', async () => {
      // Structurally valid but fails Luhn
      const result = await guard.evaluate({ query: 'Card: 4242 4242 4242 4243' });
      expect(result.decision).toBe(GuardDecision.ALLOW);
    });
  });

  describe('IP Addresses', () => {
    it('should return REJECT for IPv4', async () => {
      await evaluateAndExpectRejection('Connect to 192.168.1.1', 'IPv4', '192.168.1.1');
    });

    it('should return REJECT for IPv6', async () => {
      await evaluateAndExpectRejection('IP: 2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'IPv6');
    });
  });

  describe('UUIDs', () => {
    it('should return REJECT for UUIDs', async () => {
      await evaluateAndExpectRejection('ID: 123e4567-e89b-12d3-a456-426614174000', 'UUID');
    });
  });

  describe('URLs', () => {
    it('should return REJECT for HTTP/HTTPS URLs', async () => {
      await evaluateAndExpectRejection('Visit https://example.com/test?q=1', 'URL');
      await evaluateAndExpectRejection('Visit http://localhost:3000', 'URL');
    });
  });

  describe('JWT', () => {
    it('should return REJECT for JWT Tokens', async () => {
      await evaluateAndExpectRejection('Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', 'JWT');
    });
  });

  describe('API Keys', () => {
    it('should return REJECT for OpenAI keys', async () => {
      await evaluateAndExpectRejection('Key: sk-123456789012345678901234567890123456789012345678', 'API Key');
    });
    
    it('should return REJECT for GitHub keys', async () => {
      await evaluateAndExpectRejection('Key: ghp_123456789012345678901234567890123456', 'API Key');
    });
  });

  describe('Private Keys', () => {
    it('should return REJECT for PEM private keys', async () => {
      const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
      await evaluateAndExpectRejection(`Here is my key: ${key}`, 'Private Key', key);
    });
  });

  describe('India Specific', () => {
    it('should return REJECT for PAN', async () => {
      await evaluateAndExpectRejection('PAN is ABCDE1234F', 'PAN', 'ABCDE1234F');
    });

    it('should return REJECT for valid Aadhaar (Verhoeff)', async () => {
      // 1234 5678 9010 passes Verhoeff checksum.
      // We format it with spaces to avoid accidental phone number match.
      await evaluateAndExpectRejection('Aadhaar is 1234 5678 9010', 'Aadhaar', '1234 5678 9010');
    });

    it('should return REJECT for GSTIN', async () => {
      await evaluateAndExpectRejection('GSTIN: 22AAAAA0000A1Z5', 'GSTIN', '22AAAAA0000A1Z5');
    });

    it('should return REJECT for IFSC', async () => {
      await evaluateAndExpectRejection('IFSC: SBIN0001234', 'IFSC', 'SBIN0001234');
    });
  });

  describe('Edge Cases', () => {
    it('should detect multiple different items in a single query', async () => {
      const query = 'Email is test@test.com and PAN is ABCDE1234F';
      const result = await guard.evaluate({ query });
      
      expect(result.decision).toBe(GuardDecision.REJECT);
      
      const pii = result.details?.pii as DetectedItem[];
      expect(pii.length).toBe(2);
      
      expect(pii.some(p => p.type === 'Email')).toBe(true);
      expect(pii.some(p => p.type === 'PAN')).toBe(true);
    });

    it('should provide correct start and end indexes', async () => {
      const query = 'Here: ABCDE1234F.';
      const result = await guard.evaluate({ query });
      
      expect(result.decision).toBe(GuardDecision.REJECT);
      const pii = result.details?.pii as DetectedItem[];
      
      expect(pii[0]!.startIndex).toBe(6);
      expect(pii[0]!.endIndex).toBe(16);
      expect(query.substring(pii[0]!.startIndex, pii[0]!.endIndex)).toBe('ABCDE1234F');
    });
  });
});
