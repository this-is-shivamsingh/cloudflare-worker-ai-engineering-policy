# Reviewer Registry

Load every active reviewer before reviewing. Paths are relative to the `pr-review` skill directory.

| Reviewer ID | Active reviewer file |
|---|---|
| `code-style` | `references/reviewers/code-style.md` |
| `test-case-review` | `references/reviewers/test-case-review.md` |
| `security-review` | `references/reviewers/security-review.md` |

## Add a reviewer

1. Create one concise `references/reviewers/<reviewer-id>.md` file declaring its ID, purpose, scope, evidence output contract, severity guidance, and non-overlap responsibility.
2. Add exactly one row for that file to the active registry table above.

Keep the new scope distinct from existing reviewers. The orchestrator discovers and runs every row in this table, using a separate subagent when available or an accurately labelled serial lane otherwise.
