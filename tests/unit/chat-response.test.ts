import { describe, expect, it } from "vitest";

import { completedChatResponse } from "../../src/chat-response";

describe("completed chat responses", () => {
  it("uses the completed provider text instead of appending overlapping stream chunks", async () => {
    const overlappingProviderChunks = [
      "GHA001 is",
      "GHA001 is a high-severity finding",
      "a high-severity finding with a safe remediation."
    ];
    const completedProviderText = "GHA001 is a high-severity finding with a safe remediation.";

    const response = completedChatResponse(completedProviderText);

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(completedProviderText);
    expect(completedProviderText).not.toContain(overlappingProviderChunks.join(""));
  });
});
