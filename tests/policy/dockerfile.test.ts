import { describe, expect, it } from "vitest";

import { analyzePolicy } from "../../src/policy";

function scan(source: string) {
  return analyzePolicy({ type: "dockerfile", source });
}

describe("Dockerfile policies", () => {
  it("uses the effective USER from the final stage", () => {
    const result = scan(`FROM node:22 AS build
USER root
RUN npm test
FROM gcr.io/distroless/nodejs
USER 10001
`);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.findings).toEqual([]);
  });

  it.each(["root", "0", "00", "000:0", "0:0", "root:root"])("flags a literal root final USER: %s", (user) => {
    const result = scan(`FROM alpine\nUSER ${user}\n`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ ruleId: "DF002", status: "violation", severity: "high" });
    expect(result.findings[0].location.startLine).toBe(2);
  });

  it("flags a missing final-stage USER at the final FROM", () => {
    const result = scan("FROM alpine AS build\nUSER 1000\nFROM scratch\nCOPY --from=build /app /app\n");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ ruleId: "DF002", evidence: "The final stage has no USER instruction." });
    expect(result.findings[0].location.startLine).toBe(3);
  });

  it("reports variable-valued USER as cannot verify, not a root violation", () => {
    const result = scan("FROM alpine\nARG APP_USER\nUSER ${APP_USER}\n");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ ruleId: "DF002", status: "cannot_verify", severity: "info" });
  });

  it("flags secret-like ARG and both ENV assignment forms while redacting evidence", () => {
    const result = scan(`FROM alpine
ARG API_TOKEN=top-secret
ENV PASSWORD="hunter two"
ENV API_KEY=abc NORMAL=value PRIVATE_KEY='key material'
USER 1000
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.startLine])).toEqual([
      ["DF004", 2],
      ["DF004", 3],
      ["DF004", 4],
      ["DF004", 4],
    ]);
    expect(result.findings.every((finding) => finding.severity === "critical")).toBe(true);
    expect(result.findings.map((finding) => finding.findingId)).toEqual([
      "DF004:2:1:api_token:1",
      "DF004:3:1:password:1",
      "DF004:4:1:api_key:1",
      "DF004:4:1:private_key:3",
    ]);
    expect(result.findings.map((finding) => finding.evidence).join(" ")).not.toContain("top-secret");
    expect(result.findings.map((finding) => finding.evidence).join(" ")).not.toContain("hunter two");
  });

  it("allows ARG without default, empty values, variable values, and ordinary names", () => {
    const result = scan(`FROM alpine
ARG TOKEN
ARG PASSWORD=
ENV API_KEY=$RUNTIME_KEY
ENV NORMAL literal
USER app
`);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.findings).toEqual([]);
  });

  it("supports default and backtick continuations and reports instruction spans", () => {
    const defaultEscape = scan(`FROM alpine
ENV API_\\
TOKEN=literal
USER app
`);
    expect(defaultEscape.status).toBe("ok");
    if (defaultEscape.status === "ok") {
      expect(defaultEscape.findings[0]).toMatchObject({ ruleId: "DF004" });
      expect(defaultEscape.findings[0].location).toMatchObject({ startLine: 2, endLine: 3 });
    }

    const backtickEscape = scan(`# escape=\`
FROM windows
ENV PASS\`
WORD=literal
USER ContainerUser
`);
    expect(backtickEscape.status).toBe("ok");
    if (backtickEscape.status === "ok") {
      expect(backtickEscape.findings[0]).toMatchObject({ ruleId: "DF004" });
      expect(backtickEscape.findings[0].location).toMatchObject({ startLine: 3, endLine: 4 });
    }
  });

  it("keeps rule ordering stable before source order", () => {
    const result = scan(`FROM alpine
ARG TOKEN=one
ENV SECRET=two
USER root
`);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["DF002", "DF004", "DF004"]);
  });

  it("returns Docker heredocs as explicitly unsupported", () => {
    const result = scan("FROM alpine\nRUN <<EOF\necho hello\nEOF\n");
    expect(result.status).toBe("unsupported");
    expect(result.findings).toEqual([]);
    if (result.status === "unsupported") {
      expect(result.errors[0].message).toContain("heredoc");
      expect(result.errors[0].location?.startLine).toBe(2);
    }
  });

  it("distinguishes malformed Dockerfiles from unsupported syntax", () => {
    const result = scan("ARG FOO=bar\n");
    expect(result.status).toBe("parse_error");
    expect(result.findings).toEqual([]);
  });
});
