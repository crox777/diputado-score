// Presentational helpers shared by the App Router pages and components.
// Pure UI — color maps keyed by the ScoreColor bands, name initials, and es-CR date stamps.

import type { ScoreColor } from "./score";

export const SCORE_TEXT: Record<ScoreColor, string> = {
  gold: "text-amber-400",
  green: "text-emerald-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red: "text-rose-400",
  gray: "text-zinc-400",
};

export const SCORE_PILL_BG: Record<ScoreColor, string> = {
  gold: "bg-amber-500",
  green: "bg-emerald-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-rose-500",
  gray: "bg-zinc-600",
};

export const RING_COLOR: Record<ScoreColor, string> = {
  gold: "ring-amber-400/70",
  green: "ring-emerald-400/70",
  yellow: "ring-yellow-400/70",
  orange: "ring-orange-500/70",
  red: "ring-rose-500/70",
  gray: "ring-zinc-600/60",
};

export const BAR_COLOR: Record<ScoreColor, string> = {
  gold: "bg-amber-400",
  green: "bg-emerald-400",
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red: "bg-rose-500",
  gray: "bg-zinc-600",
};

export const ACCENT_GRADIENT: Record<ScoreColor, string> = {
  gold: "from-amber-400/20 to-transparent",
  green: "from-emerald-400/15 to-transparent",
  yellow: "from-yellow-400/15 to-transparent",
  orange: "from-orange-500/15 to-transparent",
  red: "from-rose-500/15 to-transparent",
  gray: "from-zinc-500/10 to-transparent",
};

/** First letters of the first two words, for the photo fallback circle. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}

/** Long es-CR date, e.g. "25 de junio de 2026". Empty string for invalid input. */
export function formatDateCR(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" });
}

/** Short es-CR date, e.g. "25 jun 2026". Empty string for invalid input. */
export function formatDateShortCR(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
}
