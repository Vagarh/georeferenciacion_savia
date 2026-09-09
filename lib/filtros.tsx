"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { HechoFila } from "@/lib/datos";

// =====================================================================
// Estado de filtros global (período, región, régimen, tipo, nivel)
// =====================================================================

export interface EstadoFiltros {
  mesDesde: string | null;
  mesHasta: string | null;
  regiones: string[]; // subregiones · vacío = todas
  municipios: string[];
  regimenes: string[];
  tipos: string[];
  niveles: number[];
}

const VACIO: EstadoFiltros = {
  mesDesde: null,
  mesHasta: null,
  regiones: [],
  municipios: [],
  regimenes: [],
  tipos: [],
  niveles: [],
};

interface Ctx {
  filtros: EstadoFiltros;
  set: (parcial: Partial<EstadoFiltros>) => void;
  toggle: (
    campo: "regiones" | "municipios" | "regimenes" | "tipos" | "niveles",
    valor: string | number
  ) => void;
  limpiar: () => void;
  activos: number;
}

const FiltrosContext = createContext<Ctx | null>(null);

export function FiltrosProvider({ children }: { children: React.ReactNode }) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(VACIO);

  const set = useCallback(
    (parcial: Partial<EstadoFiltros>) =>
      setFiltros((f) => ({ ...f, ...parcial })),
    []
  );

  const toggle = useCallback<Ctx["toggle"]>((campo, valor) => {
    setFiltros((f) => {
      const actual = f[campo] as (string | number)[];
      const existe = actual.includes(valor);
      return {
        ...f,
        [campo]: existe
          ? actual.filter((v) => v !== valor)
          : [...actual, valor],
      };
    });
  }, []);

  const limpiar = useCallback(() => setFiltros(VACIO), []);

  const activos =
    filtros.regiones.length +
    filtros.municipios.length +
    filtros.regimenes.length +
    filtros.tipos.length +
    filtros.niveles.length +
    (filtros.mesDesde || filtros.mesHasta ? 1 : 0);

  const value = useMemo(
    () => ({ filtros, set, toggle, limpiar, activos }),
    [filtros, set, toggle, limpiar, activos]
  );

  return (
    <FiltrosContext.Provider value={value}>{children}</FiltrosContext.Provider>
  );
}

export function useFiltros(): Ctx {
  const c = useContext(FiltrosContext);
  if (!c) throw new Error("useFiltros fuera de <FiltrosProvider>");
  return c;
}

// =====================================================================
// Agregación de la tabla de hechos según los filtros activos
// =====================================================================

export interface Agregado {
  total: number;
  cerradas: number;
  diasSum: number;
  diasCnt: number;
  tasaEfectividad: number;
  tiempoPromedio: number;
  referencias: number;
  contrarreferencias: number;
  pctReferencias: number;
  porMes: {
    mes: string;
    mes_label: string;
    remisiones: number;
    referencias: number;
    contrarreferencias: number;
  }[];
  porRegion: { name: string; value: number }[];
  porMunicipio: { name: string; value: number }[];
  porRegimen: { name: string; value: number }[];
  porTipo: { name: string; value: number }[];
  porNivel: { nivel: string; value: number }[];
}

function pasa(f: HechoFila, filtros: EstadoFiltros): boolean {
  if (filtros.mesDesde && f.mes < filtros.mesDesde) return false;
  if (filtros.mesHasta && f.mes > filtros.mesHasta) return false;
  // Un campo ausente en la fila (según la tabla en uso) no filtra.
  if (
    filtros.regiones.length &&
    f.region != null &&
    !filtros.regiones.includes(f.region)
  )
    return false;
  if (
    filtros.municipios.length &&
    f.municipio != null &&
    !filtros.municipios.includes(f.municipio)
  )
    return false;
  if (
    filtros.regimenes.length &&
    f.regimen != null &&
    !filtros.regimenes.includes(f.regimen)
  )
    return false;
  if (filtros.tipos.length && f.tipo != null && !filtros.tipos.includes(f.tipo))
    return false;
  if (
    filtros.niveles.length &&
    f.nivel != null &&
    !filtros.niveles.includes(f.nivel)
  )
    return false;
  return true;
}

export function agregar(
  filas: HechoFila[],
  filtros: EstadoFiltros
): Agregado {
  const mes = new Map<
    string,
    { mes_label: string; ref: number; contra: number; total: number }
  >();
  const reg = new Map<string, number>();
  const muni = new Map<string, number>();
  const regim = new Map<string, number>();
  const tipo = new Map<string, number>();
  const nivel = new Map<number, number>();

  let total = 0;
  let cerradas = 0;
  let diasSum = 0;
  let diasCnt = 0;
  let referencias = 0;
  let contrarreferencias = 0;

  for (const f of filas) {
    if (!pasa(f, filtros)) continue;
    total += f.n;
    cerradas += f.cerradas;
    diasSum += f.dias_sum;
    diasCnt += f.dias_cnt;

    // `tipo` puede no venir (tabla por municipio): entonces todo va a "sin split"
    const esContra = f.tipo
      ? f.tipo.toLowerCase().startsWith("contra")
      : false;
    const tieneTipo = f.tipo !== undefined;
    if (tieneTipo) {
      if (esContra) contrarreferencias += f.n;
      else referencias += f.n;
    }

    const m = mes.get(f.mes) ?? {
      mes_label: f.mes_label,
      ref: 0,
      contra: 0,
      total: 0,
    };
    m.total += f.n;
    if (esContra) m.contra += f.n;
    else if (tieneTipo) m.ref += f.n;
    mes.set(f.mes, m);

    if (f.region) reg.set(f.region, (reg.get(f.region) ?? 0) + f.n);
    if (f.municipio && f.municipio !== "Sin dato")
      muni.set(f.municipio, (muni.get(f.municipio) ?? 0) + f.n);
    if (f.regimen) regim.set(f.regimen, (regim.get(f.regimen) ?? 0) + f.n);
    if (f.tipo) tipo.set(f.tipo, (tipo.get(f.tipo) ?? 0) + f.n);
    if (f.nivel !== undefined)
      nivel.set(f.nivel, (nivel.get(f.nivel) ?? 0) + f.n);
  }

  const porMes = [...mes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({
      mes: k,
      mes_label: v.mes_label,
      remisiones: v.total,
      referencias: v.ref,
      contrarreferencias: v.contra,
    }));

  const ordDesc = (m: Map<string, number>) =>
    [...m.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

  return {
    total,
    cerradas,
    diasSum,
    diasCnt,
    tasaEfectividad: total ? (cerradas / total) * 100 : 0,
    tiempoPromedio: diasCnt ? diasSum / diasCnt : 0,
    referencias,
    contrarreferencias,
    pctReferencias: total ? (referencias / total) * 100 : 0,
    porMes,
    porRegion: ordDesc(reg),
    porMunicipio: ordDesc(muni),
    porRegimen: ordDesc(regim),
    porTipo: ordDesc(tipo),
    porNivel: [...nivel.entries()]
      .sort(([a], [b]) => a - b)
      .map(([k, value]) => ({ nivel: `Nivel ${k}`, value })),
  };
}
