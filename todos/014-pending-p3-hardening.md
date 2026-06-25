---
status: pending
priority: p3
issue_id: 014
tags: [code-review, security, hardening]
dependencies: []
---
# Small hardening + housekeeping

## Findings
- Add `import "server-only"` to `src/lib/data.ts` (turns an accidental client import into a build error; keeps the 100KB JSON server-only).
- Validate scraped `slug` against `/^[a-z0-9-]+$/` before use in path/URL (`ingest.ts:118`).
- Remove unused `zod` dep if validation (009) isn't adopted, or use it.
- Drop unused `acontecer.co.cr` image host from next.config.
- Remove the hardcoded dummy DATABASE_URL from `.claude/launch.json`.
- `ingest.ts` should rm the `.tmp` after promote.
- Future-proof `bill.url` (validate https scheme) before the bills feature renders links.

## Acceptance Criteria
- [ ] Hardening items applied; no behavior regression.
