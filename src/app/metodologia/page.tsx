export const revalidate = 86400;

import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getGeneratedAt } from "@/lib/data";
import { MIN_SESIONES, MIN_VOTOS } from "@/lib/score";
import { formatDateCR } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Metodología — DiputadoScore",
  description:
    "Cómo se calculan la presencia y la participación de los diputados a partir del registro legislativo público.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] pt-6">
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function MetodologiaPage() {
  const today = formatDateCR(new Date().toISOString());

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      <SiteHeader active="metodologia" width="max-w-3xl" />

      <main className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-2">Metodología</h1>
          <p className="text-zinc-600 text-xs">Metodología · v1 · {today}</p>
        </div>

        <div className="space-y-8">
          <Section title="Las 5 dimensiones y su peso">
            <p>
              El puntaje general es un promedio ponderado de cinco dimensiones. Cada una tiene un
              peso distinto porque no todas reflejan el mismo nivel de responsabilidad legislativa:
            </p>
            <div className="mt-3 rounded-xl overflow-hidden ring-1 ring-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800/60 text-zinc-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Dimensión</th>
                    <th className="text-right px-4 py-2.5">Peso</th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ["Presencia en medios", "20%", "Observador.cr · prensa CR"],
                    ["Participación en votos", "20%", "Delfino.cr"],
                    ["Productividad legislativa", "20%", "Delfino.cr · SIL"],
                    ["Presencia en plenario", "15%", "Delfino.cr"],
                    ["Transparencia patrimonial", "15%", "CGR — Registro de DJB"],
                    ["Gasto discrecional", "10%", "Delfino.cr · Asamblea"],
                  ].map(([dim, peso, fuente]) => (
                    <tr key={dim} className="bg-zinc-900/40">
                      <td className="px-4 py-3 text-white font-medium">{dim}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold tabular-nums">{peso}</td>
                      <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{fuente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Cómo sube y cómo baja cada dimensión">
            <p><span className="text-white font-semibold">Participación en votos (25%):</span> Se
              considera voto emitido cualquier opción activa: a favor, en contra o abstención. Estar
              ausente en una votación penaliza más que faltar a la sesión completa, porque implica
              estar en el edificio y no ejercer el mandato.</p>
            <p><span className="text-white font-semibold">Presencia (20%):</span> Porcentaje de
              sesiones plenarias con asistencia sobre el total celebradas durante el ejercicio.
              La escala es absoluta: 92% de asistencia equivale a 9.2.</p>
            <p><span className="text-white font-semibold">Productividad (20%):</span> Combina la
              cantidad de proyectos de ley y mociones presentados con la tasa de aprobación. Presentar
              mucho y que nada avance da menos puntaje que presentar poco con impacto real.</p>
            <p><span className="text-white font-semibold">Transparencia (20%):</span> Binario. Presentó
              la Declaración Jurada de Bienes (DJB) a la CGR en tiempo → 10. Figura en la lista de
              morosos → 2. Es la penalización más severa porque es un incumplimiento legal.</p>
            <p><span className="text-white font-semibold">Gasto (10%):</span> El gasto discrecional
              del diputado (vehículo, combustible, viajes) se compara con el promedio del cohort.
              Gastar menos que el promedio suma; gastar muy por encima resta.</p>
            <p><span className="text-white font-semibold">Presencia en medios (20%):</span> Menciones
              semanales en medios costarricenses (Observador.cr y otros). Un diputado visible y activo
              en la esfera pública genera cobertura periodística; la invisibilidad penaliza.
              Se actualiza cada lunes automáticamente.</p>
          </Section>

          <Section title="Muestra mínima">
            <p>
              Presencia y participación solo reciben nota cuando hay al menos {MIN_SESIONES} sesiones
              o {MIN_VOTOS} votaciones registradas. Por debajo de ese umbral se muestran como{" "}
              <em>Preliminar</em>. Las otras tres dimensiones se incorporan al puntaje general en
              cuanto hay dato disponible.
            </p>
          </Section>

          <Section title="Quiénes no se clasifican">
            <p>
              Los diputados en licencia, que no se incorporaron o que cesaron no se clasifican.
              Aparecen en la lista sin nota ni posición en el ranking.
            </p>
          </Section>

          <Section title="Fuentes de datos">
            <p>Usamos varias fuentes públicas, cada una para dimensiones específicas:</p>
            <ul className="list-disc list-inside space-y-1.5 mt-2 text-zinc-400">
              <li><span className="text-white">Delfino.cr</span> — asistencia al plenario, participación en votaciones y gasto discrecional.</li>
              <li><span className="text-white">Asamblea Legislativa</span> — registro de proyectos de ley y mociones (SIL).</li>
              <li><span className="text-white">Contraloría General de la República (CGR)</span> — Declaración Jurada de Bienes y lista de morosos.</li>
            </ul>
            <p className="mt-3">
              Cada cifra enlaza a su fuente original. Si ves un dato que no calza, revisá el
              registro original en la fuente indicada.
              {getGeneratedAt() && <> Última actualización: {formatDateCR(getGeneratedAt())}.</>}
            </p>
          </Section>

          <Section title="Independencia">
            <p>
              Proyecto independiente. No está afiliado a la Asamblea Legislativa, a Delfino.cr,
              a la CGR ni a ningún partido político.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter width="max-w-3xl" />
    </div>
  );
}
