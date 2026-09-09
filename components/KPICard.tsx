import clsx from "clsx";

interface KPICardProps {
  /** Etiqueta corta en mayúsculas. */
  title: string;
  /** Valor principal ya formateado. */
  value: string;
  /** Texto de apoyo bajo el valor. */
  subtitle?: string;
  /** Dirección de la tendencia. */
  trend?: "up" | "down" | "neutral";
  /** Texto de la insignia de tendencia. */
  trendLabel?: string;
  /** Si `true`, subir = bueno (verde); si `false`, subir = malo (rojo). */
  trendPositive?: boolean;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  /** Retardo de la animación de entrada (0, 75, 150, 225, 300). */
  delay?: 0 | 75 | 150 | 225 | 300;
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  trendPositive = true,
  icon,
  iconBg = "#dbf3e4",
  iconColor = "#00693b",
  delay = 0,
}: KPICardProps) {
  const isGood =
    trend === "neutral" || trend == null
      ? null
      : trendPositive
      ? trend === "up"
      : trend === "down";

  const badgeClass =
    trend === "neutral"
      ? "bg-brand-mid text-brand-muted"
      : isGood
      ? "bg-savia-mint text-savia-deep"
      : "bg-red-50 text-red-700";

  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const delayClass = delay === 0 ? "" : `delay-${delay}`;

  return (
    <div className={clsx("card-hover animate-fade-up", delayClass)}>
      <div className="flex justify-between items-start mb-5">
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: iconBg, color: iconColor }}
          >
            {icon}
          </div>
        )}
        {trendLabel && (
          <span
            className={clsx(
              "text-xs font-bold px-2.5 py-0.5 rounded-full",
              badgeClass
            )}
          >
            {trendArrow} {trendLabel}
          </span>
        )}
      </div>

      <p className="kicker mb-1">{title}</p>

      <h3 className="text-3xl font-black text-savia-forest leading-none tracking-tight">
        {value}
      </h3>

      {subtitle && (
        <p className="text-xs text-brand-muted mt-2 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
