---
status: pending
priority: p2
issue_id: 005
tags: [code-review, data-integrity, scraper]
dependencies: []
---
# Vote enumeration undercounts (214 vs 216 real), 2-session days double-count, cap is a silent ceiling

## Problem Statement
`countVotes` (`ingest.ts:243-264`) stops after 6 consecutive misses; on 2026-06-10 real proyecto seqs resume at 19-20 after an 8-seq soft-404 gap, so 2 real votes are silently dropped (216 true vs 214 stored). `votosTotales` is published as a sourced fact, so it's wrong by 2. Separately, `countVotes` iterates `sessionDates` which can contain a date twice (2-session days) → vote double-count (latent; CR holds extraordinary sessions). The `seq<=100` cap is an unlogged ceiling. Mociones contribute 0 (none pass the roll-call detector) — confirm whether moción roll-calls exist before trusting the denominator.

## Fix
- `for (const ymd of new Set(sessionDates))` in countVotes.
- Raise/remove the consecutive-miss threshold or enumerate from Delfino's per-date vote index; log any real page found after a gap > threshold (no silent truncation).

## Acceptance Criteria
- [ ] votosTotales == content-validated real count (216 now).
- [ ] 2-session days counted once.
- [ ] Gaps/caps logged in the ingest report.
