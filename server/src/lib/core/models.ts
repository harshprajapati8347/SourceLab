export enum GuardDecision {
  ALLOW = "ALLOW",
  REJECT = "REJECT",
  MODIFY = "MODIFY",
}

export interface GuardRequest {
  query: string;
}

export interface ChatResponse {
  message: {
    role: string;
    content: string;
  };
  sources: unknown[];
}

export interface GuardResult {
  decision: GuardDecision;
  message?: string;
  modifiedRequest?: GuardRequest;
  modifiedResponse?: ChatResponse;
  details?: {
    pii?: unknown;
  };
}
