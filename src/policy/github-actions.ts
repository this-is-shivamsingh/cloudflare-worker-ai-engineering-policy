import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node,
  type Pair,
  type YAMLMap,
} from "yaml";

import { RULE_CATALOG, RULE_ORDER } from "./catalog";
import {
  POLICY_VERSION,
  type PolicyDiagnostic,
  type PolicyFinding,
  type PolicyResult,
  type RuleId,
  type SourceLocation,
} from "./types";

const FULL_SHA = /^[0-9a-f]{40}$/i;

function pairFor(map: YAMLMap, key: string): Pair | undefined {
  return map.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
}

function nodeRange(node: Node | null | undefined, counter: LineCounter): SourceLocation {
  const range = node?.range;
  if (!range) {
    return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  }
  const start = counter.linePos(range[0]);
  const end = counter.linePos(Math.max(range[0], range[1] - 1));
  return {
    startLine: start.line,
    startColumn: start.col,
    endLine: end.line,
    endColumn: end.col + 1,
  };
}

function finding(
  ruleId: RuleId,
  location: SourceLocation,
  evidence: string,
  details?: Partial<Pick<PolicyFinding, "severity" | "status" | "title" | "guidance">>,
): PolicyFinding {
  const rule = RULE_CATALOG[ruleId];
  return {
    findingId: `${ruleId}:${location.startLine}:${location.startColumn}`,
    ruleId,
    status: details?.status ?? "violation",
    severity: details?.severity ?? rule.severity,
    title: details?.title ?? rule.title,
    location,
    evidence,
    guidance: details?.guidance ?? rule.guidance,
  };
}

function usesFindings(root: YAMLMap, counter: LineCounter): PolicyFinding[] {
  const jobs = pairFor(root, "jobs")?.value;
  if (!isMap(jobs)) return [];

  const findings: PolicyFinding[] = [];
  const inspectUses = (uses: unknown) => {
    if (!isScalar(uses) || typeof uses.value !== "string") return;
    const reference = uses.value.trim();
    if (reference.startsWith("./") || reference.startsWith("docker://")) return;
    const separator = reference.lastIndexOf("@");
    const revision = separator >= 0 ? reference.slice(separator + 1) : "";
    if (!FULL_SHA.test(revision)) {
      findings.push(finding("GHA001", nodeRange(uses, counter), `uses: ${reference}`));
    }
  };

  for (const jobPair of jobs.items) {
    if (!isMap(jobPair.value)) continue;
    inspectUses(pairFor(jobPair.value, "uses")?.value);
    const steps = pairFor(jobPair.value, "steps")?.value;
    if (!isSeq(steps)) continue;
    for (const step of steps.items) {
      if (!isMap(step)) continue;
      inspectUses(pairFor(step, "uses")?.value);
    }
  }
  return findings;
}

function permissionFindings(
  map: YAMLMap,
  counter: LineCounter,
  context: "root" | string,
  requireDeclaration: boolean,
): PolicyFinding[] {
  const permissionsPair = pairFor(map, "permissions");
  if (!permissionsPair) {
    if (!requireDeclaration) return [];
    return [finding("GHA002", nodeRange(map, counter), "Root permissions are absent.")];
  }

  const permissions = permissionsPair.value;
  if (isScalar(permissions)) {
    const value = String(permissions.value ?? "").toLowerCase();
    if (requireDeclaration && value === "") {
      return [finding("GHA002", nodeRange(permissions, counter), "Root permissions are absent.")];
    }
    if (value === "write-all") {
      return [
        finding(
          "GHA002",
          nodeRange(permissions, counter),
          `${context === "root" ? "Root" : `Job '${context}'`} permissions: write-all`,
        ),
      ];
    }
    return [];
  }
  if (!isMap(permissions)) return [];

  const findings: PolicyFinding[] = [];
  for (const scope of permissions.items) {
    if (!isScalar(scope.key) || !isScalar(scope.value)) continue;
    const key = String(scope.key.value);
    const value = String(scope.value.value ?? "").toLowerCase();
    if (value === "write" && key !== "id-token") {
      findings.push(
        finding(
          "GHA002",
          nodeRange(scope.value, counter),
          `${context === "root" ? "Root" : `Job '${context}'`} grants ${key}: write`,
        ),
      );
    }
  }
  return findings;
}

function permissionsFindings(root: YAMLMap, counter: LineCounter): PolicyFinding[] {
  const findings = permissionFindings(root, counter, "root", true);
  const jobs = pairFor(root, "jobs")?.value;
  if (!isMap(jobs)) return findings;
  for (const jobPair of jobs.items) {
    if (!isScalar(jobPair.key) || !isMap(jobPair.value)) continue;
    findings.push(...permissionFindings(jobPair.value, counter, String(jobPair.key.value), false));
  }
  return findings;
}

export function analyzeGitHubActions(source: string): PolicyResult {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    const errors: PolicyDiagnostic[] = document.errors.map((error) => {
      const position = error.pos?.[0];
      return {
        message: error.message,
        location:
          position === undefined
            ? undefined
            : nodeRange({ range: [position, position + 1, position + 1] } as Node, lineCounter),
      };
    });
    return {
      policyVersion: POLICY_VERSION,
      inputType: "github-actions",
      status: "parse_error",
      findings: [],
      errors,
    };
  }

  if (!isMap(document.contents)) {
    return {
      policyVersion: POLICY_VERSION,
      inputType: "github-actions",
      status: "parse_error",
      findings: [],
      errors: [{ message: "A GitHub Actions workflow must be a YAML mapping." }],
    };
  }

  const findings = [...usesFindings(document.contents, lineCounter), ...permissionsFindings(document.contents, lineCounter)];
  findings.sort(
    (left, right) =>
      RULE_ORDER[left.ruleId] - RULE_ORDER[right.ruleId] ||
      left.location.startLine - right.location.startLine ||
      left.location.startColumn - right.location.startColumn,
  );
  return { policyVersion: POLICY_VERSION, inputType: "github-actions", status: "ok", findings };
}
