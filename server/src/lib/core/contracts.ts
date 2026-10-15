import type { ChatResponse, GuardRequest, GuardResult } from "./models.js";

export interface InputGuard {
  getName(): string;
  evaluate(request: GuardRequest): Promise<GuardResult>;
}

export interface OutputGuard {
  getName(): string;
  evaluate(response: ChatResponse): Promise<GuardResult>;
}
