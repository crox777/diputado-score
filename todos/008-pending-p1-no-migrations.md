---
status: pending
priority: p1
issue_id: 008
tags: [code-review, data-integrity]
dependencies: []
---

# No migrations; db push only (data-loss risk)

## Problem Statement
`db push` has no history/rollback; a column rename drops data with nothing to review. Blocks adding CHECK/UNIQUE constraints.

## Findings
- `prisma/migrations/` absent; `README.md:23-26,107-109` use db push.

## Proposed Solutions
1. Adopt `prisma migrate`, baseline, `migrate deploy` in CI, forbid db push outside local (medium).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] A baseline migration exists and CI runs `migrate deploy`.
- [ ] db push is not used against shared DBs.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
