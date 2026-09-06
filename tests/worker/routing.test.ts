import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { StoredReview } from "../../src/shared";
import { MAX_REVIEW_AI_CALLS } from "../../src/shared";
import type { UIMessage } from "ai";

const SESSION = "0123456789abcdef0123456789abcdef";

type PolicyStub = DurableObjectStub & {
  review(input: { type: "github-actions"; source: string }): Promise<StoredReview>;
  getReview(): Promise<StoredReview | null>;
  clearSession(): Promise<number>;
  getUsage(): Promise<{ aiCalls: number; chatCalls: number }>;
  saveMessages(messages: UIMessage[]): Promise<unknown>;
  inspectRejectedReview(input: { type: "github-actions"; source: string }): Promise<{
    accepted: boolean;
    hasReview: boolean;
    aiCalls: number;
  }>;
  inspectQueuedReviewReset(): Promise<{
    queuedRejected: boolean;
    hasReview: boolean;
    aiCalls: number;
  }>;
};

function stubFor(name: string): PolicyStub {
  const namespace = env.EngineeringPolicyAgent;
  return namespace.get(namespace.idFromName(name)) as unknown as PolicyStub;
}

describe("Agent routing", () => {
  it("rejects malformed session IDs before Agent routing", async () => {
    const response = await SELF.fetch("https://example.com/agents/engineering-policy-agent/short/get-messages");
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("routes a valid isolated session without invoking Workers AI", async () => {
    const response = await SELF.fetch(
      `https://example.com/agents/engineering-policy-agent/${SESSION}/get-messages`
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("persists deterministic review state across Durable Object stubs without AI", async () => {
    const first = stubFor(SESSION);

    const created = await first.review({ type: "github-actions", source: "jobs:\n  test: [\n" });
    expect(created.analysisStatus).toBe("parse_error");
    expect(created.aiStatus).toBe("idle");

    const second = stubFor(SESSION);
    const restored = await second.getReview();
    expect(restored?.sourceHash).toBe(created.sourceHash);
    expect(restored?.analysisStatus).toBe("parse_error");
  });

  it("preserves deterministic findings when the local AI binding is unavailable", async () => {
    const stub = stubFor("11111111111111111111111111111111");
    const review = await stub.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n"
    });
    expect(review.findings.map((finding) => finding.ruleId)).toEqual(["GHA001"]);
    expect(review.aiStatus).toBe("unavailable");
    expect((await stub.getReview())?.findings).toEqual(review.findings);
  });

  it("keeps deterministic findings authoritative when mocked AI succeeds", async () => {
    const stub = stubFor("99999999999999999999999999999999");
    const review = await stub.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/mock-success@v4\n"
    });
    expect(review.findings.map((finding) => finding.ruleId)).toEqual(["GHA001"]);
    expect(review.aiStatus).toBe("ready");
    expect(review.aiExplanation).toContain("remove the finding");
    expect((await stub.getReview())?.findings).toEqual(review.findings);
  });

  it("falls back after the bounded review timeout", async () => {
    const stub = stubFor("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const review = await stub.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/mock-timeout@v4\n"
    });
    expect(review.findings.map((finding) => finding.ruleId)).toEqual(["GHA001"]);
    expect(review.aiStatus).toBe("unavailable");
    expect(await stub.getUsage()).toEqual({ aiCalls: 1, chatCalls: 0 });
  });

  it("does not restore a stale delayed completion after reset", async () => {
    const stub = stubFor("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    const pendingReview = stub.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/mock-delayed@v4\n"
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await stub.clearSession();
    await pendingReview;
    expect(await stub.getReview()).toBeNull();
    expect(await stub.getUsage()).toEqual({ aiCalls: 1, chatCalls: 0 });
  });

  it("cancels reviews queued before reset so they cannot repopulate state", async () => {
    const stub = stubFor("cccccccccccccccccccccccccccccccc");
    expect(await stub.inspectQueuedReviewReset()).toEqual({
      queuedRejected: true,
      hasReview: false,
      aiCalls: 1
    });
  });

  it("enforces the per-session review inference limit", async () => {
    const stub = stubFor("66666666666666666666666666666666");
    const input = {
      type: "github-actions" as const,
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n"
    };

    const reviews = await Promise.all(
      Array.from({ length: MAX_REVIEW_AI_CALLS + 1 }, () => stub.review(input))
    );
    for (const review of reviews) {
      expect(review.findings.map((finding) => finding.ruleId)).toEqual(["GHA001"]);
      expect(review.aiStatus).toBe("unavailable");
    }

    expect(await stub.getUsage()).toEqual({ aiCalls: MAX_REVIEW_AI_CALLS, chatCalls: 0 });
  });

  it("redacts finding evidence before persistence and isolates session state", async () => {
    const source = "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/action@API_TOKEN=secret-value\n";
    const first = stubFor("22222222222222222222222222222222");
    await first.review({ type: "github-actions", source });
    const persisted = await first.getReview();
    expect(JSON.stringify(persisted)).not.toContain("secret-value");
    expect(persisted?.findings[0].evidence).toContain("<redacted>");

    const isolated = await stubFor("33333333333333333333333333333333").getReview();
    expect(isolated).toBeNull();
  });

  it("rejects credential-bearing source before state or inference changes", async () => {
    const stub = stubFor("77777777777777777777777777777777");
    const result = await stub.inspectRejectedReview({
      type: "github-actions",
      source: "permissions: {}\n# AKIAIOSFODNN7EXAMPLE\njobs: {}\n"
    });
    expect(result).toEqual({ accepted: false, hasReview: false, aiCalls: 0 });
  });

  it("clears persisted review and chat state without restoring inference quota", async () => {
    const stub = stubFor("44444444444444444444444444444444");
    const input = {
      type: "github-actions" as const,
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n"
    };
    await stub.review(input);
    expect(await stub.getReview()).not.toBeNull();
    expect((await stub.getUsage()).aiCalls).toBe(1);
    const message: UIMessage = {
      id: "clear-session-message",
      role: "user",
      parts: [{ type: "text", text: "Explain the finding." }]
    };
    await stub.saveMessages([message]).catch(() => undefined);

    const clearedGeneration = await stub.clearSession();
    expect(clearedGeneration).toBeGreaterThan(0);
    expect(await stub.getReview()).toBeNull();
    const clearedMessages = await SELF.fetch(
      "https://example.com/agents/engineering-policy-agent/44444444444444444444444444444444/get-messages"
    );
    expect(await clearedMessages.json()).toEqual([]);
    expect((await stub.getUsage()).aiCalls).toBe(1);
    await stub.review(input);
    expect((await stub.getUsage()).aiCalls).toBe(2);
  });

  it("enforces the per-session follow-up inference limit", async () => {
    const stub = stubFor("88888888888888888888888888888888");
    await stub.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n"
    });

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const message: UIMessage = {
        id: `question-${attempt}`,
        role: "user",
        parts: [{ type: "text", text: `Explain finding ${attempt}.` }]
      };
      await stub.saveMessages([message]).catch(() => undefined);
    }

    expect(await stub.getUsage()).toEqual({ aiCalls: 1, chatCalls: 10 });
  });

  it("sanitizes private-key chat content before durable message restoration", async () => {
    const name = "55555555555555555555555555555555";
    const stub = stubFor(name);
    const message: UIMessage = {
      id: "secret-message",
      role: "user",
      parts: [
        {
          type: "text",
          text: "-----BEGIN PRIVATE KEY-----\nsensitive-body\n-----END PRIVATE KEY-----"
        }
      ]
    };

    await stub.saveMessages([message]).catch(() => undefined);
    const response = await SELF.fetch(
      `https://example.com/agents/engineering-policy-agent/${name}/get-messages`
    );
    const body = await response.text();
    expect(body).not.toContain("sensitive-body");
    expect(body).not.toContain("END PRIVATE KEY");
    expect(body).toContain("redacted-private-key");

    await stub.clearSession();
    const cleared = await SELF.fetch(
      `https://example.com/agents/engineering-policy-agent/${name}/get-messages`
    );
    expect(await cleared.json()).toEqual([]);
  });
});
