---
status: pending
priority: p2
issue_id: 003
tags: [code-review, data-integrity]
dependencies: []
---
# Provincia assigned by fragile substring match with silent "San José" default

## Problem Statement
`scripts/ingest.ts:134` sets `provincia = PROVINCIAS.find(p => text.includes(p)) || "San José"`. The snapshot distribution (SJ18/Ala12/Car6/Her5/Gte5/Pun6/Lim5) does not match the statutory 2026 allocation (SJ19/Ala11/Car7/Her6/Gte4/Pun5/Lim5) — 6 of 7 provinces off by one. Real, named legislators are shown with the wrong province, and unmatched cards default silently to San José.

## Fix
- Parse provincia from a structured field on the profile page, or map from the cross-checked canonical roster; never default — leave null + warn if unresolved.

## Acceptance Criteria
- [ ] Province distribution matches the statutory 57-seat allocation.
- [ ] No silent San José fallback; unresolved logs a warning.
