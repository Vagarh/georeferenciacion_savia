"use client";

import { useMemo, useState } from "react";
import { fmtEntero, fmtPct } from "@/lib/datos";

// Colores por tipo de movimiento entre niveles de complejidad
const COLOR_SUBE = "#00954c"; // escalada: destino de mayor complejidad
const COLOR_IGUAL = "#94a3b8"; // lateral: mismo nivel
const COLOR_BAJA = "#f2a900"; // retorno: destino de menor complejidad

const W = 760;
const H = 380;
const PADY = 20;
const NODE_W = 20;
const X_L = 132;
const X_R = W - 132 - NODE_W;
const GAP = 16;

interface Celda {
  o: number;
  d: number;
  value: number;
}

const colorMov = (o: number, d: number) =>
  d > o ? COLOR_SUBE : d < o ? COLOR_BAJA : COLOR_IGUAL;

/**
 * Diagrama de bandas (tipo Sankey) del movimiento del paciente entre el nivel
 * de complejidad del prestador de origen y el del destino.
 */
export default function DiagramaNiveles({
  celdas,
  nivelesO,
  nivelesD,
}: {
  celdas: Celda[];
  nivelesO: number[];
  nivelesD: number[];
}) {
  const [foco, setFoco] = useState<string | null>(null);

  const { nodosL, nodosR, bandas, total } = useMemo(() => {
    const sumO = new Map<number, number>();
    const sumD = new Map<number, number>();
    for (const c of celdas) {
      sumO.set(c.o, (sumO.get(c.o) ?? 0) + c.value);
      sumD.set(c.d, (sumD.get(c.d) ?? 0) + c.value);
    }
    const total = celdas.reduce((s, c) => s + c.value, 0) || 1;
    const plotH = H - PADY * 2;

    const nivL = nivelesO.filter((n) => (sumO.get(n) ?? 0) > 0);
    const nivR = nivelesD.filter((n) => (sumD.get(n) ?? 0) > 0);
    const availL = plotH - GAP * Math.max(0, nivL.length - 1);
    const availR = plotH - GAP * Math.max(0, nivR.length - 1);

    const nodosL = new Map<number, { y0: number; y1: number; cur: number }>();
    let y = PADY;
    for (const n of nivL) {
      const h = ((sumO.get(n) ?? 0) / total) * availL;
      nodosL.set(n, { y0: y, y1: y + h, cur: y });
      y += h + GAP;
    }
    const nodosR = new Map<number, { y0: number; y1: number; cur: number }>();
    y = PADY;
    for (const n of nivR) {
      const h = ((sumD.get(n) ?? 0) / total) * availR;
      nodosR.set(n, { y0: y, y1: y + h, cur: y });
      y += h + GAP;
    }

    // Bandas: consume espacio en el nodo izq (ordenado por d) y der (por o)
    const porL = [...celdas].sort((a, b) => a.o - b.o || a.d - b.d);
    const porR = [...celdas].sort((a, b) => a.d - b.d || a.o - b.o);
    const src = new Map<string, [number, number]>();
    const tgt = new Map<string, [number, number]>();
    for (const c of porL) {
      const nd = nodosL.get(c.o);
      if (!nd) continue;
      const h = (c.value / total) * availL;
      src.set(`${c.o}-${c.d}`, [nd.cur, nd.cur + h]);
      nd.cur += h;
    }
    for (const c of porR) {
      const nd = nodosR.get(c.d);
      if (!nd) continue;
      const h = (c.value / total) * availR;
      tgt.set(`${c.o}-${c.d}`, [nd.cur, nd.cur + h]);
      nd.cur += h;
    }

    const midx = (X_L + NODE_W + X_R) / 2;
    const bandas = celdas
      .filter((c) => src.has(`${c.o}-${c.d}`) && tgt.has(`${c.o}-${c.d}`))
      .map((c) => {
        const [sy0, sy1] = src.get(`${c.o}-${c.d}`)!;
        const [ty0, ty1] = tgt.get(`${c.o}-${c.d}`)!;
        const x0 = X_L + NODE_W;
        const d = [
          `M ${x0} ${sy0}`,
          `C ${midx} ${sy0}, ${midx} ${ty0}, ${X_R} ${ty0}`,
          `L ${X_R} ${ty1}`,
          `C ${midx} ${ty1}, ${midx} ${sy1}, ${x0} ${sy1}`,
          "Z",
        ].join(" ");
        return {
          key: `${c.o}-${c.d}`,
          d,
          color: colorMov(c.o, c.d),
          value: c.value,
          o: c.o,
          dd: c.d,
          pct: (c.value / total) * 100,
        };
      });

    return { nodosL, nodosR, bandas, total };
  }, [celdas, nivelesO, nivelesD]);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto min-w-[640px]"
        role="img"
        aria-label="Diagrama de flujo entre niveles de complejidad"
      >
        <text
          x={X_L + NODE_W / 2}
          y={12}
          textAnchor="middle"
          className="fill-brand-gray1"
          style={{ fontSize: 10, fontWeight: 800 }}
        >
          NIVEL DE ORIGEN
        </text>
        <text
          x={X_R + NODE_W / 2}
          y={12}
          textAnchor="middle"
          className="fill-brand-gray1"
          style={{ fontSize: 10, fontWeight: 800 }}
        >
          NIVEL DE DESTINO
        </text>

        {/* Bandas */}
        <g>
          {bandas.map((b) => {
            const atenuar = foco && foco !== b.key;
            return (
              <path
                key={b.key}
                d={b.d}
                fill={b.color}
                fillOpacity={atenuar ? 0.12 : foco === b.key ? 0.85 : 0.55}
                stroke={b.color}
                strokeOpacity={atenuar ? 0.1 : 0.35}
                strokeWidth={0.5}
                onMouseEnter={() => setFoco(b.key)}
                onMouseLeave={() => setFoco(null)}
                className="transition-[fill-opacity] cursor-pointer"
              >
                <title>
                  Nivel {b.o} → Nivel {b.dd}: {fmtEntero(b.value)} (
                  {fmtPct(b.pct, 1)})
                </title>
              </path>
            );
          })}
        </g>

        {/* Nodos izquierda */}
        {[...nodosL.entries()].map(([n, p]) => (
          <g key={`l${n}`}>
            <rect
              x={X_L}
              y={p.y0}
              width={NODE_W}
              height={Math.max(2, p.y1 - p.y0)}
              rx={3}
              fill="#0b3d2c"
            />
            <text
              x={X_L - 10}
              y={(p.y0 + p.y1) / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-savia-forest"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              Nivel {n}
            </text>
          </g>
        ))}

        {/* Nodos derecha */}
        {[...nodosR.entries()].map(([n, p]) => (
          <g key={`r${n}`}>
            <rect
              x={X_R}
              y={p.y0}
              width={NODE_W}
              height={Math.max(2, p.y1 - p.y0)}
              rx={3}
              fill="#0b3d2c"
            />
            <text
              x={X_R + NODE_W + 10}
              y={(p.y0 + p.y1) / 2}
              textAnchor="start"
              dominantBaseline="middle"
              className="fill-savia-forest"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              Nivel {n}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-semibold text-brand-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ background: COLOR_SUBE }}
          />
          Escala a mayor complejidad
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ background: COLOR_IGUAL }}
          />
          Mismo nivel
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ background: COLOR_BAJA }}
          />
          Retorna a menor complejidad
        </span>
        <span className="text-brand-gray1">
          Ancho de banda = nº de remisiones · total {fmtEntero(total)}
        </span>
      </div>
    </div>
  );
}
