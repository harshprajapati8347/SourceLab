import { InputGuard } from '../../../core/contracts.js';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models.js';

export class PromptInjectionGuard implements InputGuard {
  private readonly patterns = [
    // 1. Direct prompt extraction requests (give/show/reveal/tell/print/display/output/repeat/share/write/copy/provide/state)
    /(?:give|show|reveal|tell|print|display|output|repeat|share|write|copy|provide|state) (?:me )?(?:your |the )?(?:system |developer |initial |hidden |base |internal )*(?:prompt|instructions|systemprompt|rules)/i,
    
    // 2. Questions asking to see/read/get the AI's system prompt or rules
    /what (?:is|are|was) (?:your|the) (?:system |developer |initial |hidden |base |internal )*(?:prompt|instructions|systemprompt|rules)/i,
    /(?:can|could) you (?:give|show|reveal|tell|print|display|share) (?:me )?(?:your|the) (?:system |developer )*(?:prompt|instructions)/i,

    // 3. Instruction overrides & disregard commands
    /(?:ignore|forget|override|bypass|disregard|drop|cancel) (?:all )?(?:previous |prior |developer |system )*(?:instructions|rules|prompts|directives|constraints)/i,

    // 4. Roleplay & Persona Override Jailbreaks
    /you are now (?:dan|unrestricted|unlocked|godmode|jailbroken|developer mode)/i,
    /act as (?:an unrestricted|a jailbroken|a rogue|an unaligned) (?:ai|llm|assistant)/i,
    /pretend (?:you have|there are) no (?:rules|restrictions|guardrails|filters)/i,
    /do anything now/i,
  ];

  getName(): string {
    return 'PromptInjectionGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential prompt injection detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
