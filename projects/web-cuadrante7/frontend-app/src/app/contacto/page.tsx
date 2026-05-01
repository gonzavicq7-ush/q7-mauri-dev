import Image from "next/image";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/page-hero";

export default function ContactoPage() {
  return (
    <main>
      <PageHero
        eyebrow="Contacto"
        title="Si hay una necesidad concreta, la revisamos y la ordenamos."
        description="Contame qué querés resolver y te propongo una forma simple de encararlo."
      />

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
        <article className="panel rounded-[2rem] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1523966211575-eb4a01e7dd51?auto=format&fit=crop&w=1400&q=80"
            alt="Reunión de trabajo y planificación"
            width={1400}
            height={900}
            className="h-72 w-full object-cover"
          />
          <div className="p-6 text-base leading-8 text-slate-300 md:p-8">
            <p>
              La idea es arrancar con una conversación corta y concreta para entender el
              problema, priorizar el enfoque y definir el siguiente paso útil.
            </p>
          </div>
        </article>

        <ContactForm />
      </section>
    </main>
  );
}
