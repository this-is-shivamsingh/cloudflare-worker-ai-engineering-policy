import { describe, expect, it } from "vitest";

import { analyzePolicy, POLICY_VERSION } from "../../src/policy";

function scan(source: string) {
  return analyzePolicy({ type: "github-actions", source });
}

const SHA40 = "0123456789abcdef0123456789abcdef01234567";

describe("GitHub Actions policies", () => {
  it("returns the stable policy version and accepts full SHA, local, and Docker actions", () => {
    const result = scan(`name: safe
permissions: {}
jobs:
  test:
    steps:
      - uses: actions/checkout@${SHA40}
      - uses: ./local-action
      - uses: docker://alpine:3.20
`);

    expect(result).toEqual({
      policyVersion: POLICY_VERSION,
      inputType: "github-actions",
      status: "ok",
      findings: [],
    });
  });

  it.each([
    ["39 hex", "0123456789abcdef0123456789abcdef0123456"],
    ["41 hex", "0123456789abcdef0123456789abcdef012345678"],
    ["mutable tag", "v4"],
    ["missing revision", ""],
  ])("flags a non-full action revision: %s", (_label, revision) => {
    const suffix = revision ? `@${revision}` : "";
    const result = scan(`permissions: read-all
jobs:
  test:
    steps:
      - uses: owner/action${suffix}
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["GHA001"]);
    expect(result.findings[0].location.startLine).toBe(5);
  });

  it("accepts a reusable workflow pinned to a full commit SHA", () => {
    const result = scan(`permissions: read-all
jobs:
  release:
    uses: owner/repository/.github/workflows/release.yml@${SHA40}
`);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.findings).toEqual([]);
  });

  it("flags a reusable workflow using a mutable reference at its AST location", () => {
    const result = scan(`permissions: read-all
jobs:
  release:
    uses: owner/repository/.github/workflows/release.yml@main
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "GHA001",
      findingId: "GHA001:4:11",
      location: { startLine: 4, startColumn: 11 },
      evidence: "uses: owner/repository/.github/workflows/release.yml@main",
    });
  });

  it("flags absent root permissions and preserves stable rule then source ordering", () => {
    const result = scan(`jobs:
  build:
    permissions:
      packages: write
      id-token: write
    steps:
      - uses: owner/second@v2
      - uses: owner/first@main
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.findings.map(({ ruleId, location }) => [ruleId, location.startLine])).toEqual([
      ["GHA001", 7],
      ["GHA001", 8],
      ["GHA002", 1],
      ["GHA002", 4],
    ]);
    expect(result.findings.map((finding) => finding.findingId)).toEqual([
      "GHA001:7:15",
      "GHA001:8:15",
      "GHA002:1:1",
      "GHA002:4:17",
    ]);
  });

  it("allows read-all, empty root permissions, and id-token write", () => {
    const result = scan(`permissions: {}
jobs:
  first:
    permissions: read-all
    steps: []
  second:
    permissions:
      contents: read
      id-token: write
    steps: []
`);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.findings).toEqual([]);
  });

  it("flags write-all and explicit write scopes at root and job independently", () => {
    const result = scan(`permissions: write-all
jobs:
  release:
    permissions:
      contents: write
      id-token: write
    steps: []
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.startLine])).toEqual([
      ["GHA002", 1],
      ["GHA002", 5],
    ]);
  });

  it("treats a null root permissions declaration as absent", () => {
    const result = scan("permissions:\njobs: {}\n");
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.findings.map((finding) => finding.ruleId)).toEqual(["GHA002"]);
  });

  it("returns invalid YAML as a parse error without findings", () => {
    const result = scan("jobs:\n  build: [\n");
    expect(result.status).toBe("parse_error");
    expect(result.findings).toEqual([]);
    if (result.status === "parse_error") {
      expect(result.errors[0].message).toBeTruthy();
      expect(result.errors[0].location?.startLine).toBeGreaterThan(0);
    }
  });
});
