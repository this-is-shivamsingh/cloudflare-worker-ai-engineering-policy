import { RULE_CATALOG, RULE_ORDER } from "./catalog";
import {
  POLICY_VERSION,
  type PolicyFinding,
  type PolicyResult,
  type RuleId,
  type SourceLocation,
} from "./types";

interface DockerInstruction {
  keyword: string;
  arguments: string;
  raw: string;
  location: SourceLocation;
}

interface DockerStage {
  from: DockerInstruction;
  instructions: DockerInstruction[];
}

type DockerParseResult =
  | { status: "ok"; instructions: DockerInstruction[]; stages: DockerStage[] }
  | { status: "parse_error" | "unsupported"; message: string; location?: SourceLocation };

const SENSITIVE_NAME = /(?:^|_)(?:secret|token|password|passwd|api_key|private_key)(?:$|_)/i;

function lineLocation(startLine: number, endLine: number, endColumn = 1): SourceLocation {
  return { startLine, startColumn: 1, endLine, endColumn };
}

function parseDockerfile(source: string): DockerParseResult {
  const lines = source.split(/\r?\n/);
  let escape = "\\";
  let sawInstruction = false;
  const instructions: DockerInstruction[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const physical = lines[index];
    if (!sawInstruction) {
      const directive = physical.match(/^\s*#\s*escape\s*=\s*([\\`])\s*$/i);
      if (directive) {
        escape = directive[1];
        continue;
      }
    }
    if (/^\s*(?:#.*)?$/.test(physical)) continue;

    const startLine = index + 1;
    const parts: string[] = [];
    let current = physical;
    let continues: boolean;
    do {
      const trimmedEnd = current.replace(/\s+$/, "");
      continues = trimmedEnd.endsWith(escape);
      parts.push(continues ? trimmedEnd.slice(0, -1) : current);
      if (continues) {
        index += 1;
        if (index >= lines.length) {
          return {
            status: "parse_error",
            message: "Dockerfile ends with an unfinished continuation.",
            location: lineLocation(startLine, index, 1),
          };
        }
        current = lines[index];
        if (/^\s*#/.test(current)) current = "";
      }
    } while (continues);

    // Docker removes an escaped newline. Any intended separator is therefore
    // supplied by whitespace immediately before the escape or on the next line.
    const raw = parts.join("").trim();
    const match = raw.match(/^([A-Za-z]+)(?:\s+(.*))?$/s);
    if (!match) {
      return {
        status: "parse_error",
        message: "Dockerfile instruction is malformed.",
        location: lineLocation(startLine, index + 1, current.length + 1),
      };
    }
    const keyword = match[1].toUpperCase();
    const args = match[2] ?? "";
    const location = lineLocation(startLine, index + 1, current.length + 1);
    if (/(?:^|\s)<<-?\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?(?:\s|$)/.test(args)) {
      return {
        status: "unsupported",
        message: "Dockerfile heredoc syntax is not supported by this policy parser.",
        location,
      };
    }
    instructions.push({ keyword, arguments: args, raw, location });
    sawInstruction = true;
  }

  const stages: DockerStage[] = [];
  for (const instruction of instructions) {
    if (instruction.keyword === "FROM") {
      stages.push({ from: instruction, instructions: [] });
    } else if (stages.length > 0) {
      stages.at(-1)?.instructions.push(instruction);
    }
  }
  if (stages.length === 0) {
    return { status: "parse_error", message: "A Dockerfile must contain at least one FROM instruction." };
  }
  return { status: "ok", instructions, stages };
}

function finding(
  ruleId: RuleId,
  location: SourceLocation,
  evidence: string,
  overrides?: Partial<Pick<PolicyFinding, "severity" | "status" | "title" | "guidance">>,
  discriminator?: string,
): PolicyFinding {
  const rule = RULE_CATALOG[ruleId];
  return {
    findingId: `${ruleId}:${location.startLine}:${location.startColumn}${discriminator ? `:${discriminator}` : ""}`,
    ruleId,
    status: overrides?.status ?? "violation",
    severity: overrides?.severity ?? rule.severity,
    title: overrides?.title ?? rule.title,
    location,
    evidence,
    guidance: overrides?.guidance ?? rule.guidance,
  };
}

function userFinding(stage: DockerStage): PolicyFinding[] {
  const users = stage.instructions.filter((instruction) => instruction.keyword === "USER");
  const effective = users.at(-1);
  if (!effective) {
    return [finding("DF002", stage.from.location, "The final stage has no USER instruction.")];
  }
  const value = effective.arguments.trim();
  if (/\$(?:\{|[A-Za-z_])/.test(value)) {
    return [
      finding("DF002", effective.location, effective.raw, {
        status: "cannot_verify",
        severity: "info",
        title: "Final image user cannot be verified statically",
        guidance: "Resolve the variable to a known non-root user, or select an explicit non-root literal user.",
      }),
    ];
  }
  const user = value.split(":", 1)[0].toLowerCase();
  if (user === "root" || (/^\d+$/.test(user) && Number(user) === 0)) {
    return [finding("DF002", effective.location, effective.raw)];
  }
  return [];
}

function shellWords(value: string): string[] {
  const words: string[] = [];
  let word = "";
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) quote = undefined;
      else if (character === "\\" && quote === '"' && index + 1 < value.length) word += value[++index];
      else word += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (word) {
        words.push(word);
        word = "";
      }
    } else if (character === "\\" && index + 1 < value.length) {
      word += value[++index];
    } else {
      word += character;
    }
  }
  if (word) words.push(word);
  return words;
}

function assignments(instruction: DockerInstruction): Array<{ name: string; value: string }> {
  const words = shellWords(instruction.arguments);
  if (instruction.keyword === "ARG") {
    const assignment = words[0] ?? "";
    const separator = assignment.indexOf("=");
    if (separator < 0) return [];
    return [{ name: assignment.slice(0, separator), value: assignment.slice(separator + 1) }];
  }
  if (instruction.keyword !== "ENV" || words.length === 0) return [];
  if (words[0].includes("=")) {
    return words
      .filter((word) => word.includes("="))
      .map((word) => {
        const separator = word.indexOf("=");
        return { name: word.slice(0, separator), value: word.slice(separator + 1) };
      });
  }
  return [{ name: words[0], value: words.slice(1).join(" ") }];
}

function secretFindings(instructions: DockerInstruction[]): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const instruction of instructions) {
    for (const [assignmentIndex, assignment] of assignments(instruction).entries()) {
      const literal = assignment.value.trim();
      if (!SENSITIVE_NAME.test(assignment.name) || !literal || /\$(?:\{|[A-Za-z_])/.test(literal)) continue;
      findings.push(
        finding(
          "DF004",
          instruction.location,
          `${instruction.keyword} ${assignment.name}=<redacted non-empty literal>`,
          undefined,
          `${assignment.name.toLowerCase()}:${assignmentIndex + 1}`,
        ),
      );
    }
  }
  return findings;
}

export function analyzeDockerfile(source: string): PolicyResult {
  const parsed = parseDockerfile(source);
  if (parsed.status !== "ok") {
    return {
      policyVersion: POLICY_VERSION,
      inputType: "dockerfile",
      status: parsed.status,
      findings: [],
      errors: [{ message: parsed.message, location: parsed.location }],
    };
  }
  const findings = [...userFinding(parsed.stages.at(-1)!), ...secretFindings(parsed.instructions)];
  findings.sort(
    (left, right) =>
      RULE_ORDER[left.ruleId] - RULE_ORDER[right.ruleId] ||
      left.location.startLine - right.location.startLine ||
      left.location.startColumn - right.location.startColumn,
  );
  return { policyVersion: POLICY_VERSION, inputType: "dockerfile", status: "ok", findings };
}
