---
name: pr-review
description: Review an actual pull request, branch diff, staged diff, or working-tree diff using evidence-based maintainability, test-quality, and security/regression lanes. Use when the user invokes `/pr-review`, mentions `pr-review`, or asks to review a PR or diff.
---

# PR Review

Perform a review only. Do not edit files, commit, push, approve, merge, or post comments unless the user explicitly requests that action.

## Guardrails

- Read the applicable `AGENTS.md` before reviewing.
- Limit each review or validation operation to 10 minutes.
- Stop and report after the same concrete error occurs twice.
- Ask when the target, base, expected behavior, or risk tolerance is unclear; do not guess.
- Preserve secrets and avoid reproducing sensitive values in evidence.

## Workflow

1. Resolve the exact target and base. Inspect the actual PR metadata/diff or repository diff, including relevant untracked files. If the base cannot be established, stop and ask.
2. Read the smallest surrounding code and tests needed to understand behavior. Run only safe, relevant checks. Record commands and results; never imply a check or delegation occurred when it was unavailable.
3. Read [references/registry.md](references/registry.md), then load every active reviewer file it lists. Treat the registry as the source of truth; do not hard-code reviewer lanes here.
4. Give each registered reviewer the resolved target/base, actual diff, applicable repository instructions, its reviewer file, and a read-only scope. When enough agent capacity exists, delegate each reviewer to a separate subagent. Otherwise run the unavailable lanes serially yourself. Label each lane accurately as `delegated` or `serial`; never imply delegation occurred when it did not.
5. Require each lane to return the evidence contract defined by its reviewer file. Deduplicate findings that share a root cause and location, retaining the clearest evidence and highest justified severity.
6. Integrate all registered lanes into the unified output below. Do not omit a lane silently; record an unavailable or blocked lane as `info` evidence.

## Severity and uncertainty

- **blocker:** demonstrable catastrophic impact or release cannot safely proceed.
- **high:** demonstrable correctness, security, data-loss, or major regression risk that must be fixed.
- **medium:** real bounded defect or meaningful coverage gap that should be fixed but does not fail the overall review.
- **low:** minor maintainability or quality issue.
- **info:** observation, unavailable check, or unresolved uncertainty.

Only `blocker` or `high` findings make the overall verdict `FAIL`. Medium, low, and info findings keep the verdict `PASS`. Do not elevate severity to compensate for uncertainty; ask for missing facts or mark the item `info`.

## Output

Return one concise table and no duplicate narrative findings:

| Scenario | Reviewer lane | Pass/Fail | Severity | Evidence | Final verdict |
|---|---|---|---|---|---|

Use `Pass` for verified checks with no finding and `Fail` for an evidenced finding. Cite unavailable checks as `Pass`/`info` only when the code review itself passes, while clearly stating the check was not run. Put the overall `PASS` or `FAIL` in a final summary row using the severity rule above.
