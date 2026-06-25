---
review_agents:
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:data-integrity-guardian
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:code-simplicity-reviewer
---

# Review context — DiputadoScore

Transparency app rating the 57 Costa Rican diputados (2026–2030) on plenary attendance
and roll-call voting, computed from the public legislative record (scraped from Delfino.cr,
robots-permitted). Next.js 16 App Router (static + daily ISR), React 19, TypeScript strict,
Tailwind v4. No runtime database — the app renders a committed, provenance-stamped snapshot
(`src/data/diputados.json`) produced offline by `scripts/ingest.ts`.

Weight these concerns heaviest when reviewing:
- **No fabrication / defamation safety.** Every displayed number about a named living
  politician must trace to a `SourceRef {url, retrievedAt}`. No imputed/default values, no
  invented bills, no asset-declaration accusations. Scores only for sitting diputados past
  the sample gate; no-data → "preliminar"/"sin datos", never a number.
- **Scoring correctness** (`src/lib/score.ts`): absolute pct→1–10, gating, no divide-by-zero,
  deterministic ranking/ties. Unit-tested in `src/lib/score.test.ts`.
- **Scraper robustness** (`scripts/ingest.ts`): throttling/backoff, identity resolved on
  cédula (not name substrings), hard-fail on unresolved names, atomic snapshot promotion,
  zod validation.
- **Honesty of UI copy**: present-tense, attributed, independent; no "official Asamblea"
  chrome, no CGR, no "datos reales" claims.
