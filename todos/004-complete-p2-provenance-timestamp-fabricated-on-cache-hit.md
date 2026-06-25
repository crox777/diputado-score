---
status: pending
priority: p2
issue_id: 004
tags: [code-review, data-integrity, honesty]
dependencies: []
---
# retrievedAt is stamped at run time even on cache hits → fake retrieval dates + non-idempotent

## Problem Statement
`src()` stamps `retrievedAt: new Date()` at ingest-run time (`ingest.ts:96`), and `generatedAt` is always `now()`. On a cache hit the record claims it was retrieved "now" when the HTML was fetched days earlier — and the profile renders this verbatim ("Fuente: Delfino.cr · actualizado {retrievedAt}"). For a tool whose differentiator is per-number provenance, this displays a fabricated date and makes every re-run produce a diff (idempotency acceptance criterion unmet).

## Fix
- Persist the true fetch timestamp with the cached HTML (sidecar/mtime) and use it for `retrievedAt`.
- Bump `generatedAt` only when content changes (or exclude it from the idempotency contract).

## Acceptance Criteria
- [ ] retrievedAt reflects the actual fetch time, stable across warm re-runs.
- [ ] Warm re-run with no new data yields no snapshot diff (except an intentional generatedAt policy).
