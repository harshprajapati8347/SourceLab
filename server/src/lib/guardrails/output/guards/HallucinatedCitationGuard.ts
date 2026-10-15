import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class HallucinatedCitationGuard implements OutputGuard {
  getName(): string {
    return 'HallucinatedCitationGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const rawText = response.message.content;
    // Strip fenced code blocks and inline code snippets so code array indexing (e.g. items[0]) isn't flagged as citation tags
    const text = rawText.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
    const sourcesLength = response.sources?.length || 0;

    // Detect numeric citations like [1], [2], [1, 2]
    const multiCitationRegex = /\[([\d,\s]+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = multiCitationRegex.exec(text)) !== null) {
      const ids = (match[1] || '').split(',').map(s => s.trim()).filter(s => s.length > 0);
      
      for (const idStr of ids) {
        const id = Number(idStr);
        if (isNaN(id)) continue; // Handled by CitationGuard

        // Hallucinated if index is < 1 or > number of sources
        if (id < 1 || id > sourcesLength) {
          return {
            decision: GuardDecision.REJECT,
            message: `Hallucinated citation detected. Reference [${id}] does not correspond to any retrieved context.`,
          };
        }
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
