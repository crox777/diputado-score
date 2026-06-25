---
status: pending
priority: p1
issue_id: 002
tags: [code-review, data-integrity, honesty]
dependencies: []
---
# Displayed % is re-quantized and mislabeled as Delfino's published figure

## Problem Statement
The methodology states the percentage shown IS Delfino's published per-diputado figure. The code does the inverse: it discards the published % and stores only `hits = round(publishedPct/100 × eligible)`, then re-derives `pct = hits/eligible` for both the score and the displayed %. With 32 sessions this quantizes to 3.125-pt steps, rounding 44/57 diputados up to "100.0% · 10.0". The page that establishes credibility shows a coarsened number while claiming it is the exact source figure — on a page naming 57 real people.

## Findings
- `scripts/ingest.ts:297-314` computes hits, discards `p.sesionesPct`/`p.votacionesPct`.
- `src/lib/score.ts:47,55` re-derives `pct = hits/eligible`.
- `src/app/diputados/[id]/page.tsx:75` renders `(dim.pct*100)` (= hits/32), not the published %.
- `src/app/metodologia/page.tsx:91-94` claims the % "es el que publica su ficha en Delfino.cr" — false as implemented.

## Fix
- Add `reportedPct` to `DimensionScore`; carry Delfino's published % through ingest.
- Score from the published %: `score = pctToScore(reportedPct/100)`.
- Display `reportedPct` as the exact percentage; render the count strictly as `≈round(reportedPct/100 × eligible)`.

## Acceptance Criteria
- [ ] Profile shows Delfino's exact published % (not hits/eligible).
- [ ] Score derives from reportedPct; "100.0%/10.0" appears only for genuinely-100% records.
- [ ] Methodology statement matches implementation.
