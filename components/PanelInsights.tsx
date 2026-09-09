import clsx from "clsx";
import { Lightbulb } from "lucide-react";

export interface Insight {
  tono?: "green" | "teal" | "gold" | "rose";
  icon?: React.ReactNode;
  titulo: string;
  texto: React.ReactNode;
}

const BORDE: Record<NonNullable<Insight["tono"]>, string> = {
  green: "border-l-savia-green bg-savia-ice/40",
  teal: "border-l-savia-teal bg-savia-ice/40",
  gold: "border-l-savia-gold bg-amber-50/30",
  rose: "border-l-rose-400 bg-rose-50/30",
};

const ICONO_BG: Record<NonNullable<Insight["tono"]>, string> = {
  green: "bg-savia-mint text-savia-deep",
  teal: "bg-savia-mint text-savia-teal",
  gold: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-500",
};

/** Rejilla de tarjetas de interpretación / hallazgos para el pie de una vista. */
export default function PanelInsights({
  titulo = "Lectura e insights",
  items,
}: {
  titulo?: string;
  items: Insight[];
}) {
  return (
    <section className="animate-fade-up space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} className="text-savia-gold" />
        <h4 className="text-sm font-black uppercase tracking-widest text-brand-gray1">
          {titulo}
        </h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((it, i) => {
          const tono = it.tono ?? "green";
          return (
            <div
              key={i}
              className={clsx("card border-l-4", BORDE[tono])}
            >
              {it.icon && (
                <div
                  className={clsx(
                    "w-10 h-10 rounded-lg flex items-center justify-center mb-4",
                    ICONO_BG[tono]
                  )}
                >
                  {it.icon}
                </div>
              )}
              <h5 className="text-sm font-bold text-savia-forest mb-2">
                {it.titulo}
              </h5>
              <p className="text-xs text-brand-muted leading-relaxed">
                {it.texto}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Nota breve de "cómo leer este gráfico". */
export function ComoLeer({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex gap-2 text-[11px] leading-relaxed text-brand-gray1">
      <Lightbulb size={13} className="shrink-0 mt-0.5 text-savia-gold" />
      <span>{children}</span>
    </p>
  );
}
