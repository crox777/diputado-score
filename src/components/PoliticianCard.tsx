import Link from "next/link";
import Image from "next/image";
import type { DiputadoRecord, DimensionScore } from "@/lib/data-types";
import { PARTIDO_LABEL } from "@/lib/data-types";
import { scoreColor } from "@/lib/score";
import { SCORE_PILL_BG, SCORE_TEXT, RING_COLOR, ACCENT_GRADIENT, initials } from "@/lib/ui";

interface Props {
  d: DiputadoRecord;
  rank?: number | null;
  tie?: boolean;
}

function DimChip({ label, dim }: { label: string; dim: DimensionScore | null }) {
  const score = dim?.score ?? null;
  const color = scoreColor(score);
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-zinc-700 text-[0.58rem] uppercase tracking-wider truncate">{label}</span>
      <span className={`${SCORE_TEXT[color]} text-[0.78rem] font-black tabular-nums leading-none`}>
        {score === null ? "–" : score.toFixed(1)}
      </span>
    </div>
  );
}

export function PoliticianCard({ d, rank, tie }: Props) {
  const sitting = d.status === "EN_EJERCICIO";
  const badge = !sitting ? "n/c" : d.overall === null ? "·" : d.overall.toFixed(1);
  const badgeColor = sitting ? scoreColor(d.overall) : "gray";

  return (
    <Link href={`/diputados/${d.id}`} className="block group">
      <div className="relative bg-zinc-900 rounded-2xl overflow-hidden ring-1 ring-white/[0.06] transition-all duration-200 ease-out hover:-translate-y-1.5 hover:ring-white/[0.10] hover:shadow-2xl hover:shadow-black/40">
        {/* Color strip */}
        <div className={`relative h-[3.75rem] bg-gradient-to-b ${ACCENT_GRADIENT[badgeColor]}`}>
          {rank != null && (
            <span className="absolute top-2.5 left-3 text-[0.6rem] font-bold text-white/25 tabular-nums">
              #{rank}
              {tie ? "·" : ""}
            </span>
          )}
        </div>

        {/* Photo + score badge */}
        <div className="flex justify-center -mt-9 relative z-10">
          <div className="relative">
            <div className={`w-[76px] h-[76px] rounded-full overflow-hidden ring-[2.5px] ${RING_COLOR[badgeColor]} bg-zinc-800 shadow-xl shadow-black/60`}>
              {d.photoUrl ? (
                <Image
                  src={d.photoUrl}
                  alt={d.nombre}
                  width={76}
                  height={76}
                  className="object-cover object-top w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[1.4rem] font-black text-zinc-400 select-none">
                  {initials(d.nombre)}
                </div>
              )}
            </div>

            <div className={`absolute -top-2 -left-2.5 ${SCORE_PILL_BG[badgeColor]} rounded-full px-1.5 py-[0.2rem] flex items-center shadow-lg ring-1 ring-black/20 whitespace-nowrap`}>
              <span className="text-[0.75rem] font-black tabular-nums leading-none text-white">
                {badge}
              </span>
            </div>
          </div>
        </div>

        {/* Name + party + province */}
        <div className="px-3 pt-4 pb-2.5 text-center">
          <h3 className="text-white font-bold text-[0.82rem] leading-tight line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
            {d.nombre}
          </h3>
          <p className="text-zinc-600 text-[0.6rem] mt-0.5 truncate leading-tight">
            {PARTIDO_LABEL[d.partido]}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <svg className="w-2 h-2 text-zinc-700 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span className="text-zinc-700 text-[0.6rem]">{d.provincia}</span>
          </div>
        </div>

        <div className="mx-3 h-px bg-white/[0.04]" />

        {/* Dimension chips */}
        <div className="px-3.5 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <DimChip label="Pres" dim={d.presencia} />
          <DimChip label="Part" dim={d.participacion} />
        </div>
      </div>
    </Link>
  );
}
