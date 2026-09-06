# Engineering Policy Copilot — Reviewed Implementation Plan

Status: approved for local Phase 2 implementation on 2026-09-05. This document preserves the reviewed plan; README and verification evidence describe the implemented state.

## Outcome and success criteria

Build a public Cloudflare-hosted developer tool that:

1. Accepts a pasted GitHub Actions workflow or Dockerfile through a chat-oriented interface.
2. Produces reproducible findings for four committed rules with rule ID, severity, location, evidence, and deterministic remediation guidance.
3. Uses Llama 3.3 on Workers AI to explain only those findings and suggest bounded remediation; a full-file corrected draft is stretch scope.
4. Supports contextual follow-up questions. A finding-scoped exception request that is clearly **requested, not approved** is stretch scope after the full core flow passes.
5. Restores messages and the latest review after reload through a SQLite-backed Agent/Durable Object; stretch exception state must also restore if implemented.
6. Still shows deterministic findings if inference fails.
7. Passes deterministic unit tests, Worker/Agent integration tests, build checks, and public-demo smoke tests.
8. Includes a public GitHub repository, public demo URL, setup documentation, and chronological AI prompt history.

Target: 1–2 focused days. Day one delivers the vertical slice with `GHA001` and `DF002`; day two adds `GHA002` and `DF004`. The other four drafted rules, full-file correction, and exception UX are stretch work only after the core is deployed and verified.

## Requirements and non-goals

### Requirements

- One-page chat/review UI with explicit `GitHub Actions` or `Dockerfile` selection.
- Deterministic policy engine as the only authority for violations and severity.
- LLM explanations, bounded remediation suggestions, and grounded follow-up chat.
- Persistent anonymous review and chat state.
- Safe examples, honest limitations, graceful AI degradation, and a public `workers.dev` demo.

### Non-goals

- Authentication, teams, RBAC, or a real exception-approval workflow.
- GitHub OAuth, repository cloning, webhooks, private repositories, PR comments, or automatic commits.
- Voice input, RAG/vector search, autonomous remediation, runtime multi-agent behavior, or MCP inside the application.
- Workflows, Pages, D1, KV, or a second application deployment.
- Full-file correction and exception requests in the committed baseline; these are timeboxed stretch features.
- Comprehensive security scanning or proof that LLM-generated output is correct.

## Primary user flow

1. The user opens the demo, selects a supported file type, and pastes content or loads a safe example.
2. The client shows supported rules, size count, and a warning not to paste credentials.
3. The Agent validates size/type/syntax, runs deterministic rules, and persists the review.
4. Findings render immediately in stable severity/order with source locations and deterministic guidance.
5. Workers AI receives rule metadata, findings, and only necessary redacted snippets. Its explanations and bounded remediation suggestions render separately; a full-file corrected draft is stretch scope and must be clearly labeled.
6. If AI fails, the deterministic result remains usable and the UI offers a bounded retry.
7. The user can ask a contextual question. If stretch scope is reached, the user may submit a rationale against one finding; the system stores only `requested` and never implies approval.
8. Reloading with the opaque locally stored Agent instance ID restores the session. “Delete and reset” must clear server-side persisted state before creating a new identifier; merely abandoning the identifier is insufficient.

## Deterministic rule contracts and cut line

All results include `policyVersion: "2026-09-mvp1"`. Invalid syntax produces a parse error, never partial findings.

### GitHub Actions

| ID | Severity | Detection | Guidance |
|---|---:|---|---|
| `GHA001` | High | **Day 1:** Non-local `uses:` is not pinned to a full 40-hex commit SHA. Exempt `./...` and `docker://...`. | Pin to a reviewed full SHA and retain the friendly release tag in a comment. |
| `GHA002` | High | **Day 2 baseline:** Root permissions are absent or `write-all`; or explicit root/job scopes grant `write` other than `id-token: write`. `permissions: {}` is allowed; a job override is evaluated independently. | Declare `contents: read` where checkout needs it and add only minimum job-level scopes. |
| `GHA003` | High | **Stretch:** `run:` directly interpolates an enumerated untrusted event expression. Exact supported expression paths and bracket/dot forms must be frozen in fixtures before implementation. | Move the expression to `env` and quote the shell variable. |
| `GHA004` | Critical | **Stretch:** `pull_request_target` combines with an enumerated checkout-head/ref form. Exact checkout action matching and ref forms must be frozen in fixtures first. | Separate privileged metadata work from untrusted-code testing. |

Use the `yaml` package with source ranges/line counting; do not derive locations through regex string search.

### Dockerfile

| ID | Severity | Detection | Guidance |
|---|---:|---|---|
| `DF001` | High | **Stretch:** External `FROM` is not pinned to a 64-hex SHA-256 digest; exempt `scratch`. | Pin a reviewed base-image digest, optionally retaining a readable tag. |
| `DF002` | High | **Day 1:** The final stage has no effective explicit non-root literal `USER`, or uses `root`, `0`, or `0:0`. Variable-based users return `cannot_verify`, not a confident violation. | Create and select an explicit non-root user in the final stage. |
| `DF003` | Critical | **Stretch:** Shell-form `RUN` pipes `curl`/`wget` output into `sh`/`bash`. JSON forms, `sh -c`, escape directives, and heredocs require explicit fixture decisions before implementation. | Download, verify checksum/signature, then execute separately. |
| `DF004` | Critical | **Day 2 baseline:** `ARG` or `ENV` assigns a non-empty literal to a name matching secret/token/password/passwd/api_key/private_key. Support both `ENV key=value` and documented space form; `ARG NAME` without default does not trigger. | Use BuildKit secret mounts or runtime secret injection. |

Use a documented line-oriented parser that handles the exact fixture corpus for comments, the active escape directive, continuations, stages, instruction spans, and supported `ENV` forms. Unsupported/heredoc syntax must return `unsupported` or be documented as not analyzed; do not call arbitrary input “invalid Dockerfile.” Each baseline rule gets a written input/output/edge-case contract before its implementation prompt.

## Architecture and implementation details

```text
React/Vite SPA via Workers Static Assets
                  |
          useAgentChat / WebSocket
                  v
      EngineeringPolicyAgent (AIChatAgent)
        ├── input validation/redaction
        ├── deterministic policy tools
        ├── review/chat coordinator
        ├── Workers AI binding
        └── SQLite-backed Durable Object state
```

One Worker exports `EngineeringPolicyAgent` and calls `routeAgentRequest()` for agent paths while Workers Static Assets serves the SPA. Configure worker-first routing explicitly for `/agents/*` (planned Wrangler assets setting: `run_worker_first: ["/agents/*"]`, verified against the installed Wrangler schema). One cryptographically random Agent instance name with at least 128 bits of entropy is stored in browser local storage; route format/length is validated and no personal identifier is used. Compatible SDK/Wrangler versions and the compatibility date are pinned only after manifest inspection during the platform spike.

Suggested implementation boundaries:

```text
src/worker.ts                    exports Agent; routing/static fallback
src/agent.ts                     review/chat orchestration and persistent state
src/policy/types.ts              Finding, parser result, rule contracts
src/policy/github-actions.ts     YAML parser and GHA rules
src/policy/dockerfile.ts         Dockerfile parser and DF rules
src/policy/catalog.ts            versioned rule metadata
src/ai/prompts.ts                grounded prompt construction
src/ai/output.ts                 schema validation/fallback
src/safety/input.ts              bounds and credential-pattern checks/redaction
ui/                              editor, findings, chat, exception request, states
tests/fixtures/                  safe and violating examples
```

The Agent coordinates: validate → parse → deterministic scan → persist review → request AI enrichment → validate AI output → persist/display response. This is observable coordination on Cloudflare Agents, without adding a long-running Workflow.

## Persistent state model

The Agent's SQLite-backed Durable Object stores:

- `review`: input type, source hash, policy version, deterministic findings, bounded redacted evidence excerpts, model ID, timestamps, and AI status. Do not persist full pasted source.
- `messages`: persisted by `AIChatAgent`; conversation history is bounded to a configured maximum.
- `exceptionRequests` (stretch): finding ID, bounded sanitized rationale, status fixed to `requested`, timestamp.
- `usage`: per-session inference/retry counts for demo cost control.

Treat the instance ID as a bearer credential, not real authorization: anyone who learns it may access that demo session. Send `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on stateful responses, never place the ID in logs/analytics, and make no confidentiality claim. “Delete and reset” must erase Agent messages and custom storage server-side. The platform spike must verify the `AIChatAgent` message-persistence lifecycle, sanitization point before persistence, and a tested deletion/expiry mechanism. Public release is blocked until either a bounded TTL is implemented or the README/UI explicitly disclose the verified retention behavior.

## Deterministic and LLM boundary

Deterministic code owns parsing, rule IDs, severity, evidence, locations, policy version, exception state, and whether a proposed correction passes re-scan.

Workers AI may only:

- explain supplied findings in plain language;
- draft a corrected configuration without inventing a supposedly trusted SHA/digest (use a clear placeholder when the correct pin is unknown);
- answer questions grounded in the current rule catalog and findings;
- suggest information an exception rationale should contain.

The model cannot add/remove findings, change severity/status, approve exceptions, call mutation tools, or access another session. The baseline uses bounded plain-text explanations rendered separately from immutable deterministic finding objects; schema-shaped model output and full-file correction remain stretch scope. Invalid or unavailable AI output becomes `explanation unavailable`, not a changed policy result.

## Safety and public-demo controls

- Treat pasted source and chat as untrusted data, never instructions; delimit them in prompts.
- Enforce server-side character and token-oriented limits (proposed initial caps: 20 KiB source, 1,000-character chat, 12 retained messages, 1,500 model output tokens); send only bounded excerpts.
- Reject private-key headers and recognizable high-confidence token formats before persistence/inference; redact values assigned to sensitive variable names. State that detection is not exhaustive.
- Send the model only redacted relevant snippets where practical.
- Never log pasted content, prompts, messages, authorization data, or bindings; log request ID, duration, rule counts, and error class.
- Escape model output, disable raw HTML, and treat any links as untrusted.
- Label corrections “AI-generated draft” and provide a deterministic re-scan action.
- Limit inference/retries per session and enforce request/concurrency/output-token caps. Public release also requires one non-bypassable global/account control: a singleton quota Durable Object, a verified Cloudflare account budget/limit, or AI disabled after a fixed global threshold. A per-session counter alone is insufficient because new instance IDs are cheap.

## User-facing states

- Empty/example state and disabled Review action.
- Editing with file type, size count, supported-rule summary, and credential warning.
- Validation/parse rejection with line/column when available; no AI call.
- Staged loading: validating, scanning, generating explanation.
- Success with findings; success with no detected violations (never “secure”).
- Partial success with deterministic findings and AI unavailable/retry.
- Chat loading, success, preserved-input error, and duplicate-submit prevention.
- Exception requested with timestamp and explicit “not approved” label.
- Restored session, invalid/reset session, and network failure without editor-data loss.

## Verification strategy

### Unit

- Positive/negative fixture per rule plus SHA/digest boundaries, local actions, permission overrides, safe `env` indirection, multistage/final-stage `USER`, `scratch`, continuations, and secret `ARG` without default.
- Stable rule ordering, evidence, and line numbers.
- Invalid syntax, size checks, secret rejection/redaction.
- AI schema rejection, unknown finding IDs, oversized fields, and raw HTML.

### Worker/Agent integration

- Baseline: create/connect session → review → restore → follow-up chat → restore. Stretch exception requests must restore if implemented.
- Mock AI success, timeout, malformed output, and provider error.
- Prove rejected secret input makes no AI call and is not persisted.
- Prove AI failure preserves deterministic findings; separate instances are isolated; malformed/short instance IDs are rejected; stateful responses are not cached/referred; and the known-ID bearer limitation is documented and manually verified.
- Prove both pasted-review and chat-message paths reject/redact sensitive values before model calls and before persistence.
- Verify delete/reset removes custom state and `AIChatAgent` messages; verify the documented retention/expiry behavior.

### Build and public smoke

- Type-check, lint, unit/integration tests, and production build.
- In a fresh browser, review one example of each file type, reload/restore, ask a finding-aware question, re-run edited input, exercise a parse error, and check a narrow viewport/keyboard flow. If stretch correction/exception features ship, re-scan the draft and verify exception restore.
- Inspect browser/network logs for accidental secret/prompt exposure and confirm required security headers.

## Requirement-to-evidence map

| Assignment requirement | Planned evidence | Verification |
|---|---|---|
| LLM | Workers AI binding/model config, finding explanations, bounded remediation, follow-up answers | Live smoke test; forced failure leaves findings intact |
| Workflow/coordination | Agent coordinator sequences validation, scan, state, inference, output validation, recovery | Integration tests for order and failure boundaries |
| Chat input | `useAgentChat` interface tied to current review | Follow-up answer references current known finding |
| Memory/state | SQLite-backed Agent/Durable Object stores messages and review; exceptions only if stretch ships | Reload restores state; new opaque instance is isolated |
| GitHub URL | Public repository containing source and evidence | Open from signed-out browser; clean-checkout verification |
| Prompt history | Chronological `PROMPT_HISTORY.md` with visible exact prompts/results | Audit numbering, redactions, and secret scan |
| Useful policy product | Four baseline versioned deterministic rules plus re-scan; four documented stretch contracts | Golden fixtures and demo examples |
| Public Cloudflare app | Single Worker/Static Assets `workers.dev` deployment | Fresh-browser deployed smoke test |

## Documentation and code-review gates

README must include the problem, 90-second demo, architecture, exact rules/limitations, trust boundary, prerequisites, local/test/deploy commands, binding names without credentials, examples, data handling, public URL, screenshots, trade-offs, AI-assistance statement, and a link to prompt history.

A review blocks release unless:

- every implemented baseline rule has passing positive/negative and boundary fixtures;
- model output cannot mutate deterministic truth or approve exceptions;
- no sensitive input reaches logs and secret tests prove no persistence/inference;
- parsing and AI failures degrade safely;
- UI covers empty/loading/success/partial/error states;
- delete/retention behavior and non-bypassable public AI budget limits are verified and match documentation;
- type-check, lint, tests, build, and deployed smoke checks pass;
- README and prompt history accurately reflect the code and assignment.

## Delivery and approval gates

1. **Now:** approve or revise this reviewed plan. Until approval, implementation remains paused.
2. After plan approval, run a minimal platform spike and inspect the intended Git arrangement and exact dependency manifest. Obtain explicit approval before any package installation.
3. Implement locally in verified vertical order: static route/session restore spike → pure parsers with `GHA001` and `DF002` → safe persistence → AI explanation/failure → `GHA002` and `DF004` → deploy/docs → stretch only if all gates pass.
4. Run an independent implementation review; log corrective prompts and verify fixes.
5. Obtain explicit approval before Cloudflare authentication, Worker/Durable Object creation, or any remote deployment. Confirm the exact account.
6. Deploy a preview/public `workers.dev` version only after approval; run smoke tests and update README evidence.
7. Obtain explicit approval before creating a GitHub repository, pushing, or opening a PR. Confirm repository owner, visibility, and branch target.
8. Open a draft PR with requirement mapping, test evidence, public demo, and prompt history; perform final code review and resolve verified issues.
9. Obtain explicit approval before changing PR readiness, merging, or any production/public-hosting transition not already authorized.

No commit, branch, repository, push, PR, Cloudflare resource, login, plugin, package, or deployment is created by this plan.

## Open decisions for approval

1. Approve the recommended Agents SDK + Durable Object architecture instead of a plain Worker + D1. It adds one framework dependency but most clearly demonstrates coordination, stateful chat, and Cloudflare-native memory.
2. Approve four baseline rules (`GHA001`, `GHA002`, `DF002`, `DF004`), with only `GHA001` and `DF002` required for the day-one vertical slice. The remaining four rules, full-file correction, and exception UX are stretch scope.
3. Confirm that an anonymous demo with opaque per-browser sessions and documented limitations is acceptable; authentication remains out of scope.
4. Confirm dependency installation, Cloudflare account, GitHub owner/repository visibility, and deployment approvals separately at their gates.
