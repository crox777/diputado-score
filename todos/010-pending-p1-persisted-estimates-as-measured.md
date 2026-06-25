---
status: pending
priority: p1
issue_id: 010
tags: [code-review, data-integrity]
dependencies: []
---

# Fabricated 'estimate' defaults persisted as measured data

## Problem Statement
Missing sources are replaced with invented constants and hard zeros, upserted into Score/rawData with only a console 'estimado' tag; nothing distinguishes them at read time.

## Findings
- `src/scripts/ingest-real.ts:582-597`.

## Proposed Solutions
1. Persist per-metric provenance/confidence in rawData (medium). 2. Store missing metrics NULL and renormalize overall (medium).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] Every served metric carries a source/confidence flag, or NULLs are excluded from overall.
- [ ] No estimate is indistinguishable from a measurement.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
