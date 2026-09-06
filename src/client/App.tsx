import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { EngineeringPolicyAgent } from "../agent";
import type { PolicyInputType } from "../policy";
import { MAX_CHAT_CHARACTERS, MAX_SOURCE_CHARACTERS, type PolicyAgentState } from "../shared";
import {
  createEmptyEditorSources,
  reviewForDisplay,
  SAMPLE_SOURCES,
  updateEditorSource
} from "./state";
import { CHAT_PENDING_TEXT, isChatPending, REVIEW_SUBMIT_LABEL } from "./chat-status";

const SESSION_KEY = "engineering-policy-copilot.session";

function createSessionId(): string {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored && /^[a-f0-9]{32}$/.test(stored)) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

function messageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
}

export function App() {
  const sessionId = useMemo(createSessionId, []);
  const [inputType, setInputType] = useState<PolicyInputType>("github-actions");
  const [sources, setSources] = useState(createEmptyEditorSources);
  const [question, setQuestion] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{ type: PolicyInputType; source: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearedThroughGeneration, setClearedThroughGeneration] = useState<number | null>(null);

  const agent = useAgent<EngineeringPolicyAgent, PolicyAgentState>({
    agent: "engineering-policy-agent",
    name: sessionId
  });
  const { messages, sendMessage, clearHistory, status, isStreaming, isRecovering } = useAgentChat({ agent });
  const source = sources[inputType];
  const review = reviewForDisplay(agent.state, clearedThroughGeneration);
  const chatPending = isChatPending(status, isStreaming, isRecovering);
  const resultIsStale = Boolean(
    submittedSnapshot && (submittedSnapshot.type !== inputType || submittedSnapshot.source !== source)
  );

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewing(true);
    setReviewError(null);
    try {
      const snapshot = { type: inputType, source };
      await agent.stub.review(snapshot);
      setSubmittedSnapshot(snapshot);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "The review could not be completed.");
    } finally {
      setReviewing(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    setQuestion("");
  }

  async function clearSession() {
    setClearing(true);
    setReviewError(null);
    try {
      const clearedGeneration = await agent.stub.clearSession();
      clearHistory();
      setClearedThroughGeneration(clearedGeneration);
      setSources(createEmptyEditorSources());
      setQuestion("");
      setSubmittedSnapshot(null);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Saved state could not be cleared.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Cloudflare Workers AI · deterministic policy checks</p>
        <h1>Engineering Policy Copilot</h1>
        <p className="lede">Review focused CI and container guardrails, then ask why each finding matters.</p>
      </header>

      <aside className="notice" role="note">
        <strong>Demo safety:</strong> Do not paste production secrets or confidential configuration. Session IDs behave like bearer credentials.
      </aside>

      <section className="workspace" aria-label="Policy review workspace">
        <form className="editor-panel" onSubmit={submitReview}>
          <div className="panel-heading">
            <div>
              <span className="step">01</span>
              <h2>Paste configuration</h2>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => setSources((current) => updateEditorSource(current, inputType, SAMPLE_SOURCES[inputType]))}
            >
              Load safe example
            </button>
          </div>

          {resultIsStale ? <p className="stale-notice">The editor has changed since this review. Run it again before using chat.</p> : null}

          <div className="segmented" aria-label="Configuration type">
            {(["github-actions", "dockerfile"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={inputType === type ? "active" : ""}
                aria-pressed={inputType === type}
                onClick={() => setInputType(type)}
              >
                {type === "github-actions" ? "GitHub Actions" : "Dockerfile"}
              </button>
            ))}
          </div>

          <textarea
            aria-label="Configuration source"
            value={source}
            maxLength={MAX_SOURCE_CHARACTERS}
            onChange={(event) =>
              setSources((current) => updateEditorSource(current, inputType, event.target.value))
            }
            placeholder={inputType === "github-actions" ? "Paste workflow YAML…" : "Paste Dockerfile…"}
            spellCheck={false}
          />
          <div className="editor-footer">
            <span>{source.length.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()}</span>
            <button className="primary" disabled={!source.trim() || reviewing || clearing} type="submit">
              {reviewing ? "Reviewing…" : REVIEW_SUBMIT_LABEL}
            </button>
          </div>
          {reviewError ? <p className="error" role="alert">{reviewError}</p> : null}
        </form>

        <section className="results-panel" aria-live="polite">
          <div className="panel-heading">
            <div>
              <span className="step">02</span>
              <h2>Deterministic findings</h2>
            </div>
            {review ? <span className="version">{review.policyVersion}</span> : null}
          </div>

          {!review ? (
            <div className="empty-state">Run a review to see precise, versioned findings here.</div>
          ) : review.analysisStatus !== "ok" ? (
            <div className="error-card">
              <strong>{review.analysisStatus === "unsupported" ? "Unsupported syntax" : "Could not parse input"}</strong>
              {review.errors.map((error, index) => <p key={index}>{error.message}</p>)}
            </div>
          ) : review.findings.length === 0 ? (
            <div className="success-card">No violations were found by this limited policy version. This is not a comprehensive security verdict.</div>
          ) : (
            <div className="findings-list">
              {review.findings.map((finding) => (
                <article className={`finding severity-${finding.severity}`} key={finding.findingId}>
                  <div className="finding-meta">
                    <span>{finding.ruleId}</span>
                    <span>{finding.severity}</span>
                    <span>line {finding.location.startLine}</span>
                  </div>
                  <h3>{finding.title}</h3>
                  <code>{finding.evidence}</code>
                  <p>{finding.guidance}</p>
                </article>
              ))}
            </div>
          )}

          {review?.analysisStatus === "ok" ? (
            <section className="ai-card">
              <div className="ai-heading"><span className="pulse" /> Workers AI explanation</div>
              {review.aiStatus === "loading" ? <p>Generating a bounded explanation…</p> : null}
              {review.aiStatus === "ready" ? <p className="ai-copy">{review.aiExplanation}</p> : null}
              {review.aiStatus === "unavailable" ? <p>AI explanation is unavailable. Deterministic findings above remain valid.</p> : null}
            </section>
          ) : null}
        </section>
      </section>

      <section className="chat-panel">
        <div className="panel-heading">
          <div>
            <span className="step">03</span>
            <h2>Ask about this review</h2>
          </div>
          <button className="text-button" type="button" disabled={clearing} onClick={clearSession}>
            {clearing ? "Clearing…" : "Clear saved session"}
          </button>
        </div>
        <div className="messages" aria-live="polite">
          {messages.length === 0 ? <p className="empty-state">Try: “Why is mutable action pinning risky?”</p> : null}
          {messages.map((message) => (
            <article className={`message message-${message.role}`} key={message.id}>
              <strong>{message.role === "user" ? "You" : "Copilot"}</strong>
              <p>{messageText(message)}</p>
            </article>
          ))}
          {chatPending ? <p className="status-copy" role="status">{isRecovering ? "Recovering the previous response…" : CHAT_PENDING_TEXT}</p> : null}
          {status === "error" ? <p className="error" role="alert">The AI response failed. Deterministic findings remain available.</p> : null}
        </div>
        <form className="chat-form" onSubmit={submitQuestion}>
          <input
            aria-label="Question about policy findings"
            value={question}
            maxLength={MAX_CHAT_CHARACTERS}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about a finding or remediation…"
          />
          <button className="primary" disabled={!review || resultIsStale || !question.trim() || chatPending || status !== "ready"} type="submit">
            {chatPending ? "Answering…" : "Ask"}
          </button>
        </form>
      </section>

      <footer>
        Four focused checks. Deterministic results stay authoritative when AI is unavailable.
      </footer>
    </main>
  );
}
