// Canonical data contract for the real-data MVP.
// The ingest pipeline (scripts/ingest.ts) WRITES this shape into src/data/diputados.json;
// the app READS it via src/lib/data.ts. Both sides import these types — single source of truth.

export type Partido = "PPSO" | "PLN" | "FA" | "CAC" | "PUSC";

export type Provincia =
  | "San José"
  | "Alajuela"
  | "Cartago"
  | "Heredia"
  | "Guanacaste"
  | "Puntarenas"
  | "Limón";

/** Whether the diputado/a is sitting. Only EN_EJERCICIO is scored/ranked. Never inferred from absences. */
export type Status = "EN_EJERCICIO" | "EN_LICENCIA" | "NO_SE_INCORPORO" | "CESO";

export type VoteChoice = "a_favor" | "en_contra" | "abstencion" | "ausente";

/** Provenance: every displayed number must trace to a source URL + the moment it was retrieved. */
export interface SourceRef {
  url: string;
  retrievedAt: string; // ISO 8601
}

/** A scored dimension computed from primary records (no imputation). */
export interface DimensionScore {
  pct: number; // 0..1, the source's published rate (drives score + displayed %), NOT re-quantized from hits
  hits: number; // approximate count = round(pct * eligible); displayed with a "~" prefix
  eligible: number; // sesiones / votos held during tenure (sample size)
  gated: boolean; // true when n < MIN_SAMPLE → "preliminar", no 1–10
  score: number | null; // 1..10, or null when gated / no data
  sources: SourceRef[];
}

/** A bill the diputado/a was associated with — shown as an attributed FACT, never scored. */
export interface BillRef {
  expediente: string;
  titulo: string;
  fecha: string; // ISO
  resultado: string; // "Aprobado" | "Rechazado" | ...
  tipo: "proyecto" | "mocion";
  url: string;
}

/** Expense lines reported by Delfino — attributed FACTS, never scored. */
export interface Gastos {
  vehiculoCombustible: string | null;
  viajesInternacionales: string | null;
  sources: SourceRef[];
}

/** Scored dimension: legislative productivity (bills presented + approval rate). */
export interface ProductividadScore {
  presentados: number;       // total bills/motions filed
  aprobados: number;         // of those, how many passed
  tasaAprobacion: number;    // 0..1
  score: number | null;      // 1..10
  sources: SourceRef[];
}

/** Scored dimension: media presence in Costa Rican press (weekly scrape). */
export interface MediosScore {
  articulosSemana: number;   // articles mentioning the diputado in the last 7 days
  articulosMes: number;      // articles in the last 30 days
  ultimaFecha: string | null; // ISO date of most recent article found
  score: number | null;      // 1..10 (based on presence + sentiment)
  sources: SourceRef[];
}

/** Scored dimension: compliance with CGR asset declaration (Declaración Jurada de Bienes). */
export interface TransparenciaScore {
  djbPresentada: boolean | null; // null = no data yet
  score: number | null;          // 10 if presented on time, 2 if moroso, null if unknown
  sources: SourceRef[];
}

/** Scored dimension: discretionary spending relative to cohort. Lower spend = higher score. */
export interface GastoScore {
  totalColones: number | null;          // raw total (vehicle + travel)
  promedioCohorteColones: number | null;
  rangoEnCohort: "bajo" | "medio" | "alto" | null;
  score: number | null;                 // 1..10 (bajo→9-10, medio→5-7, alto→1-3)
  sources: SourceRef[];
}

export interface DiputadoRecord {
  id: string; // slug — canonical public id and route param
  cedula: string | null; // INTERNAL identity key only — never rendered publicly (Ley 8968)
  nombre: string;
  aliases: string[]; // cross-source name variants resolved to this record
  partido: Partido;
  provincia: Provincia;
  cargo: string | null; // e.g. "Jefe de fracción", "Presidente del Directorio"
  status: Status;
  photoUrl: string | null;
  tenureStart: string; // ISO
  tenureEnd: string | null;

  presencia: DimensionScore | null;         // 15% weight — plenary attendance
  participacion: DimensionScore | null;     // 20% weight — roll-call voting
  productividad: ProductividadScore | null; // 20% weight — bills presented/approved
  transparencia: TransparenciaScore | null; // 15% weight — CGR DJB compliance
  gasto: GastoScore | null;                 // 10% weight — spending vs cohort
  medios: MediosScore | null;               // 20% weight — media presence (weekly)
  overall: number | null; // null when gated or non-sitting
  ranked: boolean; // included in the numeric ranking?

  proyectosPresentados: { value: number; sources: SourceRef[] } | null; // attributed fact (legacy)
  gastos: Gastos | null; // attributed facts (legacy display)
  bills: BillRef[]; // recent votes/bills involving this diputado/a

  sources: SourceRef[]; // profile-level provenance
}

export interface Snapshot {
  generatedAt: string; // ISO — drives the "última actualización" stamp
  periodo: string; // "2026-2030"
  cohort: {
    sesionesTotales: number;
    votosTotales: number;
    fasePreliminar: boolean; // cohort below MIN_SAMPLE → site-wide preliminar banner
    fuente: string; // attribution string, e.g. "Delfino.cr · actos legislativos públicos"
    transparenciaEstimada?: boolean; // true when DJB data is not yet verified with CGR
    transparenciaNota?: string;
  };
  diputados: DiputadoRecord[];
}

export const PROVINCIAS: Provincia[] = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
];

export const PARTIDO_LABEL: Record<Partido, string> = {
  PPSO: "Pueblo Soberano",
  PLN: "Liberación Nacional",
  FA: "Frente Amplio",
  CAC: "Coalición Agenda Ciudadana",
  PUSC: "Unidad Social Cristiana",
};

export const STATUS_LABEL: Record<Status, string> = {
  EN_EJERCICIO: "En ejercicio",
  EN_LICENCIA: "En licencia",
  NO_SE_INCORPORO: "No se incorporó",
  CESO: "Cesó",
};
