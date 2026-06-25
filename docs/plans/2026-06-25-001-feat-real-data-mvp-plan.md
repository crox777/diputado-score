---
title: "DiputadoScore — Real-data, publishable MVP"
type: feat
status: active
date: 2026-06-25
---

# DiputadoScore — Real-data, publishable MVP ✨

## Overview

Turn DiputadoScore from a fabricated-data prototype into a **publishable MVP** that rates the 57 diputados of the Asamblea Legislativa 2026–2030 using **only real, verifiable, attributed data**. Today every score, every "raw audit" figure, every bill, and every asset-declaration status is invented by a seeded hash and rendered under UI chrome claiming official sourcing — a defamation/misinformation liability against 57 named, living people. This plan replaces all of it with two honestly-computed dimensions derived from the public legislative record (plenary attendance and roll-call voting), backs every displayed number with a source URL + retrieval date, and ships a methodology + correction channel.

The MVP scope is deliberately **narrow and defensible**: two scored dimensions computed from primary records, bills and expenses shown as attributed facts (not scored), and a build-time data snapshot instead of a runtime database. Breadth (more metrics) is explicitly deferred until each new signal has a clean, per-person, verifiable source.

## Problem Statement

From the prior review (`CODE_REVIEW.md`, `todos/001-010`) and a fresh architecture pass:

- **Fabrication on real people (P1, the reason for this rewrite).** `src/lib/mockData.ts:20-43` (`makeRaw`) derives every metric from a seeded hash of an invented `quality` number. `declaracionEstado` (`mockData.ts:25-26`) invents a CGR asset-declaration status — i.e. a fabricated legal-violation accusation — per named diputado. `BILLS_BY_ID` (`mockData.ts:218-247`) invents expedientes, titles, and (future-dated) approval dates. All of it renders under "Datos públicos · Asamblea Legislativa" (`page.tsx:147`), a "datos públicos reales" meta description (`layout.tsx:17-18`), a "Datos crudos de auditoría" section (`[id]/page.tsx:363-386`), and a "Datos: Asamblea Legislativa Open Data · CGR · Delfino.cr" footer (`page.tsx:212`) — with **no demo disclaimer**.
- **Scoring is wrong even on its own terms.** `logRelativeScore` (`scoreCalculator.ts:25-31`) has a `+1` bug returning 7.5 (not 5.0) at the average; `calcOverall` invents a phantom `ciudadania` dimension (`scoreCalculator.ts:140-141,149`) so displayed weights (`DIMENSION_META`, sum 0.90) never match effective weights; `COH` is a constant 5 from an undeclared field (`scoreCalculator.ts:117`).
- **The DB layer is speculative and broken, yet load-bearing in the docs.** `prisma.ts:18` constructs the client at import and throws if `DATABASE_URL` is unset, so the documented "works without a DB → mock" claim is false; `schema.prisma:5-7` has no `url`; there are no migrations; three divergent politician-id schemes exist across `mockData.ts:150`, `ingest.ts:241`, `ingest-real.ts:635`; the four `/api/*` routes are never called by any page.
- **Two divergent ingest scripts.** `ingest.ts` seeds 8 wrong people (incl. President Chaves); `ingest-real.ts` scrapes but injects invented "estimate" defaults (`:582-597`) and makes false CGR accusations via surname-substring matching (`:477-486`).

**Net:** the app cannot be published as-is without legal exposure, and its scoring is incorrect. The fix is not patching — it is replacing the data foundation with the real record and rebuilding the score on top of it.

## Verified data sources (recon, 2026-06-25)

All are server-rendered HTML (cheerio works; **scrape the SSR pages, never `/api/`**), robots-permitted, and Delfino/Acontecer explicitly whitelist Anthropic crawlers. Throttle (serial + delay; bursts hit a Cloudflare `000` rate-limit).

| Data | Source | URL pattern | Notes |
|---|---|---|---|
| Roster + identity | Delfino | `https://delfino.cr/asamblea/congresistas` → `/asamblea/congresistas/{slug}` | 57 cards; profile exposes **cédula**, party, province, cargo, age, commissions, photo (CloudFront), expense lines, "Proyectos presentados". Slug = lowercase, strip accents, ñ→n, spaces→`-`. No salary/asesores. |
| Attendance | Delfino | `https://delfino.cr/asamblea/asistencia/{YYYYMMDD}{seq}` | Binary **Presentes/Ausentes** per session. ~31 sessions to date; enumerate by CR-local date (client-side pager won't paginate). No justified/late category. |
| Voting + bills | Delfino | `https://delfino.cr/asamblea/votaciones/{proyecto\|mocion}/{id}` | Full **per-diputado** vote (a favor/en contra/abstención/ausente) + bill título/expediente/fecha/resultado. ~150–400 votes to date. (DOM duplicates desktop+mobile — dedupe by diputado.) |
| Photos | Delfino CloudFront / Acontecer | `https://d1qqtien6gys07.cloudfront.net/wp-content/uploads/2026/04/{Nombre-Apellido}.jpg`; `https://acontecer.co.cr/api/diputado-foto` | **Do NOT** use `asamblea.go.cr/SiteAssets/` — robots-disallowed. |
| Canonical names (cross-check) | Wikipedia | `Anexo:Diputados_del_periodo_legislativo_2026-2030_en_Costa_Rica` | Resolves the 7 known name-spelling discrepancies. |

The canonical 57 roster (name, party, province) and 7 cross-source name discrepancies are enumerated in the recon appendix at the end of this plan.

## Architectural decisions (made for the MVP)

1. **Compute our own metrics from primary records.** Presencia and Participación are computed from the per-session Presentes/Ausentes pages and the per-vote roll-call pages — not lifted from Delfino's pre-computed "Sesiones %/Votaciones %." This is independently verifiable and the lower-legal-risk posture. Delfino's aggregate is used only as an **ingest canary** (cross-check), never displayed. Delfino's proprietary subscriber "Calificación" is never shown.
2. **Absolute scoring, not peer-relative.** Each dimension's 1–10 is a direct, interpretable transform of a real percentage (92% present → 9.2). This deletes the entire `logRelativeScore`/relative-instability problem (a roster change no longer shifts everyone's score) and makes the `+1` bug moot by removing the function from the scoring path.
3. **Two scored dimensions only.** Presencia (plenary attendance) + Participación (roll-call voting). **Productividad is dropped as a score** (bill-count is gameable, co-authorship-ambiguous, and the least-clean source); "Proyectos presentados" is shown as an **attributed count**, and expense/travel lines as **attributed facts**, both visually separated from any score.
4. **Build-time JSON snapshot; remove the runtime database.** For 57 people over slowly-changing public records, a request-time Postgres is the over-engineering the review already flagged (unused `/api/*`, import-time throw, no migrations). The ingest script writes a committed, provenance-stamped `src/data/diputados.json`; the app renders it statically with daily ISR. No DB at runtime → trivially deployable (static on Vercel), auditable (snapshot lives in git), and runnable in CI. Prisma, `prisma.ts`, the schema, and the four `/api/*` routes are removed for the MVP. (A DB can return later if write-heavy/real-time features arrive; not now.)
5. **Identity keyed on cédula.** Cédula (from the Delfino profile) is the canonical politician id. Attendance/vote rows (which carry names) resolve to a cédula through a version-controlled alias map covering the 7 known variants; an **unresolved name hard-fails the record** (never creates a duplicate). Cédula is an internal key only — **not displayed publicly** (Ley 8968).

### The four gate invariants (enforced in code + CI)

1. **No number without provenance** — every persisted metric stores `sources: [{url, retrievedAt}]`; a number with no source cannot render.
2. **No score without sample** — a dimension scores only when `n >= MIN_SAMPLE` (sessions ≥ 10, votes ≥ 20); below → "preliminar", show raw counts, no 1–10.
3. **Identity resolves to cédula or the record hard-fails** — no fuzzy/substring matching; unresolved → abort with an alert.
4. **Atomic promotion** — ingest writes to staging; the live snapshot is replaced only after completeness invariants pass (roster == expected count, every enumerated session/vote parsed or explicitly skipped-with-reason). A failed run leaves last-good data intact.

## Scoring model (exact)

```
# src/lib/score.ts  (pure, unit-tested)
presenciaPct      = sesionesPresente / sesionesElegibles            # sessions held during tenure
participacionPct  = votosEmitidos    / votosElegibles               # votosEmitidos = choice ∈ {a_favor,en_contra,abstencion} (not ausente)

scoreDim(pct)     = clamp(round(pct * 10, 1), 0, 10)                # 0.92 → 9.2   (absolute, interpretable)

overall           = round((scorePresencia + scoreParticipacion) / 2, 1)
                    ONLY IF status == EN_EJERCICIO
                    AND nSesiones >= 10 AND nVotos >= 20
                    ELSE overall = null  → UI shows dims individually + "preliminar"/"no clasificado/a"

# No imputation: a missing dimension is excluded and labeled "sin datos" — never defaulted to 5.
# Color bands keep meaning under absolute scoring: gold ≥8.5, green ≥7.0, yellow ≥5.5, orange ≥4.0, red <4.0  (= ≥85%/70%/… presence).
# Tiebreak (deterministic): overall desc → presencia desc → accent-folded name → cédula.
```

**Status** ∈ `{EN_EJERCICIO, EN_LICENCIA, NO_SE_INCORPORO, CESO}`, default `EN_EJERCICIO`, overridden only via `src/data/status-overrides.json` (`{cedula, status, since, sourceUrl, note}`) — **never inferred from absences**. Non-`EN_EJERCICIO` diputados are excluded from ranking/composite and labeled with their cited status. Percentages are computed over sessions/votes **during tenure only** (handles mid-term entry/exit).

The correlation between Presencia and Participación is **disclosed openly** on the methodology page (participation is conditional on the body sitting); 50/50 weighting is documented, not hidden.

## Data model (snapshot JSON, typed)

```ts
// src/lib/data-types.ts
type Sourced<T> = { value: T; sources: { url: string; retrievedAt: string }[] };
type Choice = "a_favor" | "en_contra" | "abstencion" | "ausente";
type Status = "EN_EJERCICIO" | "EN_LICENCIA" | "NO_SE_INCORPORO" | "CESO";

interface DiputadoRecord {
  cedula: string;                 // canonical id (internal, not displayed)
  slug: string;                   // delfino slug, used for profile routes
  nombre: string; aliases: string[];
  partido: "PPSO"|"PLN"|"FA"|"CAC"|"PUSC"; provincia: string;
  cargo: string | null; status: Status;
  photoUrl: string | null; tenureStart: string; tenureEnd: string | null;
  presencia:    { pct: number; n: number; presente: number; elegibles: number; score: number|null } | null;
  participacion:{ pct: number; n: number; emitidos: number; elegibles: number; score: number|null } | null;
  overall: number | null;        // null when gated/non-sitting
  proyectosPresentados: Sourced<number>;   // attributed FACT, not scored
  gastos?: Sourced<{ vehiculoCombustible?: string; viajesInternacionales?: string }>; // attributed FACT
  sources: { url: string; retrievedAt: string }[]; // profile-level
}
interface Snapshot {
  generatedAt: string; periodo: "2026-2030";
  cohort: { sesionesHasta: number; votosHasta: number; fasePreliminar: boolean };
  diputados: DiputadoRecord[];
}
```

Raw scraped HTML is cached under `data/raw/{source}/{id}.html` for audit reproducibility (gitignored or committed per size).

## Ingestion pipeline (single script)

`scripts/ingest.ts` (replaces both `ingest.ts` and `ingest-real.ts`):

1. **Roster + identity** — fetch `/asamblea/congresistas`, parse 57 cards, fetch each `/asamblea/congresistas/{slug}`, extract `cedula, nombre, partido, provincia, cargo, photoUrl, proyectosPresentados, gastos`. Build the cédula-keyed identity index + alias map (seeded with the 7 known variants). Canary: roster count == 57 (±confirmed roster delta).
2. **Attendance** — enumerate session ids by CR-local date since `tenureStart`; fetch each `/asamblea/asistencia/{id}`; parse Presentes/Ausentes; resolve each name → cédula (hard-fail on miss); accumulate per-diputado present/eligible over tenure.
3. **Voting + bills** — enumerate vote ids; fetch each `/asamblea/votaciones/{proyecto|mocion}/{id}`; dedupe desktop/mobile DOM; parse per-diputado Choice + bill metadata; accumulate emitidos/eligibles; collect bills (expediente, título, fecha, resultado) for the "Proyectos" fact display.
4. **Validate (zod) → compute scores → assemble staging Snapshot.**
5. **Promote** only if gate invariants pass; write `src/data/diputados.json`; emit an ingest report (counts, unresolved names, stale sources, cross-check vs Delfino aggregate).

Resilience: serial fetch with polite delay + exponential backoff/jitter; per-source circuit breaker; transient `000`/429 retried; idempotent (keyed by cédula+sessionId / voteId) — re-running produces no diff.

## App / rendering changes

- **Data access** via `src/lib/data.ts` reading the JSON snapshot; pages become static with `export const revalidate = 86400` (drop every `force-dynamic`). Delete the `try{DB}catch{mock}` branches.
- **Remove**: `prisma/`, `prisma.config.ts`, `src/lib/prisma.ts`, `src/scripts/ingest*.ts`, all four `src/app/api/*` routes, Prisma deps, `mockData.ts` fabrication (keep roster + photo helpers, migrated into ingest), `scoreCalculator.ts` relative/phantom-dimension logic (replaced by `score.ts`), dead code (`ScoreBadge`, `ScoreTrend`, `SCORE_*_CLASSES`, `getMockBillsById`, `DIM_COLORS.ciudadania`).
- **UI honesty**: `<html lang="es">` (`layout.tsx:34`); replace "Datos públicos · Asamblea Legislativa" / "datos públicos reales" / "Datos crudos de auditoría" with attributed copy — e.g. *"Asistencia y votaciones: actos legislativos públicos, vía Delfino.cr · actualizado {fecha}"* — and a per-number source link + `retrievedAt`. Bills and expenses render in a separate **"Datos reportados"** block, clearly attributed, never scored. Add "preliminar / sin datos / no clasificado" states across grid, rankings, and profile. Photo 404 → deterministic initials placeholder.
- **New `/metodologia` page** (versioned, dated): what each dimension measures and its source; plenary-only caveat; absolute-scoring explanation; the Presencia/Participación correlation; "independiente, no afiliado a la Asamblea/Delfino/partidos"; data cutoff; **right-of-reply / correcciones contact**.

## Acceptance Criteria

### Integrity / legal (P0 — blocks publish)
- [ ] No fabricated value renders anywhere; a CI/content check fails on any CGR / declaración-de-bienes / asset-declaration string in code, data, or copy.
- [ ] Every displayed metric exposes a source URL + `retrievedAt`; a number with no `sources` cannot render (enforced by type + test).
- [ ] Presencia/Participación are computed from primary session/vote pages; Delfino's pre-computed aggregate and subscriber rating are never displayed.
- [ ] `/metodologia` is published with disclaimers, versioning, and a correcciones contact before launch.
- [ ] Cédula is used internally only and never displayed publicly.

### Scoring (P0/P1)
- [ ] `score.ts` is pure and unit-tested: known % → expected 1–10; clamps at [1,10]; no divide-by-zero when eligibles == 0; `null` (not 5) when a dimension lacks data.
- [ ] No code path imputes a default score; missing dimension is excluded and labeled "sin datos".
- [ ] `overall` is withheld unless `status == EN_EJERCICIO` and both n-gates pass; non-sitting diputados are excluded from ranking and labeled with cited status.
- [ ] Status is never inferred from absences; only `status-overrides.json` (with source) changes it. A test asserts an on-leave diputado is "no clasificado/a", not low-scored.
- [ ] Deterministic tiebreak; ties display shared rank ("12 (empate)").
- [ ] Global "fase preliminar" handling when `cohort` below MIN_SAMPLE (raw counts, no 1–10).

### Ingestion / ops (P0/P1)
- [ ] Single ingest pipeline; both old scripts deleted; no second divergent path.
- [ ] Identity resolves every attendance/vote row to a cédula or hard-fails; a test feeds all 7 name variants and asserts they converge to the correct single cédula.
- [ ] Staging→promote: a partial/rate-limited crawl never overwrites live data; failed invariants leave last-good snapshot intact and emit a report.
- [ ] Idempotent: re-running a completed ingest yields no diff (test).
- [ ] zod schema validation per page; a layout change rejects the row and flags "possible schema change" rather than writing garbage.
- [ ] Per-number provenance + raw-HTML retention sufficient to reproduce any published figure later.
- [ ] Roster-delta (resign/replace) triggers a controlled review, not a silent failure; departed diputados soft-deleted (`status=CESO`), history retained, percentages over tenure only.

### Bugs closed (P1)
- [ ] `logRelativeScore` +1 path removed from scoring (absolute model); no relative-scoring code remains in the score path.
- [ ] Phantom `ciudadania` dimension and constant-5 `COH` removed; displayed weights == effective weights.
- [ ] No Prisma at runtime; importing data layer never throws on missing env; no `datasource url` / migration breakage (DB removed for MVP).
- [ ] Single canonical id (cédula) across the whole app; no divergent id schemes.

### UX / rendering (P1/P2)
- [ ] `lang="es"`; static render with daily revalidate; no `force-dynamic`.
- [ ] Grid/rankings/profile have loading (skeleton), empty ("datos en preparación"), and error (boundary + retry) states — never blank or zeros.
- [ ] Unscored diputados sort into a labeled "no clasificados" group, not top/bottom of the numeric ranking.
- [ ] Search is accent/case-insensitive and resolves the 7 name variants; explicit no-results state.
- [ ] Photo failure → initials placeholder; no broken images; `asamblea.go.cr/SiteAssets` never fetched.
- [ ] `npm run build && npm start` works with no database and no secrets.

## System-Wide Impact

- **Interaction graph**: ingest (offline) → `src/data/diputados.json` → `data.ts` loader → Server Components (static/ISR). No request-time external calls; no DB connection lifecycle.
- **Error propagation**: ingest failures are contained to the offline job (staging, no promotion); the live site only ever serves a validated snapshot. Runtime errors reduce to "file present + valid" (guaranteed at build) → render; per-card defensive states cover missing optional fields.
- **State lifecycle**: atomic snapshot replacement = no partial/orphaned state; raw-HTML cache is append-only audit, not live state.
- **API-surface parity**: removing `/api/*` removes an unused surface; if an agent/JSON consumer is later wanted, expose a single read-only `/api/diputados` that serves the same snapshot (post-MVP, agent-native).
- **Integration scenarios**: (1) source rate-limited mid-crawl → run aborts, last-good stays; (2) a name appears that no alias resolves → hard-fail + report; (3) a diputado with 0 votes early-term → "preliminar", never 0%; (4) on-leave minister → "no clasificado/a", excluded; (5) Delfino layout change → zod rejects, no garbage promoted.

## Implementation Phases

**Phase 1 — Foundation & honesty (no fabrication can ship).**
`git init`; add `score.ts` (+ tests) and `data-types.ts`; build the cédula identity index + alias map (7 variants) and `status-overrides.json`; strip fabrication and official-source chrome; `lang="es"`; wire pages to a hand-seeded minimal real snapshot so the app is honest even before full ingest. Remove Prisma/`api/*`/dead code.

**Phase 2 — Real ingest.**
Single `scripts/ingest.ts`: roster+identity → attendance → votes/bills → validate → compute → atomic promote, with throttling/backoff/circuit-breaker, provenance, raw-cache, and an ingest report. Produce the first full `diputados.json`.

**Phase 3 — Surface & verify.**
Profile/grid/rankings render scores + raw counts + per-number source links + dates; "Datos reportados" attributed block (bills, expenses); preliminar/sin-datos/no-clasificado states; `/metodologia` + correcciones; search alias-aware; photo placeholders. Add the content-audit CI check and idempotency/identity tests.

## Dependencies & Risks

- **Scraping fragility / rate limits** → serial+throttled, backoff, circuit breaker, zod validation, last-good fallback; raw-cache for audit. (Mitigated, not eliminated — Delfino can change layout; CI canary + alerts.)
- **Photo licensing** → news-org photos carry copyright independent of robots; confirm rights or fall back to initials/official placeholder.
- **Thin MVP perception** (2 dimensions) → addressed by honesty: a real, verifiable 2-signal score beats a fake 11-signal one; methodology states scope explicitly; more dimensions added only when cleanly sourced.
- **Roster/licencia source of truth** → manual, source-cited `status-overrides.json` with a named maintainer; default EN_EJERCICIO; documented.
- **Not yet a git repo / no GitHub remote** → `git init` locally for the pipeline; creating a public GitHub repo is a separate, user-authorized step.

## Sources & References

- Prior review: `CODE_REVIEW.md`; `todos/001-010-pending-p1-*.md` (map 1:1 to this plan).
- Architecture anchors: `src/lib/mockData.ts:20-43,218-247`, `src/lib/scoreCalculator.ts:25-31,140-152`, `src/lib/prisma.ts:6-18`, `prisma/schema.prisma:5-7`, `src/scripts/ingest.ts:73-170,241`, `src/scripts/ingest-real.ts:477-486,582-597,635`, `src/app/page.tsx:147,212`, `src/app/diputados/[id]/page.tsx:363-386`, `src/app/layout.tsx:17-18,34`.
- Data: `https://delfino.cr/asamblea/congresistas`, `/asamblea/asistencia/{YYYYMMDD}{seq}`, `/asamblea/votaciones/{proyecto|mocion}/{id}`; `https://acontecer.co.cr/asamblea/diputados`; Wikipedia `Anexo:Diputados_del_periodo_legislativo_2026-2030_en_Costa_Rica`; robots: scrape SSR pages, avoid `/api/` and `asamblea.go.cr/SiteAssets/`.

## Appendix — Canonical 57 roster (cross-checked)

Party totals verified = 57: **PPSO 31, PLN 17, FA 7, CAC 1, PUSC 1**. Province apportionment: San José 18, Alajuela 12, Puntarenas 6, Cartago 6, Heredia 5, Guanacaste 5, Limón 5.

**7 name discrepancies to encode as aliases** (Delfino/Wikipedia spelling is canonical; Acontecer variant in parens): Kattia↔Kattya Mora Montoya; Gerardo↔Gerald Bogantes Rivera; Robert Johsan↔Junior Barrantes Camacho; Sadie Esmeralda↔Esmeralda Britton González; Daniel Asdrúbal Siezar↔Siézar Cárdenas; Royner Mora Ruiz↔Royner G. Mora Ruíz; Grethel↔Gréthel Ávila Vargas.

Slug rule (verified): lowercase, strip accents, ñ→n, spaces→`-`, keep particles ("del"); compound surnames collapse spaces ("Mc Lean"→`mc-lean`). Full roster with party+province is in the ingest identity seed.
