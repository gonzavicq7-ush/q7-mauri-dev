import Image from "next/image";
import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Servicios",
};

const services = [
  {
    title: "Oracle APEX y soluciones empresariales",
    text: "Aplicaciones internas, modernización y evolución funcional para procesos críticos del negocio.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Infraestructura y operación tecnológica",
    text: "Servidores, entornos híbridos, redes y base operativa para sostener servicios con continuidad.",
    image:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Automatización e integración",
    text: "Workflow, integración entre sistemas y automatización para reducir fricción y errores manuales.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function ServiciosPage() {
  return (
    <main>
      <PageHero
        eyebrow="Servicios"
        title="Tres líneas de trabajo, sin exceso de capas ni humo."
        description="Nos enfocamos en resolver necesidades concretas con una base técnica sólida y una entrega entendible."
      />

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:px-10 md:grid-cols-3 lg:py-20">
        {services.map((service, index) => (
          <article key={service.title} className="panel rounded-[1.75rem] overflow-hidden">
            <Image src={service.image} alt={service.title} width={1200} height={800} className="h-48 w-full object-cover" />
            <div className="p-6">
              <p className="text-sm font-medium text-cyan-300">0{index + 1}</p>
              <h2 className="mt-4 text-xl font-semibold text-white">{service.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{service.text}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
