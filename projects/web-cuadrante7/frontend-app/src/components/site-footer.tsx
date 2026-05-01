import Link from "next/link";
import { mainNavigation, siteName } from "@/content/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-slate-400 md:px-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">{siteName}</p>
          <p className="leading-7">
            Soluciones empresariales sobre Oracle APEX, infraestructura y automatización.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-5">
            {mainNavigation.slice(1).map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <p>© {year} {siteName}</p>
        </div>
      </div>
    </footer>
  );
}
