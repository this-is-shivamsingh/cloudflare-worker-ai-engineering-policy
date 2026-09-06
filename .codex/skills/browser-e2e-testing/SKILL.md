---
name: browser-e2e-testing
description: Drive a safe end-to-end browser check of the Engineering Policy Copilot localhost UI. Use when validating Docker/local startup, GitHub Actions findings, a non-fallback Workers AI explanation, Agent chat, or the browser-to-Worker-to-AI path.
---

# Browser E2E Testing

Use the browser-control skill and its required locator discipline. Never inspect browser storage or read, print, copy, or record `.dev.vars`, credentials, full model responses, or raw Agent frames.

## Preconditions

1. Confirm `http://localhost:5173/` returns HTTP 200.
2. Confirm the container is running and startup logs contain no current authentication or TLS error.
3. Use a fresh local session when possible. Stop if the AI-call cap was already consumed; do not weaken the cap.

## Happy path

1. Open `http://localhost:5173/` and take a DOM snapshot.
2. Select the unique **Load safe example** button. The built-in example is intentionally unsafe but contains no secret.
3. Select the unique review button and wait until **Generating a bounded explanation…** disappears.
4. Assert the result contains `GHA001`, `GHA002`, and **Workers AI explanation**.
5. Assert **AI explanation is unavailable. Deterministic findings above remain valid.** is absent. Record only pass/fail and status metadata—not explanation text.
6. Fill the unique question textbox with `Why should the action use a full commit SHA?` and select the unique **Ask** button.
7. Wait for a new assistant response. Assert it is non-empty and no fallback error is shown; do not copy or log its text.

## Evidence and failure handling

- Correlate browser success with metadata-only Agent logs where enabled: review/chat direction, status, finding count/rule IDs, duration, and call counters.
- Treat browser HTTP/WS, deterministic findings, non-fallback AI state, and non-empty assistant chat as evidence of the complete path.
- Do not claim the internal Wrangler proxy URL or raw Workers AI request is visible in browser DevTools.
- On failure, report only the sanitized error class/message, failing hop, and next action. Stop after the same blocker occurs twice.
