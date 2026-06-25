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
          <Section title="Qué medimos">
            <p>
              La presencia mide la asistencia al plenario: sesiones en las que el diputado estuvo
              presente sobre el total de sesiones celebradas durante su ejercicio.
            </p>
            <p>
              La participación mide el voto: votos emitidos sobre votaciones celebradas. Se considera
              emitido un voto a favor, en contra o una abstención. La ausencia no cuenta como voto.
            </p>
          </Section>

          <Section title="Cómo se calcula el puntaje">
            <p>
              La escala es absoluta. El porcentaje real se mapea directamente a una nota de 0 a 10,
              de modo que un 92% equivale a 9.2. La nota no es relativa al resto de diputados, así
              que no cambia cuando otra persona sube o baja.
            </p>
          </Section>

          <Section title="Muestra mínima">
            <p>
              Un eje solo recibe nota cuando hay al menos {MIN_SESIONES} sesiones o {MIN_VOTOS}{" "}
              votaciones registradas. Por debajo de ese umbral el eje se marca como preliminar y se
              muestran los conteos crudos en lugar de una nota.
            </p>
          </Section>

          <Section title="Qué no puntúa">
            <p>
              Los proyectos presentados y los gastos se muestran como hechos atribuidos a la fuente,
              no como nota. No incluimos la declaración de bienes ni datos sin fuente verificable por
              persona.
            </p>
          </Section>

          <Section title="Correlación entre ejes">
            <p>
              La presencia y la participación están correlacionadas, porque votar requiere estar
              presente. Lo informamos de forma abierta para que el lector lo tenga en cuenta.
            </p>
          </Section>

          <Section title="Quiénes no se clasifican">
            <p>
              Los diputados en licencia o que no se incorporaron no se clasifican. Aparecen en la
              lista, pero sin nota ni posición en el ranking.
            </p>
          </Section>

          <Section title="Fuente y actualización">
            <p>
              El porcentaje de asistencia (Sesiones) y de participación (Votaciones) de cada
              congresista es el que publica su ficha en Delfino.cr. El total de sesiones del
              plenario y de votaciones registradas se cuenta directamente del registro público de
              Delfino.cr. La cantidad de sesiones y votos que se atribuye a cada persona se deriva
              de ese porcentaje, por lo que se muestra como una cifra aproximada.
              {getGeneratedAt() && <> Actualizado {formatDateCR(getGeneratedAt())}.</>}
            </p>
          </Section>

          <Section title="Independencia">
            <p>
              Este es un proyecto independiente. No está afiliado a la Asamblea Legislativa, a
              Delfino.cr ni a ningún partido.
            </p>
          </Section>

          <Section title="Correcciones">
            <p>
              Cada cifra publicada enlaza a su fuente. Si ves un dato incorrecto, escribí a{" "}
              <a
                href="mailto:"
                className="text-emerald-400 hover:underline"
              >
                
              </a>{" "}
              y lo revisamos contra el registro original.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter width="max-w-3xl" />
    </div>
  );
}
