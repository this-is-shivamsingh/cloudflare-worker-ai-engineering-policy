import { describe, expect, it } from "vitest";

import { CHAT_PENDING_TEXT, isChatPending, REVIEW_SUBMIT_LABEL } from "../../src/client/chat-status";

describe("chat UI status", () => {
  it("uses the corrected review label", () => {
    expect(REVIEW_SUBMIT_LABEL).toBe("Run review");
  });

  it("shows a pending lifecycle from submit until ready or error", () => {
    expect(CHAT_PENDING_TEXT).toBe("Copilot is responding…");
    expect(isChatPending("ready", false, false)).toBe(false);
    expect(isChatPending("submitted", false, false)).toBe(true);
    expect(isChatPending("streaming", false, false)).toBe(true);
    expect(isChatPending("ready", true, false)).toBe(true);
    expect(isChatPending("ready", false, true)).toBe(true);
    expect(isChatPending("error", false, false)).toBe(false);
  });
});
