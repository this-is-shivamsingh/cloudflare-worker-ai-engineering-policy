import { MAX_CHAT_CHARACTERS, MAX_SOURCE_CHARACTERS } from "./shared";

const HIGH_CONFIDENCE_CREDENTIALS = [
  /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/
];

const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----|$)/gi;

const ASSIGNMENT =
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:\\.|[^"\\\r\n])*"?|'(?:\\.|[^'\\\r\n])*'?|[^\s#]+)/gi;
const SENSITIVE_IDENTIFIER = /(?:secret|token|password|passwd|api_key|private_key)/i;

export class InputSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputSafetyError";
  }
}

export function validateSource(source: string): void {
  if (!source.trim()) throw new InputSafetyError("Paste a workflow or Dockerfile to review.");
  if (source.length > MAX_SOURCE_CHARACTERS) {
    throw new InputSafetyError(`Input must be ${MAX_SOURCE_CHARACTERS.toLocaleString()} characters or fewer.`);
  }
  if (HIGH_CONFIDENCE_CREDENTIALS.some((pattern) => pattern.test(source))) {
    throw new InputSafetyError("A likely credential was detected. Remove it before reviewing this file.");
  }
}

export function validateChat(text: string): void {
  if (!text.trim()) throw new InputSafetyError("Ask a non-empty question.");
  if (text.length > MAX_CHAT_CHARACTERS) {
    throw new InputSafetyError(`Questions must be ${MAX_CHAT_CHARACTERS.toLocaleString()} characters or fewer.`);
  }
}

export function redactSensitiveAssignments(text: string): string {
  return text.replace(ASSIGNMENT, (assignment, name: string, value: string) =>
    SENSITIVE_IDENTIFIER.test(name) && !value.startsWith("$") ? `${name}=<redacted>` : assignment
  );
}

export function redactHighConfidenceCredentials(text: string): string {
  return text
    .replace(PRIVATE_KEY_BLOCK, "<redacted-private-key>")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "<redacted-credential>")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "<redacted-credential>");
}

export function redactChatText(text: string): string {
  return redactHighConfidenceCredentials(redactSensitiveAssignments(text));
}

export function containsHighConfidenceCredential(text: string): boolean {
  return HIGH_CONFIDENCE_CREDENTIALS.some((pattern) => pattern.test(text));
}
