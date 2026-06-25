import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pctToScore,
  buildDimension,
  computeOverall,
  scoreColor,
  foldName,
  withRanks,
  MIN_SESIONES,
  MIN_VOTOS,
} from "./score.ts";
import type { DiputadoRecord } from "./data-types.ts";

test("pctToScore maps rate to 1–10 absolutely", () => {
  assert.equal(pctToScore(1), 10);
  assert.equal(pctToScore(0.92), 9.2);
  assert.equal(pctToScore(0.5), 5);
  assert.equal(pctToScore(0), 0);
});

test("buildDimension uses the published rate and gates below MIN_SAMPLE", () => {
  const ok = buildDimension(90.3, 31, MIN_SESIONES, []);
  assert.ok(ok);
  assert.equal(ok.eligible, 31);
  assert.equal(ok.gated, false);
  assert.equal(ok.hits, Math.round(0.903 * 31));
  assert.equal(ok.score, pctToScore(0.903));

  const gated = buildDimension(80, 5, MIN_SESIONES, []);
  assert.ok(gated);
  assert.equal(gated.gated, true);
  assert.equal(gated.score, null, "below gate -> no 1-10");
});

test("buildDimension returns null for missing/non-finite rate or zero eligible (no imputation)", () => {
  assert.equal(buildDimension(null, 30, MIN_VOTOS, []), null);
  assert.equal(buildDimension(NaN, 30, MIN_VOTOS, []), null, "NaN must not impute a score");
  assert.equal(buildDimension(95, 0, MIN_VOTOS, []), null, "no eligible events -> null, not a default 5");
});

test("buildDimension clamps the rate to 100% (no >100%)", () => {
  const d = buildDimension(130, 31, MIN_SESIONES, []);
  assert.ok(d);
  assert.equal(d.hits, 31);
  assert.equal(d.score, 10);
});

test("computeOverall averages two dims only when sitting and both ungated", () => {
  const pres = buildDimension(100, 31, MIN_SESIONES, []); // 10
  const part = buildDimension(75, 200, MIN_VOTOS, []); // 7.5
  assert.equal(computeOverall("EN_EJERCICIO", pres, part), 8.8);
  assert.equal(computeOverall("EN_LICENCIA", pres, part), null, "non-sitting -> not scored");
  const gatedPart = buildDimension(80, 8, MIN_VOTOS, []);
  assert.equal(computeOverall("EN_EJERCICIO", pres, gatedPart), null, "gated dim -> no overall");
});

test("scoreColor uses absolute bands; null → gray", () => {
  assert.equal(scoreColor(9.0), "gold");
  assert.equal(scoreColor(7.4), "green");
  assert.equal(scoreColor(5.6), "yellow");
  assert.equal(scoreColor(4.1), "orange");
  assert.equal(scoreColor(2.0), "red");
  assert.equal(scoreColor(null), "gray");
});

test("foldName strips accents/case (search + tiebreak)", () => {
  assert.equal(foldName("José María Villalta"), "jose maria villalta");
  assert.equal(foldName("MUÑOZ"), "munoz");
});

function mkDip(over: Partial<DiputadoRecord>): DiputadoRecord {
  return {
    id: over.id ?? "x",
    cedula: over.cedula ?? null,
    nombre: over.nombre ?? "X",
    aliases: [],
    partido: "PPSO",
    provincia: "San José",
    cargo: null,
    status: over.status ?? "EN_EJERCICIO",
    photoUrl: null,
    tenureStart: "2026-05-01",
    tenureEnd: null,
    presencia: over.presencia ?? buildDimension(100, 31, MIN_SESIONES, []),
    participacion: over.participacion ?? buildDimension(100, 31, MIN_VOTOS, []),
    overall: over.overall ?? null,
    ranked: false,
    proyectosPresentados: null,
    gastos: null,
    bills: [],
    sources: [],
  };
}

test("withRanks ranks sitting+scored first, ties share a rank, unranked go last", () => {
  const a = mkDip({ id: "a", nombre: "Ana", overall: 9.0 });
  const b = mkDip({ id: "b", nombre: "Bruno", overall: 9.0 }); // tie with a
  const c = mkDip({ id: "c", nombre: "Caro", overall: 7.0 });
  const leave = mkDip({ id: "d", nombre: "Diego", status: "EN_LICENCIA", overall: null });
  const ranked = withRanks([c, leave, b, a]);
  const byId = Object.fromEntries(ranked.map((r) => [r.d.id, r]));
  assert.equal(byId["a"].rank, 1);
  assert.equal(byId["b"].rank, 1, "equal overall → shared rank");
  assert.equal(byId["a"].tie, true);
  assert.equal(byId["c"].rank, 3, "after the two tied at 1");
  assert.equal(byId["d"].rank, null, "non-sitting is unranked");
  assert.equal(ranked[ranked.length - 1].d.id, "d", "unranked sorts last");
});
