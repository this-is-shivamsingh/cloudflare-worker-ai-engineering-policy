# Independent Plan Review

Review date: 2026-09-05  
Disposition: **Approve with corrections**; mandatory corrections below have been integrated into [`docs/PLAN.md`](./PLAN.md).

## Architecture reconciliation

The initial research streams disagreed between a plain Worker + D1 design and `AIChatAgent` + a SQLite-backed Durable Object. The final choice is the latter because it:

- visibly satisfies the assignment's coordination, chat, and persistent-memory dimensions with current Cloudflare-native primitives;
- provides one source of truth for session state and avoids custom D1 schemas/session APIs;
- integrates with Workers AI and React chat using documented Cloudflare patterns;
- remains feasible if the implementation starts with a platform spike and a narrow vertical slice.

D1, Pages, Workflows, custom bearer-token tables, and application-level MCP remain excluded. A small global quota mechanism, if implemented as another Durable Object, owns only public-demo usage limits—not session state.

## Mandatory findings integrated

| Priority | Finding | Integrated correction |
|---|---|---|
| High | Eight rules plus full correction, exception UX, Agent/UI/AI/tests/deploy/docs is not credible in 1–2 days. | Committed baseline reduced to two rules for the day-one vertical slice and four by day two. Four other rules, full-file correction, and exception UX are stretch. |
| High | An opaque Agent ID is a bearer credential, not authorization. | Require ≥128-bit random IDs, route validation, no-referrer/no-store controls, explicit known-ID limitation, isolation tests, and no confidentiality claim. |
| High | Secret handling and persistence lifecycle were inconsistent; reset originally abandoned rather than deleted server state. | Persist source hash/findings/bounded redacted excerpts only; sanitize both review and chat paths; verify SDK persistence lifecycle; require tested delete/reset and either TTL or explicit verified retention disclosure. |
| High | Per-session usage limits are bypassable in a public demo. | Make request/concurrency/output caps and a global/account budget control release-blocking; otherwise disable AI publicly. |
| High | Several parser/rule definitions hid important edge cases. | Require an executable contract/fixture matrix per baseline rule; clarify permissions, variable `USER`, Docker forms, and unsupported syntax behavior. |
| Medium | Research overstated AI-binding requirements for Agents generally. | Clarified that this AI chat application needs the AI binding, not every Agent. |
| Medium | Static-asset routing and dependency compatibility needed concrete checks. | Plan explicit worker-first `/agents/*` routing and requires installed-schema/version verification during the spike. |
| Medium | Character-only limits ignored model cost/context. | Added bounded excerpts, history limits, and output-token cap. |

## Required implementation order

1. Static Assets + Agent route/session-restore platform spike.
2. Pure parsers with `GHA001` and `DF002`, each driven by fixtures.
3. Safe Agent persistence and delete/retention verification.
4. Workers AI explanation with schema validation and failure fallback.
5. Add `GHA002` and `DF004` for the four-rule baseline.
6. Public-demo cost guard, complete states, tests, README, deployment.
7. Add correction/exception/rules only if every baseline gate passes.

## Residual risks

- Anyone with an Agent instance ID can access that anonymous demo session; the product is not suitable for confidential configurations.
- `AIChatAgent` message lifecycle and deletion/expiry behavior must be verified against the installed SDK before sensitive persistence claims are made.
- Model availability and package compatibility must be re-checked at implementation time.
- Dockerfile and GitHub Actions semantics exceed the documented rule subset; product copy must not claim comprehensive scanning.

## Review verification

- Cross-checked [`docs/PLAN.md`](./PLAN.md) against official-source research and the assignment mapping.
- Confirmed Phase 1 contains Markdown planning/evidence only.
- Confirmed no implementation or completed external-state claim exists.
- Reviewer changed no files or external state.
