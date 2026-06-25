---
status: pending
priority: p1
issue_id: 007
tags: [code-review, architecture]
dependencies: []
---

# `npm run ingest` seeds 8 wrong people; dual ingest scripts

## Problem Statement
README step 4 runs ingest.ts which seeds 8 non-2026 figures (Rodrigo Chaves, etc.) behind a TODO parser; ingest:real targets the 57. Divergent period ids double-insert.

## Findings
- `src/scripts/ingest.ts:73-170,260`; `src/scripts/ingest-real.ts:653`; `README.md:30` vs `CLAUDE.md:29`.

## Proposed Solutions
1. Delete/quarantine ingest.ts; align docs on ingest:real; share roster+id+period-key (medium).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] One documented ingest command seeds the correct 57.
- [ ] No path seeds non-current figures.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
