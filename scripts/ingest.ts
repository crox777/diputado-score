/**
 * DiputadoScore — weekly ingest script.
 *
 * Data sources (all public, robots-permitted):
 *   1. Delfino.cr       — plenary attendance (Sesiones %), roll-call votes (Votaciones %),
 *                         bills presented (Proyectos presentados N), spending (₡0 for new legislature)
 *   2. Observador.cr    — media mentions per diputado (last 7 and 30 days)
 *   3. Asamblea SP      — vehicle/travel spreadsheets (when available for this legislature)
 *
 * Run: npx tsx scripts/ingest.ts
 * GitHub Actions: runs every Monday 06:00 CR time (12:00 UTC)
 */
import { load } from "cheerio";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDimension,
  computeOverall,
  computeMediosScore,
  computeProductividadScore,
  isRanked,
  MIN_SESIONES,
  MIN_VOTOS,
} from "../src/lib/score.ts";
import { PROVINCIAS } from "../src/lib/data-types.ts";
import type {
  DiputadoRecord,
  Gastos,
  MediosScore,
  Partido,
  ProductividadScore,
  Provincia,
  Snapshot,
  SourceRef,
  Status,
} from "../src/lib/data-types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "src", "data", "diputados.json");
const STATUS_OVERRIDES = join(ROOT, "src", "data", "status-overrides.json");

const DELFINO = "https://delfino.cr";
const OBSERVADOR = "https://observador.cr";
const TENURE_START = "2026-05-01";

const PARTY_BY_ALT: Record<string, Partido> = {
  "Partido Pueblo Soberano": "PPSO",
  "Partido Liberación Nacional": "PLN",
  "Partido Frente Amplio": "FA",
  "Coalición Agenda Ciudadana": "CAC",
  "Partido Unidad Social Cristiana": "PUSC",
};

// ── throttled fetch with disk cache ───────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cachePath(kind: string, id: string) {
  return join(RAW, kind, `${id}.html`);
}

// Cache TTL per kind (in ms). 0 = always re-fetch; -1 = never expire.
const CACHE_TTL: Record<string, number> = {
  list: 6 * 60 * 60 * 1000,      // roster: 6h
  profile: 6 * 60 * 60 * 1000,   // delfino profiles: 6h
  asistencia: -1,                  // session pages: never expire (historical)
  "votaciones-proyecto": -1,
  "votaciones-mocion": -1,
  medios: 60 * 60 * 1000,         // observador search: 1h
};

async function fetchHtml(
  url: string,
  kind: string,
  id: string,
  opts: { allow404?: boolean; noCache?: boolean } = {}
): Promise<{ status: number; html: string | null; retrievedAt: string }> {
  const cp = cachePath(kind, id);
  const ttl = CACHE_TTL[kind] ?? 60 * 60 * 1000;
  const useCache =
    !opts.noCache &&
    existsSync(cp) &&
    (ttl < 0 || Date.now() - statSync(cp).mtimeMs < ttl);
  if (useCache) {
    return { status: 200, html: readFileSync(cp, "utf8"), retrievedAt: statSync(cp).mtime.toISOString() };
  }
  let delay = 600;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "DiputadoScore/1.0 (transparencia CR; github.com/crox777/diputado-score)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404 && opts.allow404)
        return { status: 404, html: null, retrievedAt: new Date().toISOString() };
      if (res.status === 200) {
        const html = await res.text();
        mkdirSync(dirname(cp), { recursive: true });
        writeFileSync(cp, html);
        await sleep(500);
        return { status: 200, html, retrievedAt: statSync(cp).mtime.toISOString() };
      }
      await sleep(delay);
      delay *= 2;
    } catch {
      await sleep(delay);
      delay *= 2;
    }
  }
  return { status: 0, html: null, retrievedAt: new Date().toISOString() };
}

const src = (url: string, retrievedAt: string): SourceRef => ({ url, retrievedAt });

// ── Delfino roster ─────────────────────────────────────────────────────────────
interface RosterEntry {
  slug: string;
  nombre: string;
  partido: Partido;
  provincia: Provincia;
  cargo: string | null;
  photoUrl: string | null;
}

async function getRoster(): Promise<RosterEntry[]> {
  const { html } = await fetchHtml(`${DELFINO}/asamblea/congresistas`, "list", "congresistas");
  if (!html) throw new Error("could not fetch congresistas list");
  const $ = load(html);
  const seen = new Set<string>();
  const roster: RosterEntry[] = [];
  $('a[href^="/asamblea/congresistas/"]').each((_, a) => {
    const href = $(a).attr("href")!;
    const slug = href.split("/").pop()!;
    if (slug.startsWith("page-") || seen.has(slug) || !/^[a-z0-9-]+$/.test(slug)) return;
    seen.add(slug);
    const $card = $(a);
    const imgs = $card.find("img").toArray();
    let nombre = "";
    let photoUrl: string | null = null;
    let partido: Partido | null = null;
    for (const img of imgs) {
      const alt = ($(img).attr("alt") || "").trim();
      if (PARTY_BY_ALT[alt]) partido = PARTY_BY_ALT[alt];
      else if (alt && !nombre) {
        nombre = alt;
        photoUrl = $(img).attr("src") || null;
      }
    }
    const text = $card.text().replace(/​/g, "").replace(/\s+/g, " ");
    let provincia: Provincia | null = null;
    let bestIdx = -1;
    for (const p of PROVINCIAS) {
      const i = text.lastIndexOf(p);
      if (i > bestIdx) { bestIdx = i; provincia = p; }
    }
    if (!provincia) { console.warn(`      ⚠ no province for ${slug}`); return; }
    let cargo: string | null = null;
    if (nombre) {
      const after = text.split(nombre)[1] || "";
      const role = after.replace(provincia, "").trim();
      cargo = role && role.length > 2 && role.length < 80 ? role : null;
    }
    if (nombre && partido) roster.push({ slug, nombre, partido, provincia, cargo, photoUrl });
  });
  return roster;
}

// ── Delfino profile ────────────────────────────────────────────────────────────
interface ProfileData {
  cedula: string | null;
  sesionesPct: number | null;
  votacionesPct: number | null;
  proyectos: number | null;
  gastos: Gastos | null;
  photoUrl: string | null;
}

function parseProfile(html: string, url: string, retrievedAt: string): ProfileData {
  const $ = load(html);
  const text = $("body").text().replace(/​/g, "").replace(/\s+/g, " ");
  const cedula = text.match(/C[ée]dula\s*(\d-\d{3,4}-\d{4})/)?.[1] ?? null;
  const ses = text.match(/Sesiones\s*([\d.]+)\s*%/)?.[1];
  const vot = text.match(/Votaciones\s*([\d.]+)\s*%/)?.[1];
  // "Proyectos presentados 3" — appears when the number has loaded in the RSC payload
  const proy = text.match(/Proyectos\s+presentados\s+(\d+)/)?.[1];
  const gasolina = text.match(/Uso de gasolina[\s\S]*?₡\s*([\d.,]+)/)?.[1];
  const kms = text.match(/Total giras \(km\)\s*([\d.,]+)/)?.[1];
  const viajes = text.match(/Total de viajes\s*(\d+)/)?.[1];
  const gastoVehiculo = text.match(/Uso de vehículos[\s\S]*?Gasto incurrido\s*₡\s*([\d.,]+)/)?.[1];
  const gastoViajes = text.match(/Viajes al exterior[\s\S]*?Gasto incurrido\s*₡\s*([\d.,]+)/)?.[1];
  const gastos: Gastos | null =
    gasolina || kms || viajes
      ? {
          vehiculoCombustible: gasolina
            ? `₡${gasolina}${kms ? ` · ${kms} km` : ""}`
            : kms ? `${kms} km` : null,
          viajesInternacionales: viajes
            ? `${viajes} viaje(s)${gastoViajes ? ` · ₡${gastoViajes}` : ""}`
            : null,
          sources: [src(url, retrievedAt)],
        }
      : null;
  let photoUrl: string | null = null;
  for (const img of $("img").toArray()) {
    const alt = ($(img).attr("alt") || "").trim();
    if (alt && !alt.startsWith("Partido") && !alt.startsWith("Coalición")) {
      photoUrl = $(img).attr("src") || null;
      break;
    }
  }
  return { cedula, sesionesPct: ses ? parseFloat(ses) : null, votacionesPct: vot ? parseFloat(vot) : null, proyectos: proy ? parseInt(proy, 10) : null, gastos, photoUrl };
}

// ── Enumerate session & vote counts ──────────────────────────────────────────
function* weekdaysBetween(startISO: string, endISO: string) {
  const d = new Date(startISO + "T12:00:00-06:00");
  const end = new Date(endISO + "T12:00:00-06:00");
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      yield `${y}${m}${day}`;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function countSessions(todayISO: string): Promise<string[]> {
  const dates: string[] = [];
  for (const ymd of weekdaysBetween(TENURE_START, todayISO)) {
    for (const seq of [1, 2]) {
      const id = `${ymd}${seq}`;
      const { status } = await fetchHtml(`${DELFINO}/asamblea/asistencia/${id}`, "asistencia", id, { allow404: true });
      if (status === 200) dates.push(ymd);
      else if (seq === 1) break;
    }
  }
  return dates;
}

function isRealVotePage(html: string): boolean {
  const $ = load(html);
  const voters = new Set($('a[href^="/asamblea/congresistas/"]').toArray().map((a) => $(a).attr("href")!).filter((h) => !/page-/.test(h)));
  return voters.size >= 50 && /Expediente\s*\d/.test($("body").text());
}

async function countVotes(sessionDates: string[]): Promise<number> {
  let total = 0;
  for (const ymd of [...new Set(sessionDates)]) {
    for (const tipo of ["proyecto", "mocion"] as const) {
      let misses = 0;
      for (let seq = 1; seq <= 100 && misses < 12; seq++) {
        const id = `${ymd}${String(seq).padStart(3, "0")}`;
        const { html } = await fetchHtml(`${DELFINO}/asamblea/votaciones/${tipo}/${id}`, `votaciones-${tipo}`, id, { allow404: true });
        if (html && isRealVotePage(html)) {
          total++; misses = 0;
        } else misses++;
      }
    }
  }
  return total;
}

// ── Delfino GraphQL — proyectos por diputado ───────────────────────────────────
const DELFINO_GQL = "https://api.delfino.cr/graphql";

/** Fetch all representative IDs for the current term. */
async function getRepresentativeIds(): Promise<Map<string, number>> {
  const query = `{ representatives(term: "2026-2030") { id slug } }`;
  const res = await fetch(DELFINO_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return new Map();
  const data = await res.json() as { data?: { representatives?: { id: number; slug: string }[] } };
  const reps = data?.data?.representatives ?? [];
  return new Map(reps.map((r) => [r.slug, r.id]));
}

/** Fetch all project expediente numbers from the current term (paginate if needed). */
async function getAllProjectFiles(): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const query = `{ projects(limit: ${limit}, offset: ${offset}) { file } }`;
    const res = await fetch(DELFINO_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) break;
    const data = await res.json() as { data?: { projects?: { file: string }[] } };
    const batch = data?.data?.projects ?? [];
    if (batch.length === 0) break;
    files.push(...batch.map((p) => p.file));
    if (batch.length < limit) break;
    offset += limit;
  }
  return files;
}

/** Batch-fetch project details (with author) using GraphQL aliases. Max 50 per request. */
async function fetchProjectDetails(files: string[]): Promise<Map<string, string[]>> {
  // returns: expediente → [authorSlugs]
  const result = new Map<string, string[]>();
  const BATCH = 50;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const aliases = batch.map(
      (f) => `p${f}: project(file: "${f}") { file representatives { slug } }`
    ).join(" ");
    const query = `{ ${aliases} }`;
    const res = await fetch(DELFINO_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) continue;
    const data = await res.json() as { data?: Record<string, { file: string; representatives: { slug: string }[] } | null> };
    for (const [, proj] of Object.entries(data?.data ?? {})) {
      if (!proj) continue;
      const slugs = (proj.representatives ?? []).map((r) => r.slug);
      result.set(proj.file, slugs);
    }
    await sleep(300);
  }
  return result;
}

/** Build a count of projects per diputado slug for the current term. */
async function getProyectosCount(): Promise<{ countBySlug: Map<string, number>; sourceUrl: string; retrievedAt: string }> {
  const retrievedAt = new Date().toISOString();
  const sourceUrl = `${DELFINO}/asamblea/proyectos`;
  try {
    const files = await getAllProjectFiles();
    const details = await fetchProjectDetails(files);
    const countBySlug = new Map<string, number>();
    for (const slugs of details.values()) {
      for (const slug of slugs) {
        countBySlug.set(slug, (countBySlug.get(slug) ?? 0) + 1);
      }
    }
    console.log(`      ${files.length} proyectos · ${countBySlug.size} diputados con proyectos`);
    return { countBySlug, sourceUrl, retrievedAt };
  } catch (e) {
    console.warn(`      ⚠ proyectos GraphQL error: ${e}`);
    return { countBySlug: new Map(), sourceUrl, retrievedAt };
  }
}

// ── Delfino GraphQL — gasto discrecional ──────────────────────────────────────

/** Fetch monthly expenses for all representatives. Returns slug → colones. */
async function getGastoData(repIds: Map<string, number>): Promise<{
  bySlug: Map<string, number>;
  promedioCohorte: number | null;
  retrievedAt: string;
}> {
  const retrievedAt = new Date().toISOString();
  const bySlug = new Map<string, number>();

  try {
    // Batch all reps in one request using aliases
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const entries = [...repIds.entries()];
    const aliases = entries.map(
      ([slug, id]) => `r${id}: representativeExpenses(month: ${currentMonth}) { expenses representative { slug } }`
    ).join(" ");
    const query = `{ ${aliases} }`;

    const res = await fetch(DELFINO_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { bySlug, promedioCohorte: null, retrievedAt };

    const data = await res.json() as { data?: Record<string, { expenses: number; representative: { slug: string } } | null> };
    for (const item of Object.values(data?.data ?? {})) {
      if (!item) continue;
      bySlug.set(item.representative.slug, item.expenses ?? 0);
    }

    const values = [...bySlug.values()].filter((v) => v > 0);
    const promedioCohorte = values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;

    const nonZero = [...bySlug.values()].filter((v) => v > 0).length;
    console.log(`      ${nonZero} diputados con gasto > ₡0 · promedio cohort: ${promedioCohorte ? `₡${promedioCohorte.toLocaleString()}` : "sin datos"}`);

    return { bySlug, promedioCohorte, retrievedAt };
  } catch (e) {
    console.warn(`      ⚠ gasto GraphQL error: ${e}`);
    return { bySlug, promedioCohorte: null, retrievedAt };
  }
}

// ── Observador.cr media mentions ───────────────────────────────────────────────
/** Keywords that suggest negative coverage (lower score). */
const NEGATIVE_KW = [
  "denuncia", "denunci", "moroso", "escándalo", "detenid", "arrest", "investigad",
  "sancion", "acusad", "impugn", "moción de censura", "censura", "corrupci",
  "irregular", "fraude", "malvers",
];

/** Keywords that suggest positive/constructive coverage (raises score). */
const POSITIVE_KW = [
  "presentó", "presento", "aprobó", "aprobo", "logró", "logro", "firmó", "firmo",
  "propuso", "propuso", "impulsa", "impulsó", "impulso", "iniciativa", "proyecto aprobado",
  "lideró", "lidero", "defendió", "defendio", "exigió", "exigio", "promovió", "promovio",
  "destacó", "destaco", "reconoci", "galardón", "galardón", "premio",
];

/** Fold accents + lowercase for keyword matching. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Classify an article title as positive, negative, or neutral based on keyword matching. */
function classifyTitle(title: string): "positivo" | "negativo" | "neutral" {
  const t = fold(title);
  if (NEGATIVE_KW.some((kw) => t.includes(fold(kw)))) return "negativo";
  if (POSITIVE_KW.some((kw) => t.includes(fold(kw)))) return "positivo";
  return "neutral";
}

function articlesInLastDays(dates: string[], days: number, retrievedAt: string): number {
  const cutoff = new Date(retrievedAt);
  cutoff.setDate(cutoff.getDate() - days);
  return dates.filter((d) => new Date(d) >= cutoff).length;
}

async function getMediosScore(nombre: string, slug: string): Promise<MediosScore | null> {
  const query = nombre.split(" ").slice(0, 2).join(" ");
  const observadorUrl = `${OBSERVADOR}/?s=${encodeURIComponent(query)}`;
  const { html, retrievedAt } = await fetchHtml(observadorUrl, "medios", slug);
  if (!html) return null;

  const $ = load(html);
  const nameParts = nombre.split(" ").filter((p) => p.length > 3);

  // Collect articles: {date, title} pairs that mention the diputado.
  // Observador.cr uses div.promo > div.content > (div.meta > time) + h3.title
  // We also try generic article/li containers as fallback for other sites.
  const articles: { date: string; title: string }[] = [];
  const seen = new Set<string>();

  $("div.promo, article, .post, .entry, .result-item, li").each((_, el) => {
    const titleEl = $(el).find("h3.title, h2, h3, h4, .entry-title, .post-title").first();
    const timeEl  = $(el).find("time[datetime]").first();
    const title   = titleEl.text().trim();
    const date    = timeEl.attr("datetime") ?? "";
    if (!title || !date || seen.has(title)) return;
    seen.add(title);
    const titleFolded = fold(title);
    if (nameParts.some((p) => titleFolded.includes(fold(p)))) {
      articles.push({ date, title });
    }
  });

  const cutoff30 = new Date(retrievedAt);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff7 = new Date(retrievedAt);
  cutoff7.setDate(cutoff7.getDate() - 7);

  // Only count articles that matched the diputado's name — no fallback to generic page dates.
  // ultimaFecha must be from a named article; showing a date from an unrelated article is misleading.
  const recentArticles = articles.filter((a) => new Date(a.date) >= cutoff30);
  const articulosSemana = articles.filter((a) => new Date(a.date) >= cutoff7).length;
  const articulosMes = recentArticles.length;

  // Sentiment classification (only on named, recent articles)
  let positivos = 0, negativos = 0, neutrales = 0;
  for (const a of recentArticles) {
    const cls = classifyTitle(a.title);
    if (cls === "positivo") positivos++;
    else if (cls === "negativo") negativos++;
    else neutrales++;
  }

  // Only set ultimaFecha if we actually found a named article — never infer from generic page dates
  const ultimaFecha = articles.length > 0
    ? articles.map((a) => a.date).sort().reverse()[0].slice(0, 10)
    : null;

  const score = computeMediosScore({ articulosMes, positivos, negativos, neutrales });

  return {
    articulosSemana,
    articulosMes,
    positivos,
    negativos,
    neutrales,
    ultimaFecha,
    score: Math.round(score * 10) / 10,
    sources: [src(observadorUrl, retrievedAt)],
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const todayISO = new Date().toISOString().slice(0, 10);
  console.log(`\n🗓  DiputadoScore ingest — ${todayISO}\n`);

  console.log("[1/7] Roster from Delfino…");
  const roster = await getRoster();
  console.log(`      ${roster.length} congresistas`);
  if (roster.length !== 57) console.warn(`      ⚠ expected 57, got ${roster.length}`);

  const overrides: { slug: string; status: Status }[] = existsSync(STATUS_OVERRIDES)
    ? JSON.parse(readFileSync(STATUS_OVERRIDES, "utf8"))
    : [];
  if (!existsSync(STATUS_OVERRIDES)) writeFileSync(STATUS_OVERRIDES, "[]\n");

  console.log("[2/7] Sessions & votes held (eligible denominators)…");
  const sessionDates = await countSessions(todayISO);
  const sesionesTotales = sessionDates.length;
  const votosTotales = await countVotes(sessionDates);
  console.log(`      ${sesionesTotales} sesiones · ${votosTotales} votaciones`);

  console.log("[3/7] Delfino profiles…");
  const profiles = new Map<string, ProfileData>();
  for (const r of roster) {
    const url = `${DELFINO}/asamblea/congresistas/${r.slug}`;
    const { html, retrievedAt } = await fetchHtml(url, "profile", r.slug);
    if (!html) { console.warn(`      ⚠ no profile for ${r.slug}`); continue; }
    profiles.set(r.slug, parseProfile(html, url, retrievedAt));
  }

  console.log("[4/7] Proyectos de ley (Delfino GraphQL)…");
  const { countBySlug: proyectosCount, sourceUrl: proyectosUrl, retrievedAt: proyectosAt } = await getProyectosCount();

  console.log("[5/7] Gasto discrecional (Delfino GraphQL)…");
  const repIdsReal = await getRepresentativeIds();
  const { bySlug: gastoBySlug, promedioCohorte, retrievedAt: gastoAt } = await getGastoData(repIdsReal);
  const gastoUrl = `${DELFINO}/asamblea/congresistas`;
  const gastosConDatos = [...gastoBySlug.values()].filter((v) => v > 0).length;
  console.log(`      ${gastosConDatos} diputados con datos de gasto · promedio ₡${promedioCohorte?.toLocaleString("es-CR") ?? "n/a"}`);

  console.log("[6/7] Media mentions (Observador.cr)…");
  const mediosMap = new Map<string, MediosScore | null>();
  for (const r of roster) {
    process.stdout.write(`      ${r.nombre.split(" ")[0]}…`);
    const m = await getMediosScore(r.nombre, r.slug);
    mediosMap.set(r.slug, m);
    process.stdout.write(` ${m?.articulosMes ?? 0} artículos/mes\n`);
  }

  console.log("[7/7] Assembling snapshot…");
  const diputados: DiputadoRecord[] = [];

  for (const r of roster) {
    const p = profiles.get(r.slug);
    if (!p) continue;
    const profileUrl = `${DELFINO}/asamblea/congresistas/${r.slug}`;
    const profileSrc = [src(profileUrl, new Date().toISOString())];

    const presencia = buildDimension(p.sesionesPct, sesionesTotales, MIN_SESIONES, profileSrc);
    const participacion = buildDimension(p.votacionesPct, votosTotales, MIN_VOTOS, profileSrc);

    // Productividad from Delfino GraphQL (real per-author count)
    const numProyectos = proyectosCount.get(r.slug) ?? 0;
    const prodScore = computeProductividadScore(numProyectos);
    // Productividad: gate the score (don't include in overall) when 0 projects presented.
    // A 2-month-old legislature cannot be penalised for not filing bills yet — that is not
    // a verifiable incumplimiento, just early timing. The count is still displayed as a fact.
    // Once a diputado files at least one bill the score becomes meaningful and enters the overall.
    const productividad: import("../src/lib/data-types.ts").ProductividadScore = {
      presentados: numProyectos,
      aprobados: 0,
      tasaAprobacion: 0,
      score: numProyectos > 0 ? prodScore : null, // null = gated, not enough activity yet
      sources: [src(proyectosUrl, proyectosAt)],
    };

    const medios = mediosMap.get(r.slug) ?? null;
    const ov = overrides.find((o) => o.slug === r.slug);
    const status: Status = ov?.status ?? "EN_EJERCICIO";

    // Gasto discrecional: gate score null when ₡0 (data not yet published by Asamblea)
    const totalColones = gastoBySlug.get(r.slug) ?? 0;
    const rangoEnCohort: import("../src/lib/data-types.ts").GastoScore["rangoEnCohort"] =
      totalColones === 0 || promedioCohorte === null
        ? null
        : totalColones < promedioCohorte * 0.75
        ? "bajo"
        : totalColones > promedioCohorte * 1.25
        ? "alto"
        : "medio";
    const gastoScoreValue: number | null =
      rangoEnCohort === null
        ? null
        : rangoEnCohort === "bajo"
        ? 9
        : rangoEnCohort === "medio"
        ? 6
        : 3;
    const gasto: import("../src/lib/data-types.ts").GastoScore = {
      totalColones: totalColones > 0 ? totalColones : null,
      promedioCohorteColones: promedioCohorte,
      rangoEnCohort,
      score: gastoScoreValue,
      sources: [src(gastoUrl, gastoAt)],
    };

    const overall = computeOverall(
      status,
      presencia,
      participacion,
      productividad.score,  // null when gated — excluded from weighted average
      null, // transparencia — not yet automated
      gasto.score,          // null when ₡0 (Asamblea hasn't published 2026 data yet)
      medios?.score ?? null,
    );

    diputados.push({
      id: r.slug,
      cedula: null,
      nombre: r.nombre,
      aliases: [],
      partido: r.partido,
      provincia: r.provincia,
      cargo: r.cargo,
      status,
      photoUrl: p.photoUrl ?? r.photoUrl,
      tenureStart: TENURE_START,
      tenureEnd: null,
      presencia,
      participacion,
      productividad,
      transparencia: null, // CGR DJB — no public automated source yet
      gasto,
      medios,
      overall,
      ranked: isRanked({ status, overall }),
      proyectosPresentados: p.proyectos !== null ? { value: p.proyectos, sources: profileSrc } : null,
      gastos: p.gastos,
      bills: [],
      sources: profileSrc,
    });
  }

  const cohort = {
    sesionesTotales,
    votosTotales,
    fasePreliminar: sesionesTotales < MIN_SESIONES || votosTotales < MIN_VOTOS,
    fuente: "Delfino.cr · Observador.cr · registro legislativo público",
    transparenciaEstimada: true as boolean,
    transparenciaNota: "DJB por diputado no disponible públicamente de forma automatizada. Verificar con CGR." as string,
  };

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    periodo: "2026-2030",
    cohort,
    diputados,
  };

  console.log("\n[write]");
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + "\n");
  if (snapshot.diputados.length >= 50) { // allow up to 7 missing (licencias/ceses)
    writeFileSync(OUT, readFileSync(tmp));
    unlinkSync(tmp);
    console.log(`✓ wrote ${snapshot.diputados.length} diputados → ${OUT}`);
  } else {
    unlinkSync(tmp);
    throw new Error(`refusing to promote: expected ≥50 diputados, got ${snapshot.diputados.length}`);
  }

  const ranked = diputados.filter((d) => d.ranked).length;
  const conProyectos = diputados.filter((d) => d.productividad !== null).length;
  const conMedios = diputados.filter((d) => d.medios !== null).length;
  const conGasto = diputados.filter((d) => d.gasto?.score !== null).length;
  console.log(`\n📊 REPORT`);
  console.log(`   ${diputados.length}/57 diputados`);
  console.log(`   ${sesionesTotales} sesiones · ${votosTotales} votaciones · fasePreliminar=${cohort.fasePreliminar}`);
  console.log(`   ${ranked} clasificados · ${conProyectos} con proyectos · ${conMedios} con datos de medios · ${conGasto} con gasto`);
}

main().catch((e) => {
  console.error("INGEST FAILED:", e);
  process.exit(1);
});
