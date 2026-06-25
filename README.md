# DiputadoScore 🏛️

Presencia y participación de los 57 diputados de Costa Rica (2026–2030), a partir del registro público del plenario.

## Qué mide

- **Presencia** — asistencia al plenario: sesiones presentes sobre sesiones celebradas.
- **Participación** — voto: votos emitidos sobre votaciones registradas.

Cada eje se mapea a una nota absoluta de 0 a 10 (un 92 % equivale a 9.2), nunca relativa al resto. Los proyectos presentados y los gastos se muestran como hechos atribuidos a la fuente, sin nota. Cada cifra enlaza a su origen en Delfino.cr con la fecha en que se obtuvo.

## Arquitectura

No hay base de datos. La app renderiza un único snapshot versionado, `src/data/diputados.json`, que produce sin conexión `scripts/ingest.ts` (scraper de Delfino.cr con throttling). En tiempo de build Next.js prerenderiza las páginas a partir de ese JSON; en producción no se toca ninguna fuente externa ni se requiere ninguna variable de entorno.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

El snapshot ya viene cargado, así que la app corre sin pasos previos.

### Actualizar los datos

```bash
npm run ingest     # reconstruye src/data/diputados.json desde Delfino.cr
```

`ingest` exige resolver exactamente 57 diputados y escribe el snapshot de forma atómica; si la fuente cambia de estructura, falla en vez de publicar datos parciales. Tras correrlo, se hace commit del JSON y se redespliega.

### Pruebas y verificación

```bash
npm test           # scoring puro: mapeo de porcentaje, gating, no-imputación
npm run build      # build de producción + chequeo de tipos
npm run lint
```

## Deploy en Vercel

Cero configuración: Vercel detecta Next.js y no hacen falta variables de entorno ni base de datos.

**Opción A — CLI (sin GitHub):**

```bash
npx vercel          # primera vez: login + vincula el proyecto
npx vercel --prod   # despliega a producción
```

**Opción B — Git:**

1. Subí el repo a GitHub.
2. En Vercel: *New Project* → importá el repo. La región queda fijada en `iad1` por `vercel.json`.
3. Cada push a `main` despliega solo.

Para refrescar los datos en cualquiera de las dos: `npm run ingest`, commit del snapshot y redeploy (push, o `npx vercel --prod`).

## Estructura

```
src/
├── app/
│   ├── page.tsx                 # Grid de tarjetas + filtros
│   ├── rankings/page.tsx        # Ranking de mejor a peor
│   ├── diputados/[id]/page.tsx  # Perfil por diputado
│   ├── metodologia/page.tsx     # Cómo se calcula
│   └── layout.tsx               # Layout raíz (lang=es)
├── components/                  # PoliticianCard, SearchBar, FilterBar, SiteHeader, SiteFooter
├── lib/
│   ├── data.ts                  # Lectura del snapshot
│   ├── data-types.ts            # Contrato de datos
│   ├── score.ts                 # Scoring puro (+ score.test.ts)
│   └── ui.ts                    # Formato de fechas/UI
└── data/
    ├── diputados.json           # Snapshot publicado (fuente de la verdad en runtime)
    └── status-overrides.json    # Estado manual (licencia / no incorporado)
scripts/
└── ingest.ts                    # Scraper de Delfino.cr → snapshot
```

## Fuente

Asamblea Legislativa de Costa Rica vía [Delfino.cr](https://delfino.cr/asamblea). Proyecto independiente, sin afiliación a la Asamblea, a Delfino.cr ni a ningún partido.
