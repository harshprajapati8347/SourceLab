import { OutputGuard } from '../../../core/contracts.js';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models.js';

export class MarkdownSanitizationGuard implements OutputGuard {
  getName(): string {
    return 'MarkdownSanitizationGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    let content = response.message.content;
    let modified = false;

    // Remove markdown links with javascript: urls, handling 1 level of nested parentheses e.g. alert(1)
    const jsLinkRegex = /\[([^\]]+)\]\(\s*javascript:[^()]*(?:\([^()]*\)[^()]*)*\)/gi;
    if (jsLinkRegex.test(content)) {
      content = content.replace(jsLinkRegex, '$1'); // keep the text, remove the link
      modified = true;
    }

    // Remove empty markdown links
    const emptyLinkRegex = /\[([^\]]*)\]\(\s*\)/g;
    if (emptyLinkRegex.test(content)) {
      content = content.replace(emptyLinkRegex, '$1');
      modified = true;
    }

    if (modified) {
      return {
        decision: GuardDecision.MODIFY,
        message: 'Sanitized unsafe or broken markdown links.',
        modifiedResponse: {
          ...response,
          message: {
            ...response.message,
            content,
          }
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
