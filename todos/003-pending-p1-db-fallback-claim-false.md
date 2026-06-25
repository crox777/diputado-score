---
status: pending
priority: p1
issue_id: 003
tags: [code-review, architecture]
dependencies: []
---

# 'Works without DB / falls back to mock' is false

## Problem Statement
`prisma.ts` throws at import when DATABASE_URL is unset; pages' in-body try/catch can't catch an import-time throw. Only shipped dummy .env makes it appear to work. API routes have no fallback at all.

## Findings
- `src/lib/prisma.ts:6-18` eager construct + synchronous throw.
- `src/app/page.tsx:106` (and rankings/[id]) catch is unreachable for the missing-env case.
- `src/app/api/**` no try/catch → 500 with no DB.

## Proposed Solutions
1. **Lazy/null-guard the client** + single `withDbOrMock()` helper used by pages and routes (medium). 2. Return null from `createPrismaClient()` when env absent (small).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] Homepage renders mock with no DATABASE_URL set and dummy .env removed.
- [ ] API routes degrade or return a clean error, not a 500, with no DB.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
