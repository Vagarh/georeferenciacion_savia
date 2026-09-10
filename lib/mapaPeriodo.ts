"use client";

// =====================================================================
// Recorte del mapa de red por período (rango de meses de los filtros)
// =====================================================================
// El JSON `mapa_red.json` trae, además de los totales, una serie mensual
// por nodo (`serie: [[mesIdx, origen, destino]]`) y por flujo
// (`serie: [[mesIdx, valor]]`). Este hook reagrega esas series al rango
// de meses activo para que TODA la vista del mapa —no solo el SVG—
// responda al filtro de fecha.

import { useMemo } from "react";
import { useFiltros } from "@/lib/filtros";
import type { MapaRed as TMapaRed } from "@/lib/datos";

export interface MapaPeriodo {
  /** Nodos con `origen` / `destino` recalculados al rango activo. */
  nodos: TMapaRed["nodos"];
  /** Flujos con `valor` recalculado al rango; se descartan los que quedan en 0. */
  flujos: TMapaRed["flujos"];
  /** Lista de meses del JSON (`YYYY-MM`). */
  meses: string[];
  /** `[iDesde, iHasta]` sobre `meses`, o `null` si abarca todo el período. */
  rango: [number, number] | null;
  /** `true` cuando el rango recorta el período completo. */
  recortado: boolean;
}

export function useMapaPeriodo(data: TMapaRed): MapaPeriodo {
  const { filtros } = useFiltros();
  const meses = useMemo(() => data.meses ?? [], [data.meses]);

  const rango = useMemo<[number, number] | null>(() => {
    if (!meses.length) return null;
    const desde = filtros.mesDesde ?? meses[0];
    const hasta = filtros.mesHasta ?? meses[meses.length - 1];
    const iDesde = Math.max(0, meses.indexOf(desde));
    const iHastaRaw = meses.indexOf(hasta);
    const iHasta = iHastaRaw < 0 ? meses.length - 1 : iHastaRaw;
    if (iDesde <= 0 && iHasta >= meses.length - 1) return null;
    return [iDesde, iHasta];
  }, [meses, filtros.mesDesde, filtros.mesHasta]);

  const nodos = useMemo(() => {
    if (!rango) return data.nodos;
    const [a, b] = rango;
    return data.nodos.map((n) => {
      let o = 0;
      let d = 0;
      for (const [i, so, sd] of n.serie ?? [])
        if (i >= a && i <= b) {
          o += so;
          d += sd;
        }
      return { ...n, origen: o, destino: d };
    });
  }, [data.nodos, rango]);

  const flujos = useMemo(() => {
    if (!rango) return data.flujos;
    const [a, b] = rango;
    return data.flujos
      .map((f) => {
        let v = 0;
        for (const [i, sv] of f.serie ?? []) if (i >= a && i <= b) v += sv;
        return { ...f, valor: v };
      })
      .filter((f) => f.valor > 0);
  }, [data.flujos, rango]);

  return { nodos, flujos, meses, rango, recortado: rango != null };
}
