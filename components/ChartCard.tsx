import clsx from "clsx";

interface ChartCardProps {
  titulo: string;
  subtitulo?: string;
  /** Nodo a la derecha del encabezado (leyenda, filtro, etc.). */
  accion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Contenedor estándar para un gráfico: encabezado + cuerpo. */
export default function ChartCard({
  titulo,
  subtitulo,
  accion,
  className,
  children,
}: ChartCardProps) {
  return (
    <div className={clsx("card animate-fade-up", className)}>
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h4 className="text-lg font-bold text-savia-forest leading-tight">
            {titulo}
          </h4>
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
