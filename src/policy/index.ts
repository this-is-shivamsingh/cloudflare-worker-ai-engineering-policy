import { analyzeDockerfile } from "./dockerfile";
import { analyzeGitHubActions } from "./github-actions";
import type { PolicyInput, PolicyResult } from "./types";

export { RULE_CATALOG, RULE_ORDER } from "./catalog";
export { POLICY_VERSION } from "./types";
export type * from "./types";

export function analyzePolicy(input: PolicyInput): PolicyResult {
  return input.type === "github-actions"
    ? analyzeGitHubActions(input.source)
    : analyzeDockerfile(input.source);
}

