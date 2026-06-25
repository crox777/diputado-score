---
status: pending
priority: p1
issue_id: 002
tags: [code-review, integrity,legal]
dependencies: []
---

# Invented legislative bills attributed to real legislators

## Problem Statement
`BILLS_BY_ID` hand-writes expedientes, titles, summaries, statuses, approval dates (several with impossible future dates) keyed to real people, rendered under 'datos públicos Asamblea' with 'Ver expediente' links to the generic Asamblea homepage.

## Findings
- `src/lib/mockData.ts:218-247` fabricated bills; future dates vs today 2026-06-25 (submittedAt 2026-07-22…, approvedAt 2027-01-15…).
- `src/app/diputados/[id]/page.tsx:311,348` official badge + 'Ver expediente en Asamblea Legislativa' link to homepage.

## Proposed Solutions
1. **Remove `BILLS_BY_ID`** from public build (small). 2. **Gate behind 'EJEMPLO FICTICIO'** label and drop `publicUrl` (small).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] No fabricated bill renders without an unmistakable fictional label.
- [ ] No `publicUrl` implies a real expediente exists.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
