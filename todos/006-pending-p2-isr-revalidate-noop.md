---
status: pending
priority: p2
issue_id: 006
tags: [code-review, architecture]
dependencies: []
---
# revalidate=86400 is a no-op (bundled JSON import is frozen) — misleading config

## Problem Statement
`data.ts` does `import rawSnapshot from "@/data/diputados.json"`, inlining the snapshot into the build. Every page sets `revalidate=86400`, but ISR regeneration produces byte-identical HTML — new data only ships via redeploy on a new commit. The plan's "daily ISR refresh" is unachievable this way.

## Fix
- Adopt the honest model: drop `revalidate` (static, rebuilt-on-commit), OR wire on-demand revalidation from the ingest/deploy step. Don't leave a 24h timer that refreshes nothing.

## Acceptance Criteria
- [ ] Rendering model is coherent and documented; no inert revalidate.
