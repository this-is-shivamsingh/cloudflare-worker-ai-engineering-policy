# Engineering Policy Copilot

Engineering Policy Copilot reviews a focused subset of GitHub Actions and Dockerfile guardrails. Deterministic code produces the findings; Cloudflare Workers AI explains those findings and answers follow-up questions without being allowed to change policy truth.

Phase 2 status: implemented, verified locally, and published as source.

Try the live demo: [Engineering Policy Copilot](https://engineering-policy-copilot.singhshivam242000.workers.dev/).

## What it demonstrates

| Assignment capability | Implementation |
|---|---|
| LLM | Llama 3.3 through a Workers AI binding, used only for explanations and bounded remediation guidance. |
| Coordination | `EngineeringPolicyAgent` sequences validation, deterministic analysis, durable state, inference, fallback, and chat. |
| Chat input | React `useAgentChat` interface for questions tied to the current review. |
| Memory/state | `AIChatAgent` and its SQLite-backed Durable Object persist chat plus a compact review summary. |

## Supported rules

Policy version: `2026-09-mvp1`.

| Rule | Level | Behavior |
|---|---|---|
| `GHA001` | High | External step actions and reusable workflows must use a full 40-character commit SHA. Local `./` and `docker://` references are exempt. |
| `GHA002` | High | Root permissions must be explicit and may not use `write-all`; explicit root/job write scopes are flagged except `id-token: write`. Empty permissions and `read-all` are allowed. |
| `DF002` | High / Info | The effective final stage must select a literal non-root `USER`; variable users are reported as “cannot verify.” |
| `DF004` | Critical | Non-empty literal secret-like values assigned through supported `ARG`/`ENV` forms are flagged, with values redacted from findings. |

These are intentionally narrow checks, not a comprehensive security scanner. The Dockerfile parser supports the documented fixture subset and returns `unsupported` for heredocs rather than guessing.

## Architecture

```text
React/Vite UI (Workers Static Assets)
              |
       useAgentChat / RPC
              v
EngineeringPolicyAgent (AIChatAgent)
  ├─ input validation and redaction
  ├─ deterministic policy engine
  ├─ compact persisted review state
  ├─ Workers AI explanation boundary
  └─ graceful model-failure fallback
              |
SQLite-backed Durable Object
```

There is one high-entropy Agent instance per browser session. The instance ID behaves like a bearer credential: this anonymous demo does not provide production authentication or confidentiality.

## Local setup

Prerequisites:

- Node.js 22 or newer (verified locally with Node 25.0.0)
- npm
- A Cloudflare account is needed only for live Workers AI development and deployment

Install exact locked dependencies:

```sh
npm ci
npx wrangler --version
```

Wrangler is already pinned as a project-local development dependency in this repository, so `npm ci` installs the required version and `npx wrangler` selects it. When adding Wrangler to a different project, Cloudflare recommends a project-local install:

```sh
npm install --save-dev wrangler@latest
```

A global install is available with `npm install --global wrangler`, followed by `wrangler ...`, but the project-local `npx wrangler ...` form is preferred because its version is reproducible with the repository.

Authenticate the local CLI through Cloudflare's browser flow, then verify the active identity and account access:

```sh
npx wrangler login
npx wrangler whoami
```

`npx wrangler whoami` exits unsuccessfully when Wrangler is not authenticated. These commands affect only local CLI authentication; they do not deploy this application.

Cloudflare references: [install/update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and [`login`/`whoami` commands](https://developers.cloudflare.com/workers/wrangler/commands/general/).

Generate binding types after changing `wrangler.jsonc`:

```sh
npm run cf-typegen
```

Run deterministic/unit tests, Worker integration tests, and static checks:

```sh
npm test
npm run test:worker
npm run typecheck
npm run lint
npm run build
```

`test:worker` uses Miniflare with remote bindings disabled and a test-only Agent subclass that simulates model success, failure, delay, and timeout without changing production inference code. It never invokes live Workers AI and may require permission to bind a loopback port.

Start the full-stack development server:

```sh
npm run dev
```

Create the private local variables file from the tracked template, edit the two Cloudflare placeholders in a trusted editor, and restrict its permissions:

```sh
cp .dev.vars.example .dev.vars
chmod 600 .dev.vars
```

Keep `.dev.vars` private. It contains raw credential values, is ignored by Git and Docker build context, and must never be printed, pasted into chat, or committed. Ask Codex to [use `$local-setup` to verify this checkout](./.codex/skills/local-setup/SKILL.md) without printing credentials.

Start with safe metadata-only Agent review/chat event logging enabled:

```sh
npm run dev:debug
```

The POSIX script sets `DEBUG_AGENT_EVENTS=1` for `npm run dev`. Debug output is limited to safe inbound/outbound event metadata: method, direction, character count, result status, rule IDs/count, duration, and usage counters. It must never log policy source, chat text, prompts, model input/output, payloads, session IDs, credentials, or headers. Debug enablement is compiled to `false` in production builds.

Workers AI has no local simulator, so the development server may request Cloudflare authentication for the remote AI binding. One authorized local smoke test exercised the configured live model against the safe built-in GitHub Actions example; it created no deployment.

## Docker local development

Prerequisites:

- Docker Engine with Docker Compose
- `make` and `curl` on the host
- A Cloudflare account ID and API token authorized to use Workers AI

Create the credential in the Cloudflare Dashboard:

1. Open **Workers AI → Use REST API → Create a Workers AI API Token**. The template flow pre-fills the token; review its permissions before creating and copying it.
2. For the least-privilege custom token used only for Workers AI inference, open **My Profile → API Tokens → Create Token → Create Custom Token** and set **Account → Workers AI → Read**. The Workers AI model-run API accepts this permission; write access is unnecessary for inference.
3. Under **Account Resources**, choose **Include → Specific account → your target account**. Do not grant access to every account.
4. Obtain that account's ID from **Workers & Pages → Account Details**, or use the Dashboard search (`Ctrl+K`/`Cmd+K`) and select **Copy account ID**.

Cloudflare references: [Workers AI REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [model-run API permissions](https://developers.cloudflare.com/api/resources/ai/methods/run/), and [finding an account ID](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/).

Create the ignored raw-value file from the tracked placeholder template, edit both Cloudflare values in a trusted editor, and keep it private:

```sh
cp .dev.vars.example .dev.vars
chmod 600 .dev.vars
```

The file uses this contract: `DEBUG_AGENT_EVENTS=1`, raw `CLOUDFLARE_API_TOKEN`, and raw `CLOUDFLARE_ACCOUNT_ID`. Use a narrowly scoped, revocable token. Compose bind-mounts the ignored file read-only at `/run/secrets/cloudflare_dev_vars`; the entrypoint exports its variables only inside the runtime process for Wrangler. `.dockerignore` excludes it before `COPY . .`, and neither the values nor the file contents enter image layers, image metadata, Compose configuration output, application logs, Git, or prompt history.

Build and start the local Worker/UI:

```sh
make docker-run
```

Open <http://localhost:5173>. To use a different host port, run `make docker-run HOST_PORT=8787` and open <http://localhost:8787>.

The port binds only to host loopback; it is not exposed to the local network. A missing, unreadable, empty, or placeholder `.dev.vars` value causes startup to exit without a restart loop. Invalid, expired, or insufficient Cloudflare credentials fail when Wrangler accesses the remote binding. Run `make docker-logs` to diagnose the error without printing `.dev.vars`, correct the file privately, and run `make docker-run` again.

Inspect logs and stop the service:

```sh
make docker-logs
make docker-stop
```

Run the complete test/static-check suite inside Docker, or start the service and verify its host HTTP endpoint:

```sh
make docker-test
make docker-smoke
```

Docker runs the same Vite-powered local Worker and UI as `npm run dev`. Deterministic policy checks execute locally in the container. The `AI` binding still uses Wrangler's remote binding to Cloudflare Workers AI, authenticated at runtime from the read-only `.dev.vars` mount; no model credential is sent to the browser. If Workers AI is unavailable after startup, the existing deterministic-results fallback remains in effect.

This workflow is local development only. It publishes port `5173` from a development server and does not deploy or create Cloudflare resources. Production remains the separate, explicitly authorized `npm run deploy` workflow described below.

## Usage

1. Select GitHub Actions or Dockerfile.
2. Paste non-confidential configuration or load the safe example.
3. Run the policy review.
4. Read versioned deterministic findings first; AI explanation is visibly separate.
5. Ask a follow-up question about the current findings.
6. Use **Clear saved session** to reset custom review state and persisted chat history.

If Workers AI is unavailable, deterministic findings remain visible and authoritative.

## AI trust boundary

The model receives rule metadata and redacted finding evidence, not the full pasted file. It may explain risks and suggest bounded remediation. It cannot create, suppress, resolve, reprioritize, or change the severity of findings; approve exceptions; or mutate code. Model output is rendered as plain React text.

The model is pinned to:

```text
@cf/meta/llama-3.3-70b-instruct-fp8-fast
```

Live availability was confirmed through one local development smoke on 2026-09-06 and must still be rechecked immediately before deployment.

## Data and safety limitations

- Do not paste real secrets or confidential configuration.
- Full source is not stored in Agent state; only its SHA-256 hash, deterministic findings, redacted evidence, and review metadata are retained.
- Chat messages are redacted through `sanitizeMessageForPersistence()` before durable storage and model use. The installed SDK may broadcast the incoming message to clients already connected to the same high-entropy session before persistence sanitization.
- Credential detection is best-effort, not a guarantee.
- Chat and review sizes, message history, output tokens, and per-session AI calls are bounded.
- Stored state persists until the user clears it or the Durable Object namespace is removed; automated TTL is not implemented in this local phase.
- A non-bypassable account/global Workers AI budget or kill switch is required before a public deployment. Deterministic scanning should remain available when that threshold is reached.

## Deployment checklist

Deployment is intentionally not executed in Phase 2. After explicit authorization:

1. Confirm the target Cloudflare account and Workers AI availability.
2. Configure a non-bypassable account/global AI usage limit or kill switch.
3. Authenticate Wrangler.
4. Run all verification commands above.
5. Deploy the single Worker + Static Assets bundle with `npm run deploy`.
6. Smoke-test both configuration types, reload persistence, chat, AI failure, and response headers on the resulting `workers.dev` URL.
7. Add the verified public URL here.

No D1, Pages, Workflows, KV, application-level MCP, or runtime multi-agent system is used.

## Testing evidence

- Final local result: 46 deterministic/unit/configuration tests and 14 Worker/Agent integration tests pass; TypeScript, ESLint, and the production build also pass.
- Deterministic fixtures cover rule positives, negatives, boundary SHA lengths, AST line locations, permission overrides, multi-stage images, variable users, supported ENV/ARG forms, continuations, invalid YAML, and unsupported Docker heredocs.
- Unit tests cover source/chat bounds, high-confidence credential rejection, assignment redaction, and prompts that preserve deterministic authority.
- Worker integration tests cover malformed session routing, valid Agent routing, Durable Object state restoration/reset/isolation, mocked AI success/failure/timeout, stale-completion rejection, rejected-secret state/usage, redacted finding/chat persistence and deletion, concurrent review admission, and review/chat inference caps that survive reset.
- One live Workers AI smoke returned a bounded explanation grounded in the deterministic `GHA001` and `GHA002` findings for the safe example. It was a local remote-binding test, not a public deployment.
- The completed browser E2E used Codex's in-app browser automation against the locally served UI. It did **not** use Cloudflare Browser Rendering or its `BrowserRun` API. Browser Rendering is a separate Cloudflare service for running headless browsers from Workers; this project has no Browser Rendering binding or runtime dependency.

## AI-assisted development

AI-assisted coding was used deliberately for research, planning, implementation, verification, and independent review. The approved implementation plan is in [docs/PLAN.md](./docs/PLAN.md), and the chronological, visible, secret-free audit trail is in [PROMPT_HISTORY.md](./PROMPT_HISTORY.md). Hidden model reasoning is not included. Historical prompt-history entries retain the paths written at the time, including the former root-level `PLAN.md` path, so the verbatim audit record is not rewritten retroactively.
