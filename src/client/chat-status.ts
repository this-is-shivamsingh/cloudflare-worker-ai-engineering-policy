export const REVIEW_SUBMIT_LABEL = "Run review";
export const CHAT_PENDING_TEXT = "Copilot is responding…";

export function isChatPending(status: string, isStreaming: boolean, isRecovering: boolean): boolean {
  return status === "submitted" || status === "streaming" || isStreaming || isRecovering;
}
