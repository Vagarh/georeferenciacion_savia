"use client";

import { useMemo } from "react";
import { SERIE_CATEGORICA, type DendroNodo } from "@/lib/datos";

const FILA = 18; // px por hoja
const MARGEN_IZQ = 20;
const MARGEN_DER = 330; // espacio para etiquetas
const ALTURA_PLOT = 560; // ancho del área de "distancia" de fusión
const MARGEN_SUP = 26; // espacio para el eje superior
const MAX_ETIQUETA = 44;

const recortar = (s: string) =>
  s.length > MAX_ETIQUETA ? `${s.slice(0, MAX_ETIQUETA - 1)}…` : s;

interface Pos {
  x: number;
  y: number;
  cluster: number;
}

const colorCluster = (c: number) =>
  c <= 0 ? "#9aa8a0" : SERIE_CATEGORICA[(c - 1) % SERIE_CATEGORICA.length];

export default function Dendrograma({
  data,
}: {
  data: { arbol: DendroNodo; num_hojas: number; k: number };
}) {
  const { segmentos, hojas, alto, cutX } = useMemo(() => {
    const segs: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];
    const hj: { nombre: string; y: number; color: string }[] = [];
    let contadorHoja = 0;
    let maxPura = 0; // mayor altura de un nodo aún dentro de un solo grupo
    let minMixta = 1; // menor altura de un nodo que ya mezcla grupos

    // x según altura normalizada: hoja (0) a la derecha, raíz (1) a la izquierda
    const xDe = (altura: number) => MARGEN_IZQ + (1 - altura) * ALTURA_PLOT;

    const recorrer = (n: DendroNodo): Pos => {
      if (!n.children || n.children.length === 0) {
        const y = MARGEN_SUP + contadorHoja * FILA + FILA / 2;
        contadorHoja += 1;
        const color = colorCluster(n.cluster);
        hj.push({ nombre: n.nombre, y, color });
        return { x: xDe(0), y, cluster: n.cluster };
      }
      const hijos = n.children.map(recorrer);
      const x = xDe(n.altura);
      const y = hijos.reduce((s, h) => s + h.y, 0) / hijos.length;
      const mismoCluster = hijos.every((h) => h.cluster === hijos[0].cluster);
      const color = mismoCluster ? colorCluster(hijos[0].cluster) : "#c2cec8";
      if (mismoCluster && hijos[0].cluster > 0)
        maxPura = Math.max(maxPura, n.altura);
      else minMixta = Math.min(minMixta, n.altura);
      for (const h of hijos) {
        segs.push({ x1: x, y1: h.y, x2: h.x, y2: h.y, color });
      }
      const ys = hijos.map((h) => h.y);
      segs.push({
        x1: x,
        y1: Math.min(...ys),
        x2: x,
        y2: Math.max(...ys),
        color,
      });
      return { x, y, cluster: mismoCluster ? hijos[0].cluster : 0 };
    };

    recorrer(data.arbol);
    const cutAltura = (maxPura + minMixta) / 2;
    return {
      segmentos: segs,
      hojas: hj,
      alto: MARGEN_SUP + contadorHoja * FILA + 14,
      cutX: xDe(cutAltura),
    };
  }, [data]);

  const ancho = MARGEN_IZQ + ALTURA_PLOT + MARGEN_DER;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full h-auto min-w-[760px]"
        role="img"
        aria-label="Dendrograma jerárquico de sedes"
      >
        {/* Eje de distancia (arriba) */}
        <line
          x1={MARGEN_IZQ}
          y1={MARGEN_SUP - 6}
          x2={MARGEN_IZQ + ALTURA_PLOT}
          y2={MARGEN_SUP - 6}
          stroke="#e2ece7"
        />
        {ticks.map((t) => {
          const x = MARGEN_IZQ + (1 - t) * ALTURA_PLOT;
          return (
            <g key={t}>
              <line
                x1={x}
                y1={MARGEN_SUP - 9}
                x2={x}
                y2={MARGEN_SUP - 3}
                stroke="#c2cec8"
              />
              <text
                x={x}
                y={MARGEN_SUP - 13}
                textAnchor="middle"
                style={{ fontSize: 8.5, fontWeight: 700 }}
                className="fill-brand-gray1"
              >
                {t.toFixed(2)}
              </text>
            </g>
          );
        })}
        <text
          x={MARGEN_IZQ}
          y={alto - 2}
          style={{ fontSize: 9, fontWeight: 800 }}
          className="fill-brand-gray1"
        >
          ← más distintas (grupos grandes) · más parecidas (sedes individuales) →
        </text>

        {/* Línea de corte en k grupos */}
        <line
          x1={cutX}
          y1={MARGEN_SUP - 6}
          x2={cutX}
          y2={alto - 16}
          stroke="#00693b"
          strokeWidth={1.4}
          strokeDasharray="4 4"
        />
        <text
          x={cutX + 5}
          y={MARGEN_SUP + 6}
          style={{ fontSize: 9.5, fontWeight: 800 }}
          className="fill-savia-deep"
        >
          corte en {data.k} grupos
        </text>

        {segmentos.map((s, i) => (
          <line
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        ))}

        {hojas.map((h, i) => (
          <g key={i}>
            <circle
              cx={MARGEN_IZQ + ALTURA_PLOT}
              cy={h.y}
              r={3}
              fill={h.color}
            />
            <text
              x={MARGEN_IZQ + ALTURA_PLOT + 8}
              y={h.y + 3}
              style={{ fontSize: 10.5 }}
              className="fill-brand-charcoal"
            >
              <title>{h.nombre}</title>
              {recortar(h.nombre)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
