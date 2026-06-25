---
status: pending
priority: p2
issue_id: 009
tags: [code-review, data-integrity, architecture]
dependencies: []
---
# No snapshot validation (zod unused); promote gate checks people-count, not session/vote completeness

## Problem Statement
`zod` is a dependency but unused. `data.ts` casts `as unknown as Snapshot` (unsound; status enters via unchecked JSON.parse). The atomic-promote guard only checks diputado count `>=50` (`ingest.ts:359`); a rate-limited crawl can shrink sesiones/votos totales for everyone and still promote, publishing wrong denominators with no tripwire. Roster also silently drops a diputado whose party alt-text isn't mapped (gate should require ==57).

## Fix
- Validate the assembled Snapshot with a zod schema before promote and on load.
- Gate promotion on roster ==57 and session/vote completeness (not below last-good beyond tolerance); hard-fail on unmapped party.

## Acceptance Criteria
- [ ] Invalid snapshot fails ingest, not the running site.
- [ ] Promote requires exactly 57 + complete counts.
