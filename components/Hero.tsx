/** Encabezado editorial reutilizable para cada vista. */
export default function Hero({
  kicker,
  titulo,
  resaltado,
  descripcion,
}: {
  kicker: string;
  titulo: string;
  resaltado: string;
  descripcion: string;
}) {
  return (
    <section className="animate-fade-up">
      <span className="bg-savia-lime/25 text-savia-forest text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-widest uppercase mb-4 inline-block">
        {kicker}
      </span>
      <h2 className="text-[2.75rem] sm:text-[3.25rem] font-black leading-[0.95] tracking-tighter text-savia-forest mb-4">
        {titulo} <br />
        <span className="text-savia-green">{resaltado}</span>
      </h2>
      <p className="text-brand-muted text-lg leading-relaxed max-w-2xl">
        {descripcion}
      </p>
    </section>
  );
}
