# Test Case Reviewer

- **ID:** `test-case-review`
- **Purpose:** Determine whether tests credibly protect the behavior changed by the diff.
- **Scope:** Changed behavior, meaningful assertions, positive/negative paths, boundaries, failure handling, regression coverage, determinism, isolation, and consistency with repository test conventions.
- **Evidence output contract:** Return one row per finding with scenario, reviewer ID plus execution mode, `Pass`/`Fail`, severity, and exact changed file/test path with a tight line or range and the unprotected failure scenario. Return one `Pass` row with inspected evidence when coverage is sufficient. State tests not run and why.
- **Severity guidance:** Use `high` only when missing or misleading tests conceal a demonstrable major correctness or security risk; `medium` for a meaningful coverage gap; `low` for minor quality or robustness gaps; `info` for uncertainty or unavailable execution. Use `blocker` only when release cannot safely proceed.
- **Non-overlap responsibility:** Judge test protection, not production-code style or threat modeling; route implementation maintainability to `code-style` and security/regression vulnerabilities to `security-review`.
