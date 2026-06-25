---
status: pending
priority: p2
issue_id: 007
tags: [code-review, data-integrity]
dependencies: []
---
# NaN from a malformed source % defeats the no-imputation invariant

## Problem Statement
`parseProfile` does `parseFloat(ses)`; a malformed string yields `NaN`, which passes the `!== null` guard (`ingest.ts:300`). `Math.round(NaN)`→NaN reaches `buildDimension`, where `clamp(NaN)`→NaN, `pctToScore(NaN)`→NaN (not null). `NaN !== null` so isRanked treats it as ranked, computeOverall yields NaN, UI prints "NaN". Violates "no imputation; null over default."

## Fix
- Guard non-finite at the boundary: in `buildDimension`, treat non-finite hits/eligible as 0/null; or reject non-finite % in `parseProfile`.

## Acceptance Criteria
- [ ] A non-finite % yields `score: null`, unranked — never "NaN".
- [ ] Unit test covers it.
