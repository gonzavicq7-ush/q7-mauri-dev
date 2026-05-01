"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contactCta, mainNavigation, siteName } from "@/content/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          {siteName}
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Navegación principal">
          {mainNavigation.map((link) => {
            const isActive = link.href === "/" ? pathname === link.href : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? "bg-white/8 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href={contactCta.href}
          className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200 hover:text-white"
        >
          {contactCta.label}
        </Link>
      </div>
    </header>
  );
}
