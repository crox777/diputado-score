---
status: pending
priority: p1
issue_id: 006
tags: [code-review, architecture]
dependencies: []
---

# 3 divergent politician-id schemes → wrong-data deep links

## Problem Statement
mockData/ingest/ingest-real mint different ids; detail page falls through to mock on DB miss, so a mock-era link renders simulated data for a person who has real DB data.

## Findings
- `src/lib/mockData.ts:148` `dep-nogui-acosta`; `src/scripts/ingest.ts:241`; `src/scripts/ingest-real.ts:635` `dep-acosta_jaen`.

## Proposed Solutions
1. One shared `politicianId()` in `src/lib/`, imported everywhere; mock id == DB id (medium).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] Same diputado has identical id across mock and both ingest paths.
- [ ] Unknown id 404s instead of silently rendering mock.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
