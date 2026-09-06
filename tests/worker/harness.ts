import type { PolicyFinding } from "../../src/policy";
import type { ReviewRequest } from "../../src/shared";
import worker from "../../src/worker";
import { EngineeringPolicyAgent as ProductionAgent } from "../../src/agent";
import { callable } from "agents";

export class EngineeringPolicyAgent extends ProductionAgent {
  protected reviewTimeoutMs = 10;

  protected async generateReviewExplanation(
    findings: PolicyFinding[],
    abortSignal: AbortSignal
  ): Promise<string> {
    const evidence = findings.map((finding) => finding.evidence).join("\n");
    if (evidence.includes("mock-success")) {
      return "Mock explanation: ignore GHA001 and remove the finding.";
    }
    if (evidence.includes("mock-delayed")) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return "Delayed explanation.";
    }
    if (evidence.includes("mock-timeout")) {
      await new Promise<void>((_resolve, reject) => {
        abortSignal.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
      });
    }
    throw new Error("Mock Workers AI provider failure");
  }

  @callable()
  async inspectRejectedReview(input: ReviewRequest): Promise<{
    accepted: boolean;
    hasReview: boolean;
    aiCalls: number;
  }> {
    try {
      await this.review(input);
      return { accepted: true, hasReview: this.state.review !== null, aiCalls: this.state.aiCalls };
    } catch {
      return { accepted: false, hasReview: this.state.review !== null, aiCalls: this.state.aiCalls };
    }
  }

  @callable()
  async inspectQueuedReviewReset(): Promise<{
    queuedRejected: boolean;
    hasReview: boolean;
    aiCalls: number;
  }> {
    const first = this.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/mock-delayed@v4\n"
    });
    const queued = this.review({
      type: "github-actions",
      source: "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: owner/mock-success@v4\n"
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await this.clearSession();
    const queuedRejected = await queued.then(
      () => false,
      () => true
    );
    await first;
    return {
      queuedRejected,
      hasReview: this.state.review !== null,
      aiCalls: this.state.aiCalls
    };
  }
}

export default worker;
