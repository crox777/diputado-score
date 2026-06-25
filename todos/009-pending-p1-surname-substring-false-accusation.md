---
status: pending
priority: p1
issue_id: 009
tags: [code-review, security,legal]
dependencies: []
---

# Surname substring marks real legislators 'no_presento'

## Problem Statement
getDJBData marks a deputy as failing to file a sworn declaration if their first surname appears anywhere in CGR morosos HTML; common surnames cause false public accusations.

## Findings
- `src/scripts/ingest-real.ts:477-486` first-surname `includes` substring match.

## Proposed Solutions
1. Whole-token match on apellido1+apellido2, require ≥2 token matches + cédula; default to unknown (medium).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] No deputy is marked no_presento on a partial/single-surname hit.
- [ ] Identity confirmed by ≥2 surnames or cédula before asserting a violation.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
