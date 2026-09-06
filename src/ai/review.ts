import type { PolicyFinding } from "../policy";
import { redactChatText } from "../safety";
import type { PolicyAgentState, StoredReview } from "../shared";

export function sanitizeFindings(findings: PolicyFinding[]): PolicyFinding[] {
  return findings.map((finding) => ({
    ...finding,
    evidence: redactChatText(finding.evidence).slice(0, 500)
  }));
}

export function completeAiReview(review: StoredReview, explanation: string): StoredReview {
  return {
    ...review,
    aiStatus: "ready",
    aiExplanation: explanation.slice(0, 6_000)
  };
}

export function markAiUnavailable(review: StoredReview): StoredReview {
  return { ...review, aiStatus: "unavailable", aiExplanation: null };
}

export function isCurrentReview(
  state: PolicyAgentState,
  generation: number,
  sourceHash: string
): boolean {
  return state.generation === generation && state.review?.sourceHash === sourceHash;
}
