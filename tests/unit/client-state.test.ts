import { describe, expect, it } from "vitest";

import {
  createEmptyEditorSources,
  reviewForDisplay,
  SAMPLE_SOURCES,
  updateEditorSource
} from "../../src/client/state";
import type { PolicyAgentState, StoredReview } from "../../src/shared";

function storedReview(): StoredReview {
  return {
    inputType: "github-actions",
    sourceHash: "hash",
    policyVersion: "test",
    analysisStatus: "ok",
    findings: [],
    errors: [],
    aiStatus: "ready",
    aiExplanation: "Explanation",
    reviewedAt: "2026-09-06T00:00:00.000Z"
  };
}

describe("client session state", () => {
  it("keeps editor drafts and sample snippets independent by input type", () => {
    let sources = createEmptyEditorSources();
    sources = updateEditorSource(sources, "github-actions", "custom workflow");
    sources = updateEditorSource(sources, "dockerfile", "custom Dockerfile");

    expect(sources["github-actions"]).toBe("custom workflow");
    expect(sources.dockerfile).toBe("custom Dockerfile");

    sources = updateEditorSource(sources, "github-actions", SAMPLE_SOURCES["github-actions"]);
    expect(sources["github-actions"]).toContain("permissions: write-all");
    expect(sources.dockerfile).toBe("custom Dockerfile");

    sources = updateEditorSource(sources, "dockerfile", SAMPLE_SOURCES.dockerfile);
    expect(sources.dockerfile).toContain("FROM node:22-alpine");
    expect(sources["github-actions"]).not.toContain("FROM node:22-alpine");

    sources = createEmptyEditorSources();
    expect(sources).toEqual({ "github-actions": "", dockerfile: "" });
  });

  it("hides a synchronized pre-clear review until a newer review generation exists", () => {
    const review = storedReview();
    const staleState: PolicyAgentState = { review, aiCalls: 1, chatCalls: 1, generation: 4 };
    const clearedState: PolicyAgentState = { ...staleState, review: null, generation: 5 };
    const nextState: PolicyAgentState = { ...staleState, generation: 6 };

    expect(reviewForDisplay(staleState, 5)).toBeNull();
    expect(reviewForDisplay(clearedState, 5)).toBeNull();
    expect(reviewForDisplay(nextState, 5)).toBe(review);
  });
});
