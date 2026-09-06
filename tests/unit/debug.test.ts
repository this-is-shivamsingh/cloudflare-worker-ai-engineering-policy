import { afterEach, describe, expect, it, vi } from "vitest";

import { debugChatEvent, debugReviewEvent } from "../../src/debug";

afterEach(() => vi.restoreAllMocks());

describe("Agent debug events", () => {
  it("is silent unless explicitly enabled", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    debugReviewEvent({}, { direction: "inbound", chars: 42, inputType: "github-actions" });
    expect(info).not.toHaveBeenCalled();
  });

  it("emits only the explicitly typed safe metadata", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    debugReviewEvent({ DEBUG_AGENT_EVENTS: "1" }, {
      direction: "outbound",
      status: "ok",
      aiStatus: "ready",
      findingCount: 2,
      ruleIds: ["GHA001", "GHA002"],
      durationMs: 12,
      aiCalls: 1
    });
    debugChatEvent({ DEBUG_AGENT_EVENTS: "1" }, {
      direction: "inbound",
      chars: 17
    });

    const output = info.mock.calls.flat().join(" ");
    expect(output).toContain('"method":"review"');
    expect(output).toContain('"method":"chat"');
    expect(output).toContain('"ruleIds":["GHA001","GHA002"]');
    expect(output).not.toMatch(/source|prompt|modelText|session|authorization|credential/i);
  });
});
