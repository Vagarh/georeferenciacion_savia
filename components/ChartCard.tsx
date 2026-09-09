import clsx from "clsx";

interface ChartCardProps {
  titulo: string;
  subtitulo?: string;
  /** Nodo a la derecha del encabezado (leyenda, filtro, etc.). */
  accion?: React.ReactNode;
  /**
   * Marca si el panel reacciona a la barra de filtros:
   * "filtros" = se recalcula · "completo" = siempre período completo.
   */
  alcance?: "filtros" | "completo";
  className?: string;
  children: React.ReactNode;
}

export function AlcancePill({ alcance }: { alcance: "filtros" | "completo" }) {
  return alcance === "filtros" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-savia-mint bg-savia-ice px-2 py-0.5 text-[10px] font-bold text-savia-deep whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-savia-green" />
      Responde a filtros
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-gray3 bg-brand-low px-2 py-0.5 text-[10px] font-bold text-brand-gray1 whitespace-nowrap">
      Período completo
    </span>
  );
}

/** Contenedor estándar para un gráfico: encabezado + cuerpo. */
export default function ChartCard({
  titulo,
  subtitulo,
  accion,
  alcance,
  className,
  children,
}: ChartCardProps) {
  return (
    <div className={clsx("card animate-fade-up", className)}>
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-lg font-bold text-savia-forest leading-tight">
              {titulo}
            </h4>
            {alcance && <AlcancePill alcance={alcance} />}
          </div>
          {subtitulo && (
            <p className="text-sm text-brand-muted mt-0.5">{subtitulo}</p>
          )}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {children}
    </div>
  );
}

/** Leyenda inline reutilizable. */
export function Leyenda({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-brand-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
