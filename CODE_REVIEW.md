# DiputadoScore — Code Review

Next.js 16 · React 19 · Prisma 7 · Tailwind v4. Reviewed as a full working tree (no git diff). Two independent passes were run and cross-checked: an 8‑dimension workflow with adversarial verification (78/79 findings confirmed) and a panel of CE review agents (TypeScript, security, architecture, performance, data‑integrity, simplicity). Findings below are the deduplicated, reconciled set; every item was verified against the source.

Severity: **P1** blocks any public deployment · **P2** fix before relying on the data · **P3** hardening/cleanup.

---

## P1 — Blockers

### 1. Fabricated scores on real, named legislators, presented as official government data
`src/lib/mockData.ts:20-43, 148-215` · `src/app/page.tsx:147,212` · `src/app/diputados/[id]/page.tsx:365,416` · `src/app/layout.tsx:18,22`

Every number in the app is invented. Each diputado carries a hardcoded `quality` (e.g. Villalta 8.6, Marta Esquivel 6.1, Reynaldo Arias 5.0); `makeRaw(q, seed)` turns it into deterministic pseudo‑random "raw audit data" via `h = ((seed*7 + n*13) % 97)/97`. No measurement exists behind any figure. These numbers are attached to **real, living, identifiable** Costa Rican legislators and rendered under a hero badge **"Datos públicos · Asamblea Legislativa"**, a footer **"Datos: Asamblea Legislativa Open Data · CGR · Delfino.cr"**, a profile section titled **"Datos crudos de auditoría"**, and page metadata that states **"datos públicos reales"**. There is no "simulado/demo" disclaimer anywhere user‑facing (grep‑confirmed). The DB path falls back to this same mock when empty, so the fabrications ship by default.

Worst element: `declaracionEstado` is set to `al_dia | atrasada | no_presento` purely from the made‑up quality number (lines 25‑26) and rendered as "Declaración bienes". `no_presento` is a public accusation that a named official failed to file a legally required sworn asset declaration — invented, with official‑source chrome. This is concrete defamation / misinformation exposure.

**Fix:** Do not publish invented numbers about named real people under government‑source attribution. Either (a) back every figure with a verified, citable source before any public build, or (b) if shipping a demo, label the entire site and every score "DATOS SIMULADOS / DEMO — no reflejan el desempeño real" on cards, profiles, hero, footer and metadata, and remove the official‑source attributions and the "datos reales" copy until real data backs them.

### 2. Invented legislative bills attributed to real legislators, dressed as official records
`src/lib/mockData.ts:218-247` · `src/app/diputados/[id]/page.tsx:311,348`

`BILLS_BY_ID` hand‑writes expediente numbers (24.055, 24.180, …), titles, multi‑sentence summaries, statuses and approval dates, keyed to real people (Villalta, Claudia Dobles, Nogui Acosta, Álvaro Ramírez, Vianey Mora, Iztarú Alfaro). The profile renders them under "datos públicos Asamblea" with each external link titled "Ver expediente en Asamblea Legislativa" pointing at the generic `https://www.asamblea.go.cr` — making fabricated bills look independently verifiable. Several are internally impossible: with today = 2026‑06‑25, bills carry `submittedAt` 2026‑07‑22 / 2026‑09‑05 / 2026‑10‑18 and `approvedAt` 2027‑01‑15 / 2027‑02‑05 (all future).

**Fix:** Remove `BILLS_BY_ID` from any public build, or gate behind an unmistakable "EJEMPLO FICTICIO" label and drop the `publicUrl` links that imply a real expediente.

### 3. "Works without a database, falls back to mock automatically" is false
`src/lib/prisma.ts:6-18` · `src/app/page.tsx:106` · all of `src/app/api/**`

`prisma.ts` constructs the client eagerly at **module‑evaluation time** and throws synchronously if `DATABASE_URL` is unset. Pages statically import this module, so the throw happens **before** any page function runs — the in‑body `try/catch` (which the README/CLAUDE.md promise as graceful degradation) cannot catch an import‑time throw. The app only *appears* to honor the claim because the repo ships dummy `.env`/`.env.local` localhost URLs, which push it into the *lazy connect → request‑time* path that the catch does handle. Delete those files or deploy with no `DATABASE_URL` and the homepage 500s at import. The four API routes have no try/catch at all, so they 500 under exactly the "no DB" condition the product advertises as supported.

**Fix:** Lazy‑construct or null‑guard the client so a missing `DATABASE_URL` is handled, not thrown at import; centralize behind one `withDbOrMock(query, mock)` data‑access helper used by pages and routes alike.

### 4. Prisma `datasource` block has no `url`
`prisma/schema.prisma:5-7`

`datasource db { provider = "postgresql" }` omits `url`. Prisma requires it (validation error P1012), so `prisma generate`, `db push`, `migrate`, and `studio` all fail — including `npm run db:push`, the README's setup step. The runtime works only because it uses the `PrismaPg` driver adapter, masking the gap.

**Fix:** Add `url = env("DATABASE_URL")` and standardize one env file across CLI, app, and scripts. (Note: `README.md:14` `cp .env.local .env.local` copies a file onto itself.)

### 5. `logRelativeScore` `+1` bug inflates every relative metric
`src/lib/scoreCalculator.ts:25-31`

The docstring promises "average → 5.0" but the code computes `ratio = log2(value/avg + 1)`. At `value == avg`: `log2(2) = 1` → `5 + 1*2.5 = 7.5`, not 5.0. So `PRO` (proyectos) and `MOC` (mociones) are systematically inflated for every deputy, distorting the 25%‑weighted Productividad dimension — the central output of the whole app.

**Fix:** Drop the `+1` (`ratio = log2(value/avg)`, guard `value>0`), or rewrite to match the intended 5.0‑at‑average curve, and add a unit test pinning the anchor points.

### 6. Politician ID scheme drift → deep links silently resolve to the wrong dataset
`src/lib/mockData.ts:148` (`dep-nogui-acosta`) · `src/scripts/ingest.ts:241` (`dep-<name-hyphenated>`) · `src/scripts/ingest-real.ts:635` (`dep-<apellido1_apellido2>`)

The same person gets three different primary keys. The detail page queries the DB by id and, on miss, **falls through to mock** instead of 404. So a link minted in mock mode (`/diputados/dep-nogui-acosta`) does not fail after `ingest:real` seeds `dep-acosta_jaen` — it renders stale **simulated** data for a person who has real data in the DB under a different id. Wrong‑data, not just a dead link.

**Fix:** One shared `politicianId()` in `src/lib/`, imported by mockData, ingest, and ingest‑real, so mock and DB rows for the same person share an id.

### 7. Two divergent ingest scripts; the README's command seeds the wrong people
`src/scripts/ingest.ts:73-170,260` · `src/scripts/ingest-real.ts:653`

`npm run ingest` (README step 4) seeds **8 people who are not the 2026‑2030 bench** — Rodrigo Chaves (the President), Gloria Bejarano, Zoila Volio, etc. — behind an unimplemented CSV‑parser `TODO`. `ingest:real` targets the correct 57. They also mint different period IDs (`-2026-2030` vs `-2026`), so running both double‑inserts periods. A user following the README seeds a chamber of 8 ex‑officials.

**Fix:** Delete or quarantine `ingest.ts`; align both docs on `ingest:real`; share one roster + id + period‑key constant.

### 8. No migrations; `db push` is the only path
`prisma/migrations/` absent · `README.md:23-26,107-109`

`db push` reconciles schema with no history and no rollback; a column rename against a populated DB drops the column (data loss) with nothing to review in a PR. Migrations are also the only place to add the CHECK/UNIQUE constraints the data model needs.

**Fix:** Adopt `prisma migrate`, baseline current schema, run `migrate deploy` in CI, forbid `db push` outside throwaway local DBs.

### 9. Surname‑substring matching falsely accuses real legislators of a crime
`src/scripts/ingest-real.ts:477-486`

`getDJBData` takes each deputy's **first surname only**, lowercases it, and marks them `no_presento` if that string appears **anywhere** in the CGR morosos HTML via `includes`. The roster is full of common surnames (Mora, Murillo, Jiménez, Vargas, Calvo, Campos, Alfaro, Artavia, Arias), so an unrelated "Mora" in the list flips multiple real legislators to a public accusation of failing to file a sworn declaration. Manifests only when `ingest:real` runs against a live DB.

**Fix:** Match on full normalized `apellido1 + apellido2` with whole‑token equality, require ≥2 surname‑token matches and ideally a cédula key, and default to unknown rather than asserting a violation on a partial hit.

### 10. Fabricated "estimate" defaults persisted indistinguishably from measured data
`src/scripts/ingest-real.ts:582-597`

When a source is missing the script substitutes invented constants (`sesionesAsistidas` 70/85, `votaciones` 380/450, `asesoresCount` 4, `gastoPresupuesto` 1.2M) and hard zeros for `mociones`/`comisionesAsistidas`/`gastoRepresentacion`, then upserts them into `Score`/`rawData`. The only "estimated" marker is a console string — nothing is persisted. The hard zeros actively penalize deputies on fabricated data (`COM` → 0). Given the docs admit the live sources mostly 404, published "real" scores are largely synthetic with no field saying which metrics are measured.

**Fix:** Persist per‑metric provenance/confidence (or store missing metrics as NULL and renormalize the weighted overall to exclude them). Never let an estimate read back as a measurement.

---

## P2 — Correctness & integrity

- **`ciudadania` phantom dimension makes the displayed weights wrong.** `scoreCalculator.ts:124-152` invents a 6th dimension = mean of the other five, weighted 10%, to reach 1.0. Algebraically the real effective weights are `presencia 0.17 / productividad 0.27 / transparencia 0.22 / gasto 0.17 / consistencia 0.17`, so **none** of the `METRIC_META.weight` (`types/index.ts:84-160`, sum 0.90) or `DIMENSION_META` (sum 0.90) values the UI renders match how the score is actually computed. The detail page tells users a metric is worth 7.5% when its true contribution is ~8.5%. Make `DIMENSION_META` the single source of truth, weights summing to 1.0, and derive both `calcOverall` and the displayed per‑metric weight from it (with a `satisfies keyof ScoreMetrics` guard).
- **COH is always the fallback 5.** `scoreCalculator.ts:117` reads `raw.coherenciaVoto`, which is not declared in `RawData` (compiles only via `[key:string]: unknown`) and is never set by any producer. The 7.5%‑weighted "Coherencia de voto" metric is constant. Declare the field, remove the index signature, and either source COH or drop it.
- **`rawData[code]` is always null.** `api/diputados/[id]/route.ts:36` indexes `rawData` by metric code (`ASI`…) but rawData keys are domain fields (`sesionesAsistidas`…). The per‑metric "audit" passthrough — the transparency hook — returns nothing. Map each code to its source fields.
- **Type‑safety holes hide a real bug.** `ingest-real.ts:652,666` cast `prisma.period/score as { upsert: Function }` (banned type, erases all payload checking); `prisma.ts:11` `as any` un‑types the whole client options bag; `ingest-real.ts:43` `@ts-ignore — Node fetch acepta agent` hides that undici's global `fetch` ignores `agent`, so the `rejectUnauthorized:false` SSL bypass is a **dead no‑op today** — but becomes a live network‑wide TLS bypass the moment anyone switches to `node-fetch`/`axios`. Run `prisma generate` (wire it into `postinstall`), delete the casts, and use `dispatcher`/scoped cert pinning instead of a global agent (or just delete the agent).
- **`/api/diputados` paginates then sorts the page in memory.** `route.ts:23-81` has no `orderBy`; `skip/take` returns an arbitrary slice that `.sort()` orders only locally, so `sort=overall_desc` is not the global ranking and the `@@index([overall])` is unusable. Sort in SQL (denormalize `currentOverall` onto `Politician`, or drive the list off `Score`).
- **No input validation / no error handling on API routes.** `parseInt` without radix on `page`/`limit` → `NaN`/negative `skip` → 500; unbounded `limit` → unbounded query; no `try/catch` → 500 under "no DB". Clamp (`Math.min(100, Math.max(1, …))`), validate, wrap handlers.
- **Empty `catch {}` masks real DB failures.** `page.tsx:106`, `rankings:36`, `[id]:134` treat any DB error as "no data → mock", so a production outage silently serves fabricated scores. Log, and distinguish "empty DB" from "DB threw".
- **Fragile scraping + poisonable cache.** `ingest-real.ts`: Portuguese `[class*='deputado']` selector + generic `article/.card`; regex over full element text; `fetchCached` never invalidates, so a 200 SharePoint login page or empty Delfino HTML is cached as data; `findDepByNombre` ≥2‑token fuzzy match collides on common names. Treat scraped values as untrusted; validate shape before caching; add TTL.
- **Non‑atomic ingest.** Per‑deputy writes (politician→period→score→snapshot) run as separate awaits with no `$transaction`; a mid‑loop crash leaves a half‑updated chamber where rankings mix old and new. Wrap each deputy in a transaction.
- **SearchBar has no debounce.** `SearchBar.tsx:48` fires `router.replace` → a full `force-dynamic` SSR + DB query on **every keystroke**. Filter client‑side (all rows are already on the page) or debounce ~300ms.
- **Snapshot dedup is racy and timezone‑offset.** `ingest.ts:297-327` check‑then‑create with no unique constraint and a local‑midnight boundary vs UTC `takenAt`; concurrent runs double‑insert, and the comment promises change‑based snapshots the code never implements. Add `@@unique([scoreId, takenOn])` + upsert; compute the day in a fixed TZ.

---

## P3 — Hardening & cleanup

- `<html lang="en">` (`layout.tsx:34`) on a fully Spanish site — set `lang="es"` (screen‑reader/SEO correctness).
- All pages `force-dynamic` → no caching/ISR/streaming; data changes only on ingest. Switch to `export const revalidate = …` + `generateStaticParams()` for the 57 profiles; biggest scalability lever and it defuses the SearchBar cost.
- Over‑fetch: list/detail queries pull `rawData` Json + all 11 metric columns + full snapshot rows for cards that need `overall` + 4 metrics + sparkline points. Add `select`; the snapshots table grows unbounded over time.
- `next/image` `unoptimized` on the 57‑avatar grid (`PoliticianCard.tsx:118`) but optimized on the single hero — backwards. Drop `unoptimized` on the grid (`remotePatterns` already allows the host) for the biggest landing‑page bandwidth win.
- `Float` for 1‑decimal scores → precision drift / unstable ordering; use `Decimal @db.Decimal(3,1)`. Add CHECK constraints (`0..10`). `declaracionEstado` should be a real enum column, not a free‑text Json field that defaults to `DEC=0` (max 20% penalty) on a typo.
- `onDelete: Cascade` chains Politician→…→ScoreSnapshot, so deleting one politician wipes the entire audit/history ledger; use `Restrict`/`SetNull` and rely on the `active` flag.
- Detail mock‑fallback path never sets `politicianPhoto`/`periodStart`/`periodEnd` → mock profiles show no photo and no period. Rankings page has no province/party filter UI though the API and mock support it.
- A11y: `FilterBar` selects and `SearchBar` input have no `<label>`; decorative SVGs lack `aria-hidden`.
- DRY: row→card mapping duplicated ×6, `SCORE_TEXT` map ×3, sort comparator ×3, the 57‑name roster twice (mockData vs ingest‑real). Extract `pickMetrics()`, `rowToCard()`, one comparator, one `roster.ts`.
- Dead code: `ScoreBadge` component + `SCORE_BG`, `SCORE_COLOR_CLASSES`/`SCORE_BORDER_CLASSES`, `DIM_COLORS` (and its dead `ciudadania` key), `getMockBillsById`, `ScoreTrend`, and the four `/api/*` routes (the UI queries Prisma directly — never calls them). ~30‑40% LOC reduction available.
- `xlsx@0.18.5` (npm) carries CVE‑2023‑30533 / CVE‑2024‑22363; operator‑side only, but pair with the TLS‑bypass intent and a poisoned spreadsheet is plausible. Move to the maintained SheetJS CDN build or `exceljs`. Add basic security headers (CSP/X‑Frame‑Options/nosniff) in `next.config.ts`.

---

## What's solid

`scoreCalculator.ts` pure helpers (`clamp`, `inverseRelativeScore`) are clean and testable; client components (`SearchBar`, `FilterBar`, `Sparkline`, `TrendBadge`) are well‑typed with explicit prop interfaces and no casts; `tsconfig` is `strict`; heavy ingest‑only deps (`xlsx`, `cheerio`, `csv-parse`) never reach the client bundle; the design system (dark SofaScore‑style cards, score‑color semantics, sparklines) is coherent and genuinely nice. The architecture is small and the logic is sound — the debt is duplication, a speculative DB/API layer the running app doesn't use, and the integrity problem of shipping invented data about real people.

## Note on `.env` files in the archive

`.env` and `.env.local` are bundled (the tarball bypasses `.gitignore`). Contents are **placeholders** (`johndoe/randompassword`, `postgres/password`), so no live secret leaked — but `.env.local` and `CLAUDE.md:156` instruct pasting a real Railway/Neon URL there, and the next archive built the same way would leak it. Keep only a committed `.env.example`; exclude `.env*` from any archive step.
