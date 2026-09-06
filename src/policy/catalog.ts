import type { FindingSeverity, RuleId } from "./types";

export interface RuleDefinition {
  id: RuleId;
  title: string;
  severity: FindingSeverity;
  guidance: string;
}

export const RULE_CATALOG: Readonly<Record<RuleId, RuleDefinition>> = {
  GHA001: {
    id: "GHA001",
    title: "Action is not pinned to a full commit SHA",
    severity: "high",
    guidance:
      "Pin the action to a reviewed full 40-character commit SHA and retain the friendly release tag in a comment.",
  },
  GHA002: {
    id: "GHA002",
    title: "Workflow permissions are broader than necessary",
    severity: "high",
    guidance:
      "Declare contents: read where checkout needs it and grant only the minimum additional scopes at the job level.",
  },
  DF002: {
    id: "DF002",
    title: "Final image does not select a verified non-root user",
    severity: "high",
    guidance:
      "Create and select an explicit non-root user in the final stage.",
  },
  DF004: {
    id: "DF004",
    title: "Secret-like build variable has an embedded value",
    severity: "critical",
    guidance: "Use BuildKit secret mounts or inject the value at runtime instead of embedding it in the image build.",
  },
};

export const RULE_ORDER: Readonly<Record<RuleId, number>> = {
  GHA001: 0,
  GHA002: 1,
  DF002: 2,
  DF004: 3,
};

