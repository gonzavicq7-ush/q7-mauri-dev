import Image from "next/image";
import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Nosotros",
};

const points = [
  "Experiencia en aplicaciones empresariales, infraestructura e integración.",
  "Capacidad de diseño e implementación, no solo de recomendación.",
  "Enfoque sobrio, práctico y orientado a resultados sostenibles.",
];

export default function NosotrosPage() {
  return (
    <main>
      <PageHero
        eyebrow="Nosotros"
        title="Una consultora técnica orientada a hacer que las cosas funcionen."
        description="Cuadrante7 combina visión funcional, desarrollo, infraestructura y automatización para proyectos que necesitan claridad y ejecución."
      />

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <article className="panel rounded-[2rem] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80"
            alt="Equipo revisando una solución tecnológica"
            width={1400}
            height={900}
            className="h-72 w-full object-cover"
          />
          <div className="p-6 text-base leading-8 text-slate-300 md:p-8">
            <p>
              El objetivo no es sumar tecnología por sí misma, sino ayudar a construir,
              modernizar e integrar soluciones que funcionen bien en la práctica y puedan
              sostenerse con criterio técnico.
            </p>
          </div>
        </article>

        <div className="grid gap-4">
          {points.map((point) => (
            <article key={point} className="panel-muted rounded-[1.5rem] p-6 leading-7 text-slate-200">
              {point}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
