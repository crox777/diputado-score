---
status: pending
priority: p1
issue_id: 004
tags: [code-review, data-integrity]
dependencies: []
---

# Prisma datasource has no url → all CLI commands fail

## Problem Statement
`datasource db { provider='postgresql' }` omits `url` (P1012), so generate/db push/migrate/studio fail — including the README setup step.

## Findings
- `prisma/schema.prisma:5-7` no `url`.
- `README.md:14` `cp .env.local .env.local` copies file onto itself.

## Proposed Solutions
1. Add `url = env("DATABASE_URL")` + standardize one env file (small).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] `prisma db push` and `prisma generate` succeed from a clean checkout following the README.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
