---
name: test-case-writer
description: Add focused unit and integration tests for modified or newly specified code behavior. Use when the user invokes `/test-case-writer`, mentions `test-case-writer`, or asks to write unit tests, integration tests, regression tests, or test cases for code changes.
---

# Test Case Writer

Write tests only. Do not change production behavior unless the user explicitly requests it.

## Guardrails

- Read the applicable `AGENTS.md` before acting.
- Limit each implementation or test operation to 10 minutes.
- Stop and report after the same concrete error occurs twice.
- Ask when expected behavior is unclear or contradictory; do not encode invented behavior.
- Preserve secrets and use synthetic fixtures.

## Workflow

1. Inspect the actual change/diff and the smallest relevant implementation surface. Identify each modified behavior, invariant, failure mode, and compatibility boundary.
2. Inspect nearby tests, fixtures, configuration, and commands. Follow the repository's existing framework, naming, setup, mocking, and assertion conventions.
3. Define a compact test matrix before editing:

   | Modified behavior | Unit/Integration | Happy/edge/failure/regression | Expected assertion |
   |---|---|---|---|

   Prefer the lowest-cost layer that proves the behavior. Avoid duplicating coverage already present.
4. Add only focused unit or integration tests. Keep fixtures minimal, deterministic, and independent of live credentials, networks, clocks, or probabilistic model text unless the repository already provides a controlled harness.
5. Run the narrow new tests first, then the relevant broader suite and static checks when available. Never claim a command passed if it was not run; report unavailable or timeboxed checks exactly.
6. Report files changed, commands/results, behaviors covered, and remaining gaps. Report numeric coverage only when a coverage tool was actually run; otherwise describe behavioral coverage without inventing percentages.
