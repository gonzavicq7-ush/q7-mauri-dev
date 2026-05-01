type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:px-10 lg:py-20">
      <div className="max-w-4xl space-y-5">
        <p className="kicker">{eyebrow}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl lg:leading-[1.05]">
          {title}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">{description}</p>
      </div>
    </section>
  );
}
