---
status: pending
priority: p2
issue_id: 008
tags: [code-review, quality, ux]
dependencies: []
---
# Search by party matches the enum code, not the human label

## Problem Statement
`searchDiputados` folds `d.partido` ("PLN"), so typing "frente amplio"/"liberación" returns nothing, though the placeholder invites party search (`data.ts:35`).

## Fix
- Also match `PARTIDO_LABEL[d.partido]`.

## Acceptance Criteria
- [ ] Searching a party's full name returns its diputados.
