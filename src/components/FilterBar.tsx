"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PROVINCIAS = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
];

const SORT_OPTIONS = [
  { value: "overall_desc", label: "Mejor puntaje" },
  { value: "overall_asc", label: "Menor puntaje" },
  { value: "name_asc", label: "Nombre A–Z" },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("provincia") ?? ""}
        onChange={(e) => updateParam("provincia", e.target.value)}
        aria-label="Filtrar por provincia"
        className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
      >
        <option value="">Todas las provincias</option>
        {PROVINCIAS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("sort") ?? "overall_desc"}
        onChange={(e) => updateParam("sort", e.target.value)}
        aria-label="Ordenar"
        className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
