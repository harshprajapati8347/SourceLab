export interface DetectedItem {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
}

export class PiiDetector {
  // Common PII and Sensitive Data Regex Patterns
  private readonly patterns: Array<{ type: string; regex: RegExp; validator?: (val: string) => boolean }> = [
    {
      type: 'Email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    },
    {
      type: 'Phone',
      // Matches international formats +1 555-123-4567, and Indian formats +91 9876543210
      regex: /\b(?:\+?\d{1,3})?[-. (]*\d{3}[-. )]*\d{3}[-. ]*\d{4}\b/g,
    },
    {
      type: 'Credit Card',
      // Matches 13-19 digits, allowing dashes and spaces
      regex: /\b(?:\d[ -]*?){13,19}\b/g,
      validator: this.validateLuhn,
    },
    {
      type: 'IPv4',
      regex: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    },
    {
      type: 'IPv6',
      regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:|\b::(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{1,4}\b/g,
    },
    {
      type: 'UUID',
      regex: /\b[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}\b/g,
    },
    {
      type: 'JWT',
      regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    },
    {
      type: 'API Key',
      regex: /\b(?:sk-[a-zA-Z0-9]{48}|gh[pousr]_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}|Bearer\s+[a-zA-Z0-9\-._~+/]+=*|AIza[0-9A-Za-z-_]{35})\b/g,
    },
    {
      type: 'Private Key',
      regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
    },
    {
      type: 'PAN',
      regex: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
    },
    {
      type: 'Aadhaar',
      // Matches 12 digits, can have spaces in between
      regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
      validator: this.validateVerhoeff,
    },
    {
      type: 'GSTIN',
      regex: /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g,
    },
    {
      type: 'IFSC',
      regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    }
  ];

  detect(text: string): DetectedItem[] {
    const detectedItems: DetectedItem[] = [];

    for (const { type, regex, validator } of this.patterns) {
      // Reset lastIndex because we are reusing global regexes
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const matchedValue = match[0];
        
        if (validator && !validator.call(this, matchedValue)) {
          continue;
        }

        detectedItems.push({
          type,
          value: matchedValue,
          startIndex: match.index,
          endIndex: match.index + matchedValue.length,
        });
      }
    }

    return detectedItems;
  }

  /**
   * Luhn Algorithm for credit card validation.
   */
  private validateLuhn(ccNumber: string): boolean {
    const digits = ccNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isSecond = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits.charAt(i), 10);
      if (isSecond) {
        d = d * 2;
        if (d > 9) {
          d -= 9;
        }
      }
      sum += d;
      isSecond = !isSecond;
    }
    return sum % 10 === 0;
  }

  /**
   * Verhoeff Algorithm for Aadhaar validation.
   */
  private validateVerhoeff(aadhaar: string): boolean {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) return false;

    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];
    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];
    let c = 0;
    const array = digits.split('').map(Number).reverse();

    for (let i = 0; i < array.length; i++) {
      c = d[c]![p[i % 8]![array[i] as number] as number] as number;
    }
    return c === 0;
  }
}
