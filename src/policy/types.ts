export const POLICY_VERSION = "2026-09-mvp1" as const;

export type PolicyInputType = "github-actions" | "dockerfile";
export type RuleId = "GHA001" | "GHA002" | "DF002" | "DF004";
export type FindingSeverity = "critical" | "high" | "info";
export type FindingStatus = "violation" | "cannot_verify";

export interface PolicyInput {
  type: PolicyInputType;
  source: string;
}

export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface PolicyFinding {
  findingId: string;
  ruleId: RuleId;
  status: FindingStatus;
  severity: FindingSeverity;
  title: string;
  location: SourceLocation;
  evidence: string;
  guidance: string;
}

export interface PolicyDiagnostic {
  message: string;
  location?: SourceLocation;
}

export interface SuccessfulPolicyResult {
  policyVersion: typeof POLICY_VERSION;
  inputType: PolicyInputType;
  status: "ok";
  findings: PolicyFinding[];
}

export interface FailedPolicyResult {
  policyVersion: typeof POLICY_VERSION;
  inputType: PolicyInputType;
  status: "parse_error" | "unsupported";
  findings: [];
  errors: PolicyDiagnostic[];
}

export type PolicyResult = SuccessfulPolicyResult | FailedPolicyResult;

