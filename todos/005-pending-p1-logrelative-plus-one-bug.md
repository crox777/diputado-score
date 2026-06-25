---
status: pending
priority: p1
issue_id: 005
tags: [code-review, scoring]
dependencies: []
---

# logRelativeScore returns 7.5 (not 5.0) at the average

## Problem Statement
`ratio = log2(value/avg + 1)` makes value==avg → 7.5, inflating PRO and MOC for every deputy and distorting the 25% Productividad dimension.

## Findings
- `src/lib/scoreCalculator.ts:25-31`; docstring promises 5.0 at average.

## Proposed Solutions
1. Drop the `+1` and guard `value>0` (small). 2. Rewrite curve to hit documented anchors + unit test (small).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] value==avg → 5.0; 2×avg → ~documented value.
- [ ] Unit test pins anchor points.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
