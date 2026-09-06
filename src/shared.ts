import type { PolicyDiagnostic, PolicyFinding, PolicyInputType } from "./policy";

export const MAX_SOURCE_CHARACTERS = 20_000;
export const MAX_CHAT_CHARACTERS = 1_000;
export const MAX_PERSISTED_MESSAGES = 12;
export const MAX_REVIEW_AI_CALLS = 5;
export const MAX_CHAT_AI_CALLS = 10;
export const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export type AiStatus = "idle" | "loading" | "ready" | "unavailable";

export interface ReviewRequest {
  type: PolicyInputType;
  source: string;
}

export interface StoredReview {
  inputType: PolicyInputType;
  sourceHash: string;
  policyVersion: string;
  analysisStatus: "ok" | "parse_error" | "unsupported";
  findings: PolicyFinding[];
  errors: PolicyDiagnostic[];
  aiStatus: AiStatus;
  aiExplanation: string | null;
  reviewedAt: string;
}

export interface PolicyAgentState {
  review: StoredReview | null;
  aiCalls: number;
  chatCalls: number;
  generation: number;
}

export const INITIAL_AGENT_STATE: PolicyAgentState = {
  review: null,
  aiCalls: 0,
  chatCalls: 0,
  generation: 0
};
