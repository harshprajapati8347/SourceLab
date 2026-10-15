import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class CitationGuard implements OutputGuard {
  getName(): string {
    return 'CitationGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const rawText = response.message.content;
    // Strip fenced code blocks and inline code snippets so code array indexing (e.g. items[0]) isn't flagged as citation tags
    const text = rawText.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
    
    // Detect empty brackets (Missing citation ID)
    if (/\[\s*\]/.test(text)) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Missing citation IDs detected in response (e.g., []).',
      };
    }

    // Detect duplicate IDs in the same citation block like [1, 1]
    const multiCitationRegex = /\[([\d,\s]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = multiCitationRegex.exec(text)) !== null) {
      const ids = (match[1] || '').split(',').map(s => s.trim()).filter(s => s.length > 0);
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        return {
          decision: GuardDecision.REJECT,
          message: `Duplicate citation IDs detected in response block: ${match[0]}`,
        };
      }
      
      // Detect invalid non-numeric or malformed
      if (ids.some(id => isNaN(Number(id)))) {
        return {
          decision: GuardDecision.REJECT,
          message: `Invalid citation reference detected in response: ${match[0]}`,
        };
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
