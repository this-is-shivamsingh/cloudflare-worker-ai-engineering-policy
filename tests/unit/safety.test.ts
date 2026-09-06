import { describe, expect, it } from "vitest";

import {
  containsHighConfidenceCredential,
  InputSafetyError,
  redactChatText,
  redactSensitiveAssignments,
  validateChat,
  validateSource
} from "../../src/safety";

describe("input safety", () => {
  it("rejects empty and oversized review input", () => {
    expect(() => validateSource("  ")).toThrow(InputSafetyError);
    expect(() => validateSource("x".repeat(20_001))).toThrow(InputSafetyError);
  });

  it("rejects high-confidence credentials", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----";
    expect(() => validateSource(key)).toThrow(/credential/i);
    expect(containsHighConfidenceCredential("AKIAIOSFODNN7EXAMPLE")).toBe(true);
  });

  it("redacts sensitive assignments without hiding the key", () => {
    expect(redactSensitiveAssignments("API_TOKEN=demo-value normal=yes")).toBe(
      "API_TOKEN=<redacted> normal=yes"
    );
  });

  it("redacts complete quoted and unterminated sensitive assignments", () => {
    expect(redactChatText('API_TOKEN="first second" next')).toBe("API_TOKEN=<redacted> next");
    expect(redactChatText("PASSWORD='first second' next")).toBe("PASSWORD=<redacted> next");
    expect(redactChatText('API_TOKEN="first second')).toBe("API_TOKEN=<redacted>");
  });

  it("redacts high-confidence credentials from persisted chat text", () => {
    expect(redactChatText("token AKIAIOSFODNN7EXAMPLE")).toBe("token <redacted-credential>");
    expect(redactChatText("-----BEGIN PRIVATE KEY-----\nvalue")).not.toContain("BEGIN PRIVATE KEY");
    const pem = "-----BEGIN PRIVATE KEY-----\nsensitive-body\n-----END PRIVATE KEY-----";
    expect(redactChatText(pem)).toBe("<redacted-private-key>");
    expect(redactChatText("-----BEGIN ENCRYPTED PRIVATE KEY-----\nbody\n-----END ENCRYPTED PRIVATE KEY-----"))
      .toBe("<redacted-private-key>");
    expect(redactChatText("-----BEGIN DSA PRIVATE KEY-----\nbody\n-----END DSA PRIVATE KEY-----"))
      .toBe("<redacted-private-key>");
    expect(redactChatText(pem)).not.toContain("sensitive-body");
    expect(redactChatText(pem)).not.toContain("END PRIVATE KEY");
  });

  it("bounds chat messages", () => {
    expect(() => validateChat("")).toThrow(InputSafetyError);
    expect(() => validateChat("x".repeat(1_001))).toThrow(InputSafetyError);
    expect(() => validateChat("Why does this finding matter?")).not.toThrow();
  });
});
