---
status: pending
priority: p1
issue_id: 001
tags: [code-review, integrity,legal]
dependencies: []
---

# Fabricated scores on real legislators presented as official data

## Problem Statement
All scores are invented from a hardcoded `quality` per diputado and rendered under official-source chrome ('Datos públicos · Asamblea Legislativa', 'datos públicos reales') with no demo disclaimer. Includes an invented `no_presento` asset-declaration status (a public accusation of a legal violation) on named real people. Defamation/misinformation exposure.

## Findings
- `src/lib/mockData.ts:20-43,148-215` `makeRaw(q,seed)` fabricates all 'raw audit' figures; `declaracionEstado` invented at lines 25-26.
- `src/app/page.tsx:147,212`; `src/app/diputados/[id]/page.tsx:365,416`; `src/app/layout.tsx:18,22` assert official sources / 'datos reales'.
- No SIMULADO/DEMO label anywhere user-facing (grep-confirmed). Mock ships by default (DB-empty fallback).

## Proposed Solutions
1. **Back with real, citable data** before any public build (best, large). 2. **Label as DEMO** site-wide + remove official-source/'datos reales' copy (medium). 3. Take the public build offline until 1 or 2 (small).

## Recommended Action
_(triage)_

## Acceptance Criteria
- [ ] No invented figure is shown under government-source attribution.
- [ ] Either every figure is sourced+cited, or a persistent 'DATOS SIMULADOS' label appears on hero, cards, profile, footer, and metadata.
- [ ] Invented `declaracionEstado` removed or labeled simulated.

## Work Log
- 2026-06-25 — Created from multi-agent review (workflow + CE agents).
