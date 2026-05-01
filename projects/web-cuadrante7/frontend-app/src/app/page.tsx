import Image from "next/image";
import Link from "next/link";

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

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-10 lg:py-24">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <p className="kicker">Cuadrante7</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl lg:leading-[1.05]">
            Soluciones técnicas simples, claras y realmente útiles.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Diseñamos e implementamos aplicaciones empresariales, infraestructura
            y automatización sin adornos innecesarios. La prioridad es que funcione,
            se entienda y pueda crecer.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/contacto" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Contactar
            </Link>
            <Link href="/servicios" className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-200">
              Ver servicios
            </Link>
          </div>
        </div>

        <div className="panel rounded-[2rem] p-4 md:p-6">
          <Image
            src={services[0].image}
            alt="Aplicación empresarial sobre Oracle APEX"
            width={1200}
            height={800}
            className="h-72 w-full rounded-[1.5rem] object-cover"
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="panel-muted rounded-2xl p-4 text-slate-200 sm:col-span-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-cyan-300">
                Enfoque
              </p>
              <p className="mt-2 leading-7">
                Resolver problemas reales con una base técnica ordenada y una narrativa comercial clara.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          ["Menos fricción", "Priorizamos orden, claridad y continuidad operativa."],
          ["Más utilidad", "Cada decisión busca resolver problemas reales."],
          ["Base para crecer", "La estructura queda lista para evolucionar."],
        ].map(([title, text]) => (
          <article key={title} className="panel-muted rounded-[1.5rem] p-6">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-3 leading-7 text-slate-300">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-3">
        {services.map((service, index) => (
          <article key={service.title} className="panel rounded-[1.75rem] overflow-hidden">
            <Image src={service.image} alt={service.title} width={1200} height={800} className="h-56 w-full object-cover" />
            <div className="p-6">
              <p className="text-sm font-medium text-cyan-300">0{index + 1}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{service.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{service.text}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
