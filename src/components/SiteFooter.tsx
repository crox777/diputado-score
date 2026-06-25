import Link from "next/link";

/** Independence note plus a link into the methodology. `linkLabel` lets profile pages invite corrections. */
export function SiteFooter({
  width = "max-w-7xl",
  linkLabel = "Metodología",
}: {
  width?: string;
  linkLabel?: string;
}) {
  return (
    <footer className="mt-20 border-t border-white/[0.04] py-8">
      <div
        className={`${width} mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-zinc-700 text-xs`}
      >
        <p>
          Proyecto independiente. No afiliado a la Asamblea Legislativa, a Delfino.cr ni a ningún
          partido.
        </p>
        <Link href="/metodologia" className="text-zinc-600 hover:text-emerald-400 transition-colors">
          {linkLabel}
        </Link>
      </div>
    </footer>
  );
}
