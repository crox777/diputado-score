import Link from "next/link";
import Image from "next/image";

type NavKey = "diputados" | "rankings" | "metodologia";

const NAV: { href: string; key: NavKey; label: string }[] = [
  { href: "/", key: "diputados", label: "Diputados" },
  { href: "/rankings", key: "rankings", label: "Rankings" },
  { href: "/metodologia", key: "metodologia", label: "Metodología" },
];

/** Sticky top bar with brand mark and primary navigation. `width` matches the page container. */
export function SiteHeader({
  active,
  width = "max-w-7xl",
}: {
  active: NavKey;
  width?: string;
}) {
  return (
    <header className="sticky top-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-white/[0.05]">
      <div className={`${width} mx-auto px-5 h-14 flex items-center justify-between gap-4`}>
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="DiputadoScore" width={220} height={44} className="object-contain" />
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active === n.key
                  ? "text-white bg-white/[0.07]"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
