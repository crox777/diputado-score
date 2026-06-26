export const revalidate = 86400;

import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PoliticianCard } from "@/components/PoliticianCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { getAllDiputados, searchDiputados, getGeneratedAt, getCohort } from "@/lib/data";
import { withRanks, foldName } from "@/lib/score";
import { formatDateCR } from "@/lib/ui";
import type { DiputadoRecord } from "@/lib/data-types";

interface HomeProps {
  searchParams: Promise<{ q?: string; provincia?: string; sort?: string }>;
}

type Ordered = { d: DiputadoRecord; rank: number | null; tie: boolean };

function orderForDisplay(rows: DiputadoRecord[], sort: string): Ordered[] {
  if (sort === "name_asc") {
    return [...rows]
      .sort((a, b) => foldName(a.nombre).localeCompare(foldName(b.nombre)))
      .map((d) => ({ d, rank: null, tie: false }));
  }
  if (sort === "overall_asc") {
    const key = (d: DiputadoRecord) =>
      d.status === "EN_EJERCICIO" && d.overall !== null
        ? d.overall
        : Number.POSITIVE_INFINITY;
    return [...rows]
      .sort((a, b) => key(a) - key(b) || foldName(a.nombre).localeCompare(foldName(b.nombre)))
      .map((d) => ({ d, rank: null, tie: false }));
  }
  // default: best score first, with shared ranks
  return withRanks(rows);
}

export default async function Home({ searchParams }: HomeProps) {
  const { q = "", provincia = "", sort = "overall_desc" } = await searchParams;

  const hasData = getAllDiputados().length > 0;
  const results = searchDiputados(q, provincia);
  const ordered = orderForDisplay(results, sort);
  const cohort = getCohort();

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <SiteHeader active="diputados" />

      <main className="max-w-7xl mx-auto px-5 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-[0.7rem] font-semibold tracking-wide uppercase">
              Registro legislativo · Delfino.cr · Asamblea · CGR
            </span>
          </div>
          <h1 className="text-4xl sm:text-[3.25rem] font-black tracking-tight leading-[1.05] mb-4">
            ¿Y si la Asamblea Legislativa se jugara como un{" "}
            <span className="text-emerald-400">partido de fútbol</span>?
          </h1>
          <p className="text-zinc-300 text-lg sm:text-xl max-w-2xl leading-relaxed font-medium">
            Así rendirían nuestros diputados y esta sería su calificación.
          </p>
          <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed mt-3">
            Puntaje de los 57 diputados (2026–2030) basado en 5 dimensiones: presencia, participación
            en votos, productividad legislativa, transparencia patrimonial y gasto. Datos de{" "}
            <a href="https://delfino.cr/asamblea" target="_blank" rel="noopener noreferrer"
              className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-400">
              Delfino.cr
            </a>
            ,{" "}
            <a href="https://www.asamblea.go.cr" target="_blank" rel="noopener noreferrer"
              className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-400">
              Asamblea Legislativa
            </a>{" "}
            y{" "}
            <a href="https://www.cgr.go.cr" target="_blank" rel="noopener noreferrer"
              className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-400">
              CGR
            </a>
            .
          </p>
          {getGeneratedAt() && (
            <p className="text-zinc-600 text-xs mt-4">
              Actualizado {formatDateCR(getGeneratedAt())}
            </p>
          )}
        </div>

        {cohort.fasePreliminar && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-amber-300/90 text-sm">
            Fase preliminar: pocas sesiones registradas; los puntajes pueden variar.
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-8">
          <div className="flex-1">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <Suspense>
            <FilterBar />
          </Suspense>
        </div>

        {/* Count */}
        <div className="mb-6">
          <p className="text-zinc-600 text-xs font-medium tracking-widest uppercase">
            {ordered.length} diputados/as
            {q && <span className="text-zinc-500 normal-case ml-1.5">· &ldquo;{q}&rdquo;</span>}
            {provincia && <span className="text-zinc-500 normal-case ml-1.5">· {provincia}</span>}
          </p>
        </div>

        {/* Grid / empty states */}
        {ordered.length === 0 ? (
          <div className="text-center py-32 text-zinc-600">
            <p className="text-base font-medium">
              {hasData ? "No se encontraron diputados." : "Datos en preparación."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {ordered.map(({ d, rank, tie }) => (
              <PoliticianCard key={d.id} d={d} rank={rank} tie={tie} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
