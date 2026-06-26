// Pure, deterministic scoring for the real-data MVP.
//
// DESIGN: absolute, not peer-relative. A dimension's 1–10 is a direct transform of a real
// percentage (92% present → 9.2). This is interpretable, stable under roster changes, and
// removes the relative-scoring machinery (and its +1 bug) entirely.
//
// Two dimensions only — both computed from primary public records:
//   Presencia      = sesiones presente / sesiones celebradas (durante el ejercicio)
//   Participación  = votos emitidos    / votaciones celebradas (durante el ejercicio)
//                    (emitido = a favor | en contra | abstención; ausente NO cuenta)
//
// No imputation: a dimension with no data is null, never a default. A dimension below its
// sample gate is "preliminar" (score null), shown as raw counts.

import type { DimensionScore, DiputadoRecord, MediosScore, Status } from "./data-types";

/** Minimum sample before a dimension earns a 1–10 (below → "preliminar"). */
export const MIN_SESIONES = 10;
export const MIN_VOTOS = 20;

export function clamp(v: number, lo = 0, hi = 10): number {
  return Math.min(hi, Math.max(lo, v));
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Map a rate in [0,1] to a 1–10 score. 0.92 → 9.2. */
export function pctToScore(pct: number): number {
  return clamp(round1(pct * 10));
}

/**
 * Build a dimension from the source's PUBLISHED rate (`reportedPct`, 0–100) and the real number
 * of eligible events held during tenure. `pct` is the published rate (NOT re-quantized from a
 * count), so the score and the displayed % are the source's exact figure; `hits` is the
 * approximate derived count shown with a "~". Returns null when the rate is missing/non-finite
 * or there are no eligible events — no imputation; a dimension with no data is null, never a default.
 */
export function buildDimension(
  reportedPct: number | null,
  eligible: number,
  min: number,
  sources: DimensionScore["sources"]
): DimensionScore | null {
  if (
    reportedPct === null ||
    !Number.isFinite(reportedPct) ||
    !Number.isFinite(eligible) ||
    eligible <= 0
  ) {
    return null;
  }
  const pct = clamp(reportedPct / 100, 0, 1);
  const hits = Math.round(pct * eligible);
  const gated = eligible < min;
  return {
    pct,
    hits,
    eligible,
    gated,
    score: gated ? null : pctToScore(pct),
    sources,
  };
}

// Dimension weights — must sum to 1.0
// presencia 15 + participacion 20 + productividad 20 + transparencia 15 + gasto 10 + medios 20 = 100
const WEIGHTS = {
  presencia: 0.15,
  participacion: 0.20,
  productividad: 0.20,
  transparencia: 0.15,
  gasto: 0.10,
  medios: 0.20,
} as const;

/**
 * Score for media presence: based on article count in last 30 days (1–10).
 * Higher presence = higher score; sentiment not included here (qualitative only).
 */
export function computeMediosScore(m: Pick<MediosScore, "articulosMes">): number {
  const n = m.articulosMes;
  if (n === 0) return 1;
  if (n <= 2) return 3.5;
  if (n <= 5) return 5.5;
  if (n <= 10) return 7.5;
  if (n <= 20) return 8.5;
  return 9.5;
}

/**
 * Score for productivity: based on bills/motions presented.
 * Legislature is new, so scale is generous.
 */
export function computeProductividadScore(presentados: number): number {
  if (presentados === 0) return 2;
  if (presentados <= 1) return 4;
  if (presentados <= 3) return 6;
  if (presentados <= 6) return 7.5;
  if (presentados <= 10) return 8.5;
  return 9.5;
}

/**
 * Weighted overall across up to 6 dimensions. Re-normalises weights when dimensions are missing
 * so the score is always interpretable. Requires presencia + participacion past their gate;
 * the other dimensions are optional (contribute when present, skipped when null).
 */
export function computeOverall(
  status: Status,
  presencia: DimensionScore | null,
  participacion: DimensionScore | null,
  productividadScore: number | null = null,
  transparenciaScore: number | null = null,
  gastoScore: number | null = null,
  mediosScore: number | null = null,
): number | null {
  if (status !== "EN_EJERCICIO") return null;
  if (!presencia || !participacion) return null;
  if (presencia.score === null || participacion.score === null) return null;

  const dims: { score: number; weight: number }[] = [
    { score: presencia.score, weight: WEIGHTS.presencia },
    { score: participacion.score, weight: WEIGHTS.participacion },
  ];
  if (productividadScore !== null) dims.push({ score: productividadScore, weight: WEIGHTS.productividad });
  if (transparenciaScore !== null) dims.push({ score: transparenciaScore, weight: WEIGHTS.transparencia });
  if (gastoScore !== null) dims.push({ score: gastoScore, weight: WEIGHTS.gasto });
  if (mediosScore !== null) dims.push({ score: mediosScore, weight: WEIGHTS.medios });

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const weighted = dims.reduce((s, d) => s + d.score * d.weight, 0);
  return round1(weighted / totalWeight);
}

/** A diputado/a is ranked only when sitting and with a computed overall. */
export function isRanked(d: Pick<DiputadoRecord, "status" | "overall">): boolean {
  return d.status === "EN_EJERCICIO" && d.overall !== null;
}

export type ScoreColor = "gold" | "green" | "yellow" | "orange" | "red" | "gray";

/** Absolute bands: gold ≥85%, green ≥70%, yellow ≥55%, orange ≥40%, red below. null → gray. */
export function scoreColor(score: number | null): ScoreColor {
  if (score === null) return "gray";
  if (score >= 8.5) return "gold";
  if (score >= 7.0) return "green";
  if (score >= 5.5) return "yellow";
  if (score >= 4.0) return "orange";
  return "red";
}

/** Accent/case-insensitive folding for search and deterministic tiebreaks. */
export function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Deterministic ranking comparator: overall desc → presencia desc → folded name → cédula.
 * Unranked records sort after all ranked ones. Stable across ingests (no Math.random, no time).
 */
export function compareForRanking(a: DiputadoRecord, b: DiputadoRecord): number {
  const ar = isRanked(a);
  const br = isRanked(b);
  if (ar !== br) return ar ? -1 : 1;
  if (ar && br) {
    if (b.overall! !== a.overall!) return b.overall! - a.overall!;
    const ap = a.presencia?.score ?? -1;
    const bp = b.presencia?.score ?? -1;
    if (bp !== ap) return bp - ap;
  }
  const an = foldName(a.nombre);
  const bn = foldName(b.nombre);
  if (an !== bn) return an < bn ? -1 : 1;
  return a.id.localeCompare(b.id);
}

/** Returns records sorted for ranking, with a 1-based `rank` assigned to ranked rows (ties share a rank). */
export function withRanks(
  diputados: DiputadoRecord[]
): { d: DiputadoRecord; rank: number | null; tie: boolean }[] {
  const sorted = [...diputados].sort(compareForRanking);
  const out: { d: DiputadoRecord; rank: number | null; tie: boolean }[] = [];
  let lastOverall: number | null = null;
  let lastRank = 0;
  sorted.forEach((d, i) => {
    if (!isRanked(d)) {
      out.push({ d, rank: null, tie: false });
      return;
    }
    let rank: number;
    if (lastOverall !== null && d.overall === lastOverall) {
      rank = lastRank; // tie shares the prior rank
    } else {
      rank = i + 1;
      lastRank = rank;
      lastOverall = d.overall;
    }
    out.push({ d, rank, tie: false });
  });
  // mark ties (same rank appears >1)
  const counts = new Map<number, number>();
  out.forEach((o) => o.rank !== null && counts.set(o.rank, (counts.get(o.rank) ?? 0) + 1));
  out.forEach((o) => {
    if (o.rank !== null && (counts.get(o.rank) ?? 0) > 1) o.tie = true;
  });
  return out;
}
