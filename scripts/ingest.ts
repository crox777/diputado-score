/**
 * DiputadoScore — real-data ingest.
 *
 * Builds src/data/diputados.json from the public legislative record published by Delfino.cr
 * (robots-permitted; Anthropic crawlers explicitly whitelisted). Server-rendered HTML is
 * parsed with cheerio. NOTHING is fabricated: a value we cannot read stays null/gated.
 *
 * Per-diputado attendance and voting RATES come from each congresista's Delfino profile
 * ("Sesiones X%", "Votaciones Y%") — these are the published figures, attributed to Delfino.
 * The eligible denominators (sessions/votes held) are obtained by enumerating the real
 * session and vote pages by date, so the displayed "≈hits/eligible" is grounded in the
 * actual count of plenary events to date.
 *
 * Run: npx tsx scripts/ingest.ts
 */
import { load } from "cheerio";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDimension,
  computeOverall,
  isRanked,
  MIN_SESIONES,
  MIN_VOTOS,
} from "../src/lib/score.ts";
import type {
  DiputadoRecord,
  Gastos,
  Partido,
  Provincia,
  Snapshot,
  SourceRef,
  Status,
} from "../src/lib/data-types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "src", "data", "diputados.json");
const STATUS_OVERRIDES = join(ROOT, "src", "data", "status-overrides.json");

const BASE = "https://delfino.cr";
const PROVINCIAS: Provincia[] = [
  "San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón",
];
const PARTY_BY_ALT: Record<string, Partido> = {
  "Partido Pueblo Soberano": "PPSO",
  "Partido Liberación Nacional": "PLN",
  "Partido Frente Amplio": "FA",
  "Coalición Agenda Ciudadana": "CAC",
  "Partido Unidad Social Cristiana": "PUSC",
};
const TENURE_START = "2026-05-01";

// ── throttled, cached fetch ────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cachePath(kind: string, id: string) {
  return join(RAW, kind, `${id}.html`);
}
async function fetchHtml(
  url: string,
  kind: string,
  id: string,
  { allow404 = false } = {}
): Promise<{ status: number; html: string | null }> {
  const cp = cachePath(kind, id);
  if (existsSync(cp)) return { status: 200, html: readFileSync(cp, "utf8") };
  let delay = 500;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "DiputadoScore/1.0 (transparencia CR; contacto )",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404 && allow404) return { status: 404, html: null };
      if (res.status === 200) {
        const html = await res.text();
        mkdirSync(dirname(cp), { recursive: true });
        writeFileSync(cp, html);
        await sleep(450);
        return { status: 200, html };
      }
      await sleep(delay); // rate-limit / 5xx → back off
      delay *= 2;
    } catch {
      await sleep(delay);
      delay *= 2;
    }
  }
  return { status: 0, html: null };
}

const now = () => new Date().toISOString();
const src = (url: string): SourceRef => ({ url, retrievedAt: now() });

// ── roster from the congresistas list page ─────────────────────────────────
interface RosterEntry {
  slug: string;
  nombre: string;
  partido: Partido;
  provincia: Provincia;
  cargo: string | null;
  photoUrl: string | null;
}

async function getRoster(): Promise<RosterEntry[]> {
  const { html } = await fetchHtml(`${BASE}/asamblea/congresistas`, "list", "congresistas");
  if (!html) throw new Error("could not fetch congresistas list");
  const $ = load(html);
  const seen = new Set<string>();
  const roster: RosterEntry[] = [];
  $('a[href^="/asamblea/congresistas/"]').each((_, a) => {
    const href = $(a).attr("href")!;
    const slug = href.split("/").pop()!;
    if (slug.startsWith("page-") || seen.has(slug)) return;
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
    const provincia = (PROVINCIAS.find((p) => text.includes(p)) || "San José") as Provincia;
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

// ── per-diputado profile: cédula + the published rates + facts ─────────────
interface ProfileData {
  cedula: string | null;
  sesionesPct: number | null;
  votacionesPct: number | null;
  proyectos: number | null;
  gastos: Gastos | null;
  photoUrl: string | null;
}
function parseProfile(html: string, url: string): ProfileData {
  const $ = load(html);
  const text = $("body").text().replace(/​/g, "").replace(/\s+/g, " ");
  const cedula = text.match(/C[ée]dula\s*(\d-\d{3,4}-\d{4})/)?.[1] ?? null;
  const ses = text.match(/Sesiones\s*([\d.]+)\s*%/)?.[1];
  const vot = text.match(/Votaciones\s*([\d.]+)\s*%/)?.[1];
  const proy = text.match(/Proyectos presentados\s*(\d+)/)?.[1];
  const gasolina = text.match(/(?:Uso de gasolina|combustible)[^₡]*₡\s*([\d.,]+)/i)?.[1];
  const viajes = text.match(/viajes\s*(\d+)/i)?.[1];
  const gastoInc = text.match(/Gasto incurrido\s*₡\s*([\d.,]+)/i)?.[1];
  const gastos: Gastos | null =
    gasolina || viajes || gastoInc
      ? {
          vehiculoCombustible: gasolina ? `₡${gasolina}` : null,
          viajesInternacionales: viajes
            ? `${viajes} viaje(s)${gastoInc ? ` · ₡${gastoInc}` : ""}`
            : null,
          sources: [src(url)],
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
  return {
    cedula,
    sesionesPct: ses ? parseFloat(ses) : null,
    votacionesPct: vot ? parseFloat(vot) : null,
    proyectos: proy ? parseInt(proy, 10) : null,
    gastos,
    photoUrl,
  };
}

// ── enumerate real session & vote counts (the eligible denominators) ───────
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
      const { status } = await fetchHtml(
        `${BASE}/asamblea/asistencia/${id}`,
        "asistencia",
        id,
        { allow404: true }
      );
      if (status === 200) dates.push(ymd);
      else if (seq === 1) break;
    }
  }
  return dates;
}

/**
 * Delfino returns HTTP 200 for non-existent vote ids (soft-404), so existence MUST be judged
 * by content: a real roll-call vote page carries an "Expediente NNNNN" and the full ~57 voter
 * cards. Real seqs form a contiguous block per date, so we stop after several consecutive misses.
 */
function isRealVotePage(html: string): boolean {
  const $ = load(html);
  const voters = new Set(
    $('a[href^="/asamblea/congresistas/"]')
      .toArray()
      .map((a) => $(a).attr("href")!)
      .filter((h) => !/page-/.test(h))
  );
  return voters.size >= 50 && /Expediente\s*\d/.test($("body").text());
}

async function countVotes(sessionDates: string[]): Promise<number> {
  let total = 0;
  for (const ymd of sessionDates) {
    for (const tipo of ["proyecto", "mocion"] as const) {
      let misses = 0;
      for (let seq = 1; seq <= 100 && misses < 6; seq++) {
        const id = `${ymd}${String(seq).padStart(3, "0")}`;
        const { html } = await fetchHtml(
          `${BASE}/asamblea/votaciones/${tipo}/${id}`,
          `votaciones-${tipo}`,
          id,
          { allow404: true }
        );
        if (html && isRealVotePage(html)) {
          total++;
          misses = 0;
        } else misses++;
      }
    }
  }
  return total;
}

// ── assemble ───────────────────────────────────────────────────────────────
async function main() {
  const todayISO = new Date().toISOString().slice(0, 10);
  console.log("[1/4] roster…");
  const roster = await getRoster();
  console.log(`      ${roster.length} congresistas`);
  if (roster.length !== 57) console.warn(`      ⚠ expected 57, got ${roster.length}`);

  const overrides: { cedula: string; status: Status }[] = existsSync(STATUS_OVERRIDES)
    ? JSON.parse(readFileSync(STATUS_OVERRIDES, "utf8"))
    : [];
  if (!existsSync(STATUS_OVERRIDES)) writeFileSync(STATUS_OVERRIDES, "[]\n");

  console.log("[2/4] sessions & votes held (eligible denominators)…");
  const sessionDates = await countSessions(todayISO);
  const sesionesTotales = sessionDates.length;
  const votosTotales = await countVotes(sessionDates);
  console.log(`      ${sesionesTotales} sesiones · ${votosTotales} votaciones`);

  console.log("[3/4] profiles…");
  const diputados: DiputadoRecord[] = [];
  for (const r of roster) {
    const url = `${BASE}/asamblea/congresistas/${r.slug}`;
    const { html } = await fetchHtml(url, "profile", r.slug);
    if (!html) {
      console.warn(`      ⚠ no profile for ${r.slug}`);
      continue;
    }
    const p = parseProfile(html, url);
    const profileSrc = [src(url)];

    const presencia =
      p.sesionesPct !== null && sesionesTotales > 0
        ? buildDimension(
            Math.round((p.sesionesPct / 100) * sesionesTotales),
            sesionesTotales,
            MIN_SESIONES,
            profileSrc
          )
        : null;
    const participacion =
      p.votacionesPct !== null && votosTotales > 0
        ? buildDimension(
            Math.round((p.votacionesPct / 100) * votosTotales),
            votosTotales,
            MIN_VOTOS,
            profileSrc
          )
        : null;

    const ov = overrides.find((o) => o.cedula && o.cedula === p.cedula);
    const status: Status = ov?.status ?? "EN_EJERCICIO";
    const overall = computeOverall(status, presencia, participacion);

    diputados.push({
      id: r.slug,
      cedula: p.cedula,
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
      overall,
      ranked: isRanked({ status, overall }),
      proyectosPresentados:
        p.proyectos !== null ? { value: p.proyectos, sources: profileSrc } : null,
      gastos: p.gastos,
      bills: [],
      sources: profileSrc,
    });
  }

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    periodo: "2026-2030",
    cohort: {
      sesionesTotales,
      votosTotales,
      fasePreliminar: sesionesTotales < MIN_SESIONES || votosTotales < MIN_VOTOS,
      fuente: "Delfino.cr · registro de asistencia y votaciones del plenario",
    },
    diputados,
  };

  console.log("[4/4] write…");
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + "\n");
  if (snapshot.diputados.length >= 50) {
    writeFileSync(OUT, readFileSync(tmp));
    console.log(`✓ wrote ${snapshot.diputados.length} diputados → ${OUT}`);
  } else {
    throw new Error(`refusing to promote: only ${snapshot.diputados.length} diputados`);
  }
  console.log(
    `\nREPORT: ${diputados.length}/57 diputados · ${sesionesTotales} sesiones · ${votosTotales} votos · fasePreliminar=${snapshot.cohort.fasePreliminar} · ranked=${diputados.filter((d) => d.ranked).length} · sinDatos=${diputados.filter((d) => d.overall === null).length}`
  );
}

main().catch((e) => {
  console.error("INGEST FAILED:", e);
  process.exit(1);
});
