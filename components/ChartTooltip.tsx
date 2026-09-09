import { fmtEntero } from "@/lib/datos";

/** Tooltip unificado para todos los gráficos de Recharts. */
export default function ChartTooltip({
  active,
  payload,
  label,
  sufijo = "",
  formato = fmtEntero,
}: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  sufijo?: string;
  formato?: (n: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-brand-gray3 rounded-xl p-3 shadow-card-lg text-xs min-w-[9rem]">
      {label != null && (
        <p className="font-bold text-savia-forest mb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div
            key={`${p.name}-${i}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-brand-muted">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.color || p.fill || "#00693b" }}
              />
              {p.name}
            </span>
            <span
              className="font-bold"
              style={{ color: p.color || p.fill || "#0b3d2c" }}
            >
              {typeof p.value === "number" ? formato(p.value) : p.value}
              {sufijo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
