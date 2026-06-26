export const revalidate = 86400;

import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getAllDiputados, getDiputadoById, getCohort } from "@/lib/data";
import { scoreColor } from "@/lib/score";
import { PARTIDO_LABEL, STATUS_LABEL } from "@/lib/data-types";
import type { DimensionScore, ProductividadScore, TransparenciaScore, GastoScore, SourceRef } from "@/lib/data-types";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  SCORE_TEXT,
  RING_COLOR,
  ACCENT_GRADIENT,
  initials,
  formatDateShortCR,
} from "@/lib/ui";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getAllDiputados().map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = getDiputadoById(id);
  return { title: d ? `${d.nombre} — DiputadoScore` : "DiputadoScore" };
}

function SourceLink({ sources }: { sources: SourceRef[] }) {
  const src = sources[0];
  if (!src) return null;
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[0.65rem] text-zinc-600 hover:text-emerald-400 transition-colors"
    >
      Fuente: Delfino.cr · actualizado {formatDateShortCR(src.retrievedAt)}
    </a>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  const color = scoreColor(score);
  return (
    <span className={`${SCORE_TEXT[color]} text-3xl font-black tabular-nums leading-none`}>
      {score === null
        ? <span className="text-base text-zinc-500 font-semibold">Preliminar</span>
        : score.toFixed(1)}
    </span>
  );
}

function DimensionCard({ title, weight, score, children }: {
  title: string; weight: string; score: number | null; children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <span className="text-[0.65rem] text-zinc-600 uppercase tracking-wider">{weight} del score</span>
        </div>
        <ScoreDisplay score={score} />
      </div>
      {children}
    </div>
  );
}

function AttendanceDim({ title, weight, unit, dim }: { title: string; weight: string; unit: string; dim: DimensionScore | null }) {
  return (
    <DimensionCard title={title} weight={weight} score={dim?.score ?? null}>
      {dim
        ? <><p className="text-sm text-zinc-400 tabular-nums">≈{dim.hits}/{dim.eligible} {unit} · {(dim.pct * 100).toFixed(1)}%</p><div className="mt-3"><SourceLink sources={dim.sources} /></div></>
        : <p className="text-sm text-zinc-600">Sin datos.</p>}
    </DimensionCard>
  );
}

function ProductividadDim({ dim }: { dim: ProductividadScore | null }) {
  return (
    <DimensionCard title="Productividad legislativa" weight="20%" score={dim?.score ?? null}>
      {dim ? (
        <>
          <p className="text-sm text-zinc-400">
            <span className="text-white font-bold">{dim.presentados}</span> proyectos presentados ·{" "}
            <span className="text-white font-bold">{dim.aprobados}</span> aprobados
          </p>
          <p className="text-xs text-zinc-600 mt-1">Tasa de aprobación: {(dim.tasaAprobacion * 100).toFixed(0)}%</p>
          <div className="mt-3"><SourceLink sources={dim.sources} /></div>
        </>
      ) : <p className="text-sm text-zinc-600">Sin datos.</p>}
    </DimensionCard>
  );
}

function TransparenciaDim({ dim, estimada }: { dim: TransparenciaScore | null; estimada?: boolean }) {
  return (
    <DimensionCard title="Transparencia patrimonial" weight="20%" score={dim?.score ?? null}>
      {dim ? (
        <>
          <p className="text-sm text-zinc-400">
            DJB ante CGR:{" "}
            {dim.djbPresentada === null
              ? <span className="text-zinc-500">Sin datos</span>
              : dim.djbPresentada
              ? <span className="text-emerald-400 font-semibold">Presentada ✓</span>
              : <span className="text-red-400 font-semibold">Moroso/a ✗</span>}
          </p>
          <p className="text-xs text-zinc-600 mt-1">Declaración Jurada de Bienes · CGR</p>
          {estimada && (
            <p className="text-[0.65rem] text-amber-600/80 mt-1.5">
              ⚠ Dato estimado — pendiente de verificación con CGR
            </p>
          )}
          <div className="mt-3"><SourceLink sources={dim.sources} /></div>
        </>
      ) : <p className="text-sm text-zinc-600">Sin datos.</p>}
    </DimensionCard>
  );
}

function GastoDim({ dim }: { dim: GastoScore | null }) {
  const rangoLabel = { bajo: "Bajo ✓", medio: "Medio", alto: "Alto ✗" };
  const rangoColor = { bajo: "text-emerald-400", medio: "text-yellow-400", alto: "text-red-400" };
  return (
    <DimensionCard title="Gasto discrecional" weight="15%" score={dim?.score ?? null}>
      {dim ? (
        <>
          <p className="text-sm text-zinc-400">
            Total:{" "}
            <span className="text-white font-bold">
              ₡{dim.totalColones?.toLocaleString("es-CR") ?? "—"}
            </span>
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Promedio cohort: ₡{dim.promedioCohorteColones?.toLocaleString("es-CR") ?? "—"} ·{" "}
            {dim.rangoEnCohort && (
              <span className={rangoColor[dim.rangoEnCohort]}>{rangoLabel[dim.rangoEnCohort]}</span>
            )}
          </p>
          <div className="mt-3"><SourceLink sources={dim.sources} /></div>
        </>
      ) : <p className="text-sm text-zinc-600">Sin datos.</p>}
    </DimensionCard>
  );
}

export default async function DiputadoPage({ params }: Props) {
  const { id } = await params;
  const d = getDiputadoById(id);
  if (!d) notFound();
  const cohort = getCohort();

  const sitting = d.status === "EN_EJERCICIO";
  const color = sitting ? scoreColor(d.overall) : "gray";

  const reportedGastos =
    d.gastos && (d.gastos.vehiculoCombustible !== null || d.gastos.viajesInternacionales !== null);
  const hasReported =
    (d.proyectosPresentados !== null && d.proyectosPresentados !== undefined) ||
    reportedGastos ||
    d.bills.length > 0;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <SiteHeader active="diputados" width="max-w-5xl" />

      <main className="max-w-5xl mx-auto px-5 pt-8 pb-16">
        {/* Hero */}
        <div className="relative bg-zinc-900 rounded-3xl overflow-hidden ring-1 ring-white/[0.06] mb-6">
          <div className={`absolute inset-0 bg-gradient-to-br ${ACCENT_GRADIENT[color]} pointer-events-none`} />

          <div className="relative p-7 sm:p-10">
            <div className="flex flex-col sm:flex-row items-start gap-7">
              {/* Photo */}
              <div
                className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ${RING_COLOR[color]} bg-zinc-800 flex-shrink-0 shadow-2xl shadow-black/50`}
              >
                {d.photoUrl ? (
                  <Image src={d.photoUrl} alt={d.nombre} fill sizes="96px" className="object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-400 select-none">
                    {initials(d.nombre)}
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-1.5">
                  {d.nombre}
                </h1>
                <p className="text-zinc-400 text-sm">{PARTIDO_LABEL[d.partido]}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-zinc-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    {d.provincia}
                  </span>
                  {d.cargo && <span className="text-zinc-600">· {d.cargo}</span>}
                </div>
                {!sitting && (
                  <span className="inline-flex items-center mt-3 text-[0.7rem] bg-zinc-800/80 text-zinc-400 px-2.5 py-1 rounded-full border border-zinc-700/60">
                    {STATUS_LABEL[d.status]} — no clasificado/a
                  </span>
                )}
              </div>

              {/* Big overall */}
              <div className="sm:flex-shrink-0 sm:text-right">
                {!sitting ? (
                  <span className="text-zinc-500 text-xl font-bold">Sin clasificar</span>
                ) : d.overall === null ? (
                  <span className="text-zinc-500 text-xl font-bold">Preliminar</span>
                ) : (
                  <span className={`${SCORE_TEXT[color]} text-[4.5rem] sm:text-[5.5rem] font-black tabular-nums leading-none tracking-tight`}>
                    {d.overall.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <AttendanceDim title="Presencia" weight="20%" unit="sesiones" dim={d.presencia} />
          <AttendanceDim title="Participación en votos" weight="25%" unit="votaciones" dim={d.participacion} />
          <ProductividadDim dim={d.productividad} />
          <TransparenciaDim dim={d.transparencia} estimada={cohort.transparenciaEstimada} />
          <GastoDim dim={d.gasto} />
        </div>

        {/* Datos reportados */}
        {hasReported && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-white">Datos reportados</h2>
            <p className="text-xs text-zinc-600 mt-1 mb-4">
              Hechos atribuidos a la fuente, no forman parte del puntaje.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.proyectosPresentados && (
                <div className="bg-zinc-900 rounded-xl ring-1 ring-white/[0.06] p-4">
                  <p className="text-[0.65rem] text-zinc-600 uppercase tracking-wider mb-1">
                    Proyectos presentados
                  </p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {d.proyectosPresentados.value}
                  </p>
                  <div className="mt-2">
                    <SourceLink sources={d.proyectosPresentados.sources} />
                  </div>
                </div>
              )}

              {d.gastos?.vehiculoCombustible && (
                <div className="bg-zinc-900 rounded-xl ring-1 ring-white/[0.06] p-4">
                  <p className="text-[0.65rem] text-zinc-600 uppercase tracking-wider mb-1">
                    Vehículo y combustible
                  </p>
                  <p className="text-lg font-bold text-white">{d.gastos.vehiculoCombustible}</p>
                  <div className="mt-2">
                    <SourceLink sources={d.gastos.sources} />
                  </div>
                </div>
              )}

              {d.gastos?.viajesInternacionales && (
                <div className="bg-zinc-900 rounded-xl ring-1 ring-white/[0.06] p-4">
                  <p className="text-[0.65rem] text-zinc-600 uppercase tracking-wider mb-1">
                    Viajes internacionales
                  </p>
                  <p className="text-lg font-bold text-white">{d.gastos.viajesInternacionales}</p>
                  <div className="mt-2">
                    <SourceLink sources={d.gastos.sources} />
                  </div>
                </div>
              )}
            </div>

            {d.bills.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-white mb-3">Votaciones recientes</h3>
                <div className="space-y-2.5">
                  {d.bills.map((bill) => (
                    <div
                      key={bill.expediente}
                      className="bg-zinc-900 rounded-xl ring-1 ring-white/[0.05] p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[0.65rem] font-mono text-zinc-600">
                            Exp. {bill.expediente}
                          </span>
                          <span className="text-[0.65rem] text-zinc-500">
                            {formatDateShortCR(bill.fecha)}
                          </span>
                          <span className="text-[0.65rem] font-semibold text-zinc-300">
                            {bill.resultado}
                          </span>
                        </div>
                        <p className="text-sm text-white leading-snug">{bill.titulo}</p>
                      </div>
                      {bill.url && (
                        <a
                          href={bill.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-zinc-600 hover:text-emerald-400 transition-colors mt-0.5"
                          aria-label={`Ver expediente ${bill.expediente}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <SiteFooter width="max-w-5xl" linkLabel="¿Ves un dato incorrecto? Metodología y correcciones" />
    </div>
  );
}
