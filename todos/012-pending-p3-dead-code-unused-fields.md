---
status: pending
priority: p3
issue_id: 012
tags: [code-review, simplicity]
dependencies: []
---
# Dead code and stored-but-never-read fields

## Findings
- `BAR_COLOR` (`ui.ts:33`) never imported — delete.
- `DimensionScore.n` always == eligible, never read — remove from type + buildDimension + JSON.
- `DiputadoRecord.ranked` written (`ingest.ts:335`) but never read (UI recomputes via withRanks) — remove unless JSON is a public API.
- `compareForRanking` exported but only used by withRanks — unexport.
- `PROVINCIAS` defined 3× (data-types union, ingest, FilterBar) — export one const.
- `Snapshot.periodo` stored but pages hardcode "2026–2030".
- `VoteChoice` unreferenced — delete.

## Acceptance Criteria
- [ ] Unused exports/fields removed; PROVINCIAS single-sourced; build+lint+tests still green.
