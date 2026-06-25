// Read-only access to the committed data snapshot. The app never touches a database at
// runtime — it renders src/data/diputados.json, produced offline by scripts/ingest.ts.

import rawSnapshot from "@/data/diputados.json";
import type { DiputadoRecord, Snapshot } from "./data-types";
import { foldName } from "./score";

export const snapshot = rawSnapshot as unknown as Snapshot;

export function getCohort() {
  return snapshot.cohort;
}

export function getGeneratedAt(): string {
  return snapshot.generatedAt;
}

export function getAllDiputados(): DiputadoRecord[] {
  return snapshot.diputados;
}

export function getDiputadoById(id: string): DiputadoRecord | null {
  return snapshot.diputados.find((d) => d.id === id) ?? null;
}

/** Accent/case-insensitive filter by name (incl. aliases), party label, and province. */
export function searchDiputados(q = "", provincia = ""): DiputadoRecord[] {
  const fq = foldName(q);
  const fp = foldName(provincia);
  return snapshot.diputados.filter((d) => {
    const matchesQ =
      !fq ||
      foldName(d.nombre).includes(fq) ||
      d.aliases.some((a) => foldName(a).includes(fq)) ||
      foldName(d.partido).includes(fq);
    const matchesProv = !fp || foldName(d.provincia).includes(fp);
    return matchesQ && matchesProv;
  });
}
