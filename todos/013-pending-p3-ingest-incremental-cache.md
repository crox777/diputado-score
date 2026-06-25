---
status: pending
priority: p3
issue_id: 013
tags: [code-review, performance, scraper]
dependencies: []
---
# Ingest re-walks the whole term every run; soft-404 junk cached at full size

## Problem Statement
`countSessions`/`countVotes` start at TENURE_START every run (no cursor). Raw cache is 310MB at ~8 weeks → ~8GB by 2030; a cold run is hours (sleep 450ms × thousands). Soft-404 vote pages (~96KB) are cached before `isRealVotePage` rejects them.

## Fix
- Persist a cursor (lastIngestedDate); only probe new weekdays (past dates are immutable).
- Don't cache pages that fail isRealVotePage (or write a tiny tombstone); persist cache across CI.

## Acceptance Criteria
- [ ] Warm incremental run is O(new days); cache growth ~order of magnitude smaller.
