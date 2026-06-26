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

// ── Observador.cr media mentions ───────────────────────────────────────────────
/** Keywords that suggest negative coverage (lower score). */
const NEGATIVE_KW = [
  "denuncia", "denunci", "moroso", "escándalo", "detenid", "arrest", "investigad",
  "sancion", "acusad", "impugn", "moción de censura", "censura", "corrupci",
  "irregular", "fraude", "malvers",
];

/** Scrape Observador.cr search results for a name. Returns article count and last date. */
async function scrapeObservador(nombre: string, slug: string): Promise<{ count: number; dates: string[] }> {
  // Build search query: first + last name (most distinctive part)
  const parts = nombre.split(" ");
  const query = parts.slice(0, 2).join("+"); // e.g. "Nogui+Acosta"
  const searchUrl = `${OBSERVADOR}/?s=${encodeURIComponent(query)}`;
  const { html, retrievedAt } = await fetchHtml(searchUrl, "medios", slug);
  if (!html) return { count: 0, dates: [] };

  const $ = load(html);
  const dates: string[] = [];
  $("time[datetime]").each((_, el) => {
    const dt = $(el).attr("datetime");
    if (dt) dates.push(dt);
  });
  // Count <h2> or <h3> titles that contain the name
  let count = 0;
  $("h2, h3").each((_, el) => {
    const text = $(el).text();
    if (parts.some((p) => p.length > 3 && text.includes(p))) count++;
  });
  return { count: Math.max(count, dates.length > 0 ? 1 : 0), dates };
}

function articlesInLastDays(dates: string[], days: number, retrievedAt: string): number {
  const cutoff = new Date(retrievedAt);
  cutoff.setDate(cutoff.getDate() - days);
  return dates.filter((d) => new Date(d) >= cutoff).length;
}

async function getMediosScore(nombre: string, slug: string): Promise<MediosScore | null> {
  const observadorUrl = `${OBSERVADOR}/?s=${encodeURIComponent(nombre.split(" ").slice(0, 2).join(" "))}`;
  const { html, retrievedAt } = await fetchHtml(
    observadorUrl, "medios", slug
  );
  if (!html) return null;

  const $ = load(html);
  const dates: string[] = [];
  $("time[datetime]").each((_, el) => {
    const dt = $(el).attr("datetime");
    if (dt) dates.push(dt);
  });

  const articulosSemana = articlesInLastDays(dates, 7, retrievedAt);
  const articulosMes = articlesInLastDays(dates, 30, retrievedAt);
  const ultimaFecha = dates.length > 0
    ? dates.sort().reverse()[0].slice(0, 10)
    : null;

  const baseScore = computeMediosScore({ articulosMes });

  return {
    articulosSemana,
    articulosMes,
    ultimaFecha,
    score: Math.round(baseScore * 10) / 10,
    sources: [src(observadorUrl, retrievedAt)],
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const todayISO = new Date().toISOString().slice(0, 10);
  console.log(`\n🗓  DiputadoScore ingest — ${todayISO}\n`);

  console.log("[1/5] Roster from Delfino…");
  const roster = await getRoster();
  console.log(`      ${roster.length} congresistas`);
  if (roster.length !== 57) console.warn(`      ⚠ expected 57, got ${roster.length}`);

  const overrides: { slug: string; status: Status }[] = existsSync(STATUS_OVERRIDES)
    ? JSON.parse(readFileSync(STATUS_OVERRIDES, "utf8"))
    : [];
  if (!existsSync(STATUS_OVERRIDES)) writeFileSync(STATUS_OVERRIDES, "[]\n");

  console.log("[2/5] Sessions & votes held (eligible denominators)…");
  const sessionDates = await countSessions(todayISO);
  const sesionesTotales = sessionDates.length;
  const votosTotales = await countVotes(sessionDates);
  console.log(`      ${sesionesTotales} sesiones · ${votosTotales} votaciones`);

  console.log("[3/5] Delfino profiles…");
  const profiles = new Map<string, ProfileData>();
  for (const r of roster) {
    const url = `${DELFINO}/asamblea/congresistas/${r.slug}`;
    const { html, retrievedAt } = await fetchHtml(url, "profile", r.slug);
    if (!html) { console.warn(`      ⚠ no profile for ${r.slug}`); continue; }
    profiles.set(r.slug, parseProfile(html, url, retrievedAt));
  }

  console.log("[4/5] Media mentions (Observador.cr)…");
  const mediosMap = new Map<string, MediosScore | null>();
  for (const r of roster) {
    process.stdout.write(`      ${r.nombre.split(" ")[0]}…`);
    const m = await getMediosScore(r.nombre, r.slug);
    mediosMap.set(r.slug, m);
    process.stdout.write(` ${m?.articulosMes ?? 0} artículos/mes\n`);
  }

  console.log("[5/5] Assembling snapshot…");
  const diputados: DiputadoRecord[] = [];

  for (const r of roster) {
    const p = profiles.get(r.slug);
    if (!p) continue;
    const profileUrl = `${DELFINO}/asamblea/congresistas/${r.slug}`;
    const profileSrc = [src(profileUrl, new Date().toISOString())];

    const presencia = buildDimension(p.sesionesPct, sesionesTotales, MIN_SESIONES, profileSrc);
    const participacion = buildDimension(p.votacionesPct, votosTotales, MIN_VOTOS, profileSrc);

    // Productividad from Delfino proyectos count
    let productividad = null;
    if (p.proyectos !== null) {
      const score = computeProductividadScore(p.proyectos);
      const prod: import("../src/lib/data-types.ts").ProductividadScore = {
        presentados: p.proyectos,
        aprobados: 0, // not yet available from Delfino static HTML
        tasaAprobacion: 0,
        score,
        sources: profileSrc,
      };
      productividad = prod;
    }

    const medios = mediosMap.get(r.slug) ?? null;
    const ov = overrides.find((o) => o.slug === r.slug);
    const status: Status = ov?.status ?? "EN_EJERCICIO";

    const overall = computeOverall(
      status,
      presencia,
      participacion,
      productividad?.score ?? null,
      null, // transparencia — not yet automated
      null, // gasto — ₡0 for new legislature
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
      gasto: null,         // Asamblea vehicle data not yet available for 2026-2030
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
  console.log(`\n📊 REPORT`);
  console.log(`   ${diputados.length}/57 diputados`);
  console.log(`   ${sesionesTotales} sesiones · ${votosTotales} votaciones · fasePreliminar=${cohort.fasePreliminar}`);
  console.log(`   ${ranked} clasificados · ${conProyectos} con proyectos · ${conMedios} con datos de medios`);
}

main().catch((e) => {
  console.error("INGEST FAILED:", e);
  process.exit(1);
});
