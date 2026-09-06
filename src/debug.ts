import type { AiStatus } from "./shared";

type DebugEnv = { DEBUG_AGENT_EVENTS?: string };
type Direction = "inbound" | "outbound";

interface ReviewDebugEvent {
  direction: Direction;
  method: "review";
  chars?: number;
  inputType?: "github-actions" | "dockerfile" | "unknown";
  ruleIds?: string[];
  findingCount?: number;
  status?: "ok" | "parse_error" | "unsupported" | "error";
  aiStatus?: AiStatus;
  durationMs?: number;
  aiCalls?: number;
}

interface ChatDebugEvent {
  direction: Direction;
  method: "chat";
  chars?: number;
  status?: number | "error";
  durationMs?: number;
  chatCalls?: number;
}

function enabled(env: unknown): boolean {
  return import.meta.env.DEV && (env as DebugEnv | undefined)?.DEBUG_AGENT_EVENTS === "1";
}

function emit(env: unknown, event: ReviewDebugEvent | ChatDebugEvent): void {
  if (!enabled(env)) return;
  console.info("[agent-debug]", JSON.stringify({ event: "agent.rpc", ...event }));
}

export function debugReviewEvent(env: unknown, event: Omit<ReviewDebugEvent, "method">): void {
  emit(env, { method: "review", ...event });
}

export function debugChatEvent(env: unknown, event: Omit<ChatDebugEvent, "method">): void {
  emit(env, { method: "chat", ...event });
}
