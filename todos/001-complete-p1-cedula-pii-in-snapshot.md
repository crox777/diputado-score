---
status: pending
priority: p1
issue_id: 001
tags: [code-review, security, privacy, data-integrity]
dependencies: []
---
# Cédula (PII) committed in the published snapshot — Ley 8968

## Problem Statement
All 57 real national IDs (cédulas) are stored in `src/data/diputados.json` (e.g. `1-0703-0787`). The contract itself says cédula is "INTERNAL identity key only — never rendered publicly (Ley 8968)" (`src/lib/data-types.ts:57`). The runtime UI does NOT leak it (no component reads `d.cedula`; not in client bundle; not in `public/`), but the committed file (and git history) exposes it to anyone with repo access — and this repo is headed for public publication.

## Findings
- `src/data/diputados.json`: 57 `"cedula"` values in plaintext.
- Only runtime use: ranking tiebreak `a.cedula ?? a.id` (`score.ts:118`, slug fallback already present) and the status-override join keyed on cédula (`ingest.ts:316`), which is nullable/fragile (architecture M4).

## Fix
1. Stop writing `cedula` into the snapshot: in `scripts/ingest.ts`, emit `cedula: null` (keep `p.cedula` in memory only).
2. Re-key `status-overrides.json` and the override match on `slug` (always present) instead of cédula.
3. Drop the `?? a.cedula` tiebreak in `score.ts` (use `a.id`).
4. Re-run ingest; commit the scrubbed snapshot. If history is published, purge it.

## Acceptance Criteria
- [ ] `grep cedula src/data/diputados.json` returns only `"cedula": null` (or field removed).
- [ ] status-overrides keyed on slug; override test still works.
- [ ] No rendered/bundled cédula (already true) AND none in committed data.
