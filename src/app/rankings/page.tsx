export const revalidate = 86400;

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllDiputados, getGeneratedAt } from "@/lib/data";
import { withRanks, scoreColor } from "@/lib/score";
import { PARTIDO_LABEL, STATUS_LABEL } from "@/lib/data-types";
import type { DiputadoRecord, DimensionScore } from "@/lib/data-types";
import { SCORE_TEXT, formatDateCR } from "@/lib/ui";

function dimCell(dim: DimensionScore | null) {
  if (!dim || dim.score === null) {
    return <span className="text-zinc-600">Prelim.</span>;
  }
  return <span className="text-zinc-300 tabular-nums">{dim.score.toFixed(1)}</span>;
}

function unrankedReason(d: DiputadoRecord): string {
  switch (d.status) {
    case "EN_LICENCIA":
      return "en licencia";
    case "NO_SE_INCORPORO":
      return "no se incorporó";
    case "CESO":
      return "cesó";
    default:
      return "muestra insuficiente";
  }
}

export default function RankingsPage() {
  const rows = withRanks(getAllDiputados());
  const ranked = rows.filter((r) => r.rank !== null);
  const unranked = rows.filter((r) => r.rank === null);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <SiteHeader active="rankings" width="max-w-4xl" />

      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            Rankings <span className="text-emerald-400">2026–2030</span>
          </h1>
          <p className="text-zinc-500 text-sm">
            Diputados ordenados por puntaje general.
            {getGeneratedAt() && (
              <span className="text-zinc-600"> · Actualizado {formatDateCR(getGeneratedAt())}</span>
            )}
          </p>
        </div>

        {ranked.length === 0 && unranked.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <p className="text-base font-medium">Datos en preparación.</p>
          </div>
        ) : (
          <>
            {ranked.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.65rem] uppercase tracking-widest text-zinc-600 border-b border-white/[0.06]">
                    <th className="py-2.5 pr-3 font-medium w-20">Posición</th>
                    <th className="py-2.5 px-3 font-medium">Diputado/a</th>
                    <th className="py-2.5 px-3 font-medium text-right w-24">Presencia</th>
                    <th className="py-2.5 px-3 font-medium text-right w-28">Participación</th>
                    <th className="py-2.5 pl-3 font-medium text-right w-20">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ d, rank, tie }) => (
                    <tr
                      key={d.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 pr-3 tabular-nums text-zinc-400 font-bold">
                        {rank}
                        {tie && <span className="text-zinc-600 font-normal"> (empate)</span>}
                      </td>
                      <td className="py-3 px-3">
                        <Link href={`/diputados/${d.id}`} className="group block">
                          <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {d.nombre}
                          </span>
                          <span className="block text-[0.7rem] text-zinc-600 mt-0.5">
                            {PARTIDO_LABEL[d.partido]} · {d.provincia}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-right">{dimCell(d.presencia)}</td>
                      <td className="py-3 px-3 text-right">{dimCell(d.participacion)}</td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={`${SCORE_TEXT[scoreColor(d.overall)]} text-base font-black tabular-nums`}
                        >
                          {d.overall === null ? "–" : d.overall.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {unranked.length > 0 && (
              <section className="mt-12">
                <h2 className="text-sm font-bold text-zinc-400 mb-3">No clasificados/as</h2>
                <ul className="divide-y divide-white/[0.04]">
                  {unranked.map(({ d }) => (
                    <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                      <Link href={`/diputados/${d.id}`} className="group min-w-0">
                        <span className="font-semibold text-zinc-300 group-hover:text-white transition-colors">
                          {d.nombre}
                        </span>
                        <span className="block text-[0.7rem] text-zinc-600 mt-0.5 truncate">
                          {PARTIDO_LABEL[d.partido]} · {d.provincia}
                        </span>
                      </Link>
                      <span className="text-[0.7rem] text-zinc-600 flex-shrink-0">
                        {STATUS_LABEL[d.status]} · {unrankedReason(d)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <SiteFooter width="max-w-4xl" />
    </div>
  );
}
