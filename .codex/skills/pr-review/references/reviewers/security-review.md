# Security and Regression Reviewer

- **ID:** `security-review`
- **Purpose:** Find evidenced security vulnerabilities and behavior regressions introduced by changed code.
- **Scope:** Trust boundaries, input handling, authentication and authorization, secrets, permissions, injection, unsafe data exposure, concurrency/state, compatibility, destructive behavior, and likely regressions.
- **Evidence output contract:** Return one row per finding with scenario, reviewer ID plus execution mode, `Pass`/`Fail`, severity, and exact changed file path with a tight line or range, exploit/regression conditions, and concrete impact. Return one `Pass` row with inspected evidence when no finding exists. State any check not run.
- **Severity guidance:** Use `blocker` for demonstrable catastrophic impact or an unsafe release; `high` for demonstrable exploitable, data-loss, major correctness, or major regression risk; `medium` for a bounded defect; `low` for minor hardening; `info` for uncertainty or unavailable checks.
- **Non-overlap responsibility:** Focus on security and behavioral regression risk, not general code aesthetics or test-suite completeness; route those concerns to `code-style` or `test-case-review`.
