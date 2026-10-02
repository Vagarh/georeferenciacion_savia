import type {
  Conexion,
  MovilidadBloque,
  MovilidadNiveles,
} from "@/lib/datos";
import type { EstadoFiltros } from "@/lib/filtros";

// =====================================================================
// Agregación territorial: recalcula Análisis Geográfico y Flujo entre
// Niveles según período, subregión y municipio (del prestador que remite).
// =====================================================================

/** Formato columnar compartido por las tablas hechos_flujo/sedes/niveles. */
export interface TablaColumnar {
  campos: string[];
  filas: (string | number)[][];
  sedes?: string[];
}

export const TABLA_VACIA: TablaColumnar = { campos: [], filas: [] };

/** ¿Hay algún filtro territorial o de período activo? */
export function hayFiltroGeo(f: EstadoFiltros): boolean {
  return (
    f.regiones.length > 0 ||
    f.municipios.length > 0 ||
    Boolean(f.mesDesde || f.mesHasta)
  );
}

function indices(campos: string[]): Record<string, number> {
  return Object.fromEntries(campos.map((c, k) => [c, k]));
}

/** ¿La fila (mes + municipio de origen) cumple los filtros activos? */
function pasaGeo(
  mes: string,
  muni: string,
  f: EstadoFiltros,
  m2r: Record<string, string>
): boolean {
  if (f.mesDesde && mes < f.mesDesde) return false;
  if (f.mesHasta && mes > f.mesHasta) return false;
  if (f.municipios.length && !f.municipios.includes(muni)) return false;
  if (f.regiones.length && !f.regiones.includes(m2r[muni] ?? "Sin región"))
    return false;
  return true;
}

function ranking(m: Map<string, number>, tope?: number) {
  const r = [...m.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([region, remisiones]) => ({ region, remisiones }));
  return tope ? r.slice(0, tope) : r;
}

// --- Análisis Geográfico ---------------------------------------------

export interface MatrizTerritorial {
  filas: string[];
  columnas: string[];
  celdas: { origen: string; destino: string; value: number }[];
}

export interface GeoAgregado {
  total: number;
  sedesOrigen: number;
  sedesDestino: number;
  municipios: number;
  /** Con municipio filtrado el desglose es por municipio; si no, por subregión. */
  porMunicipio: boolean;
  origen: { region: string; remisiones: number }[];
  destino: { region: string; remisiones: number }[];
  matriz: MatrizTerritorial;
  conexiones: Conexion[];
}

const SEP = "\u0001";

export function agregarGeografico(
  flujo: TablaColumnar,
  sedes: TablaColumnar,
  m2r: Record<string, string>,
  f: EstadoFiltros
): GeoAgregado {
  const porMunicipio = f.municipios.length > 0;
  const origen = new Map<string, number>();
  const destino = new Map<string, number>();
  const cruce = new Map<string, number>();
  const munis = new Set<string>();
  let total = 0;

  const i = indices(flujo.campos);
  for (const r of flujo.filas) {
    const mo = r[i.mo] as string;
    if (!pasaGeo(r[i.mes] as string, mo, f, m2r)) continue;
    const n = r[i.n] as number;
    const md = r[i.md] as string;
    const rd = r[i.rd] as string;
    const ro = m2r[mo] ?? "Sin región";
    const claveO = porMunicipio ? mo : ro;
    const claveD = porMunicipio ? md : rd;
    total += n;
    munis.add(mo);
    origen.set(claveO, (origen.get(claveO) ?? 0) + n);
    if (claveD !== "Sin dato" && claveD !== "Sin región")
      destino.set(claveD, (destino.get(claveD) ?? 0) + n);
    // matriz: fila = origen (subregión o municipio) · columna = subregión destino
    if (rd !== "Sin región") {
      const k = `${claveO}${SEP}${rd}`;
      cruce.set(k, (cruce.get(k) ?? 0) + n);
    }
  }

  const filasTop = ranking(origen, 10).map((x) => x.region);
  const colVol = new Map<string, number>();
  for (const [k, v] of cruce) {
    const [o, d] = k.split(SEP);
    if (filasTop.includes(o)) colVol.set(d, (colVol.get(d) ?? 0) + v);
  }
  const columnas = ranking(colVol, 10).map((x) => x.region);
  const celdas: MatrizTerritorial["celdas"] = [];
  for (const o of filasTop)
    for (const d of columnas)
      celdas.push({
        origen: o,
        destino: d,
        value: cruce.get(`${o}${SEP}${d}`) ?? 0,
      });

  // Sedes y conexiones sede → sede
  const is = indices(sedes.campos);
  const nombres = sedes.sedes ?? [];
  const sO = new Set<number>();
  const sD = new Set<number>();
  const pares = new Map<string, number>();
  for (const r of sedes.filas) {
    if (!pasaGeo(r[is.mes] as string, r[is.mo] as string, f, m2r)) continue;
    const so = r[is.so] as number;
    const sd = r[is.sd] as number;
    sO.add(so);
    sD.add(sd);
    const k = `${so}${SEP}${sd}`;
    pares.set(k, (pares.get(k) ?? 0) + (r[is.n] as number));
  }
  const conexiones: Conexion[] = [...pares.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([k, flujoN]) => {
      const [a, b] = k.split(SEP).map(Number);
      return { origen: nombres[a], destino: nombres[b], flujo: flujoN };
    });

  return {
    total,
    sedesOrigen: sO.size,
    sedesDestino: sD.size,
    municipios: munis.size,
    porMunicipio,
    origen: ranking(origen),
    destino: ranking(destino, porMunicipio ? 12 : undefined),
    matriz: { filas: filasTop, columnas, celdas },
    conexiones,
  };
}

// --- Flujo entre Niveles ---------------------------------------------

export interface NivelesAgregado {
  movilidad: MovilidadNiveles;
  estados: { cerradas: number; canceladas: number; anuladas: number };
}

type Acum = {
  total: number;
  sube: number;
  igual: number;
  baja: number;
  conNivel: number;
  cerradas: number;
  desenlace: number;
  diasSum: number;
  diasCnt: number;
  celdas: Map<string, number>;
};

const nuevoAcum = (): Acum => ({
  total: 0,
  sube: 0,
  igual: 0,
  baja: 0,
  conNivel: 0,
  cerradas: 0,
  desenlace: 0,
  diasSum: 0,
  diasCnt: 0,
  celdas: new Map(),
});

function cerrarBloque(a: Acum): MovilidadBloque {
  const base = a.conNivel || 1;
  const celdas: MovilidadBloque["celdas"] = [];
  for (const [k, value] of a.celdas) {
    const [o, d] = k.split("-").map(Number);
    celdas.push({ o, d, value });
  }
  return {
    total: a.total,
    sube: a.sube,
    igual: a.igual,
    baja: a.baja,
    sin_dato: a.total - a.conNivel,
    pct_sube: (a.sube / base) * 100,
    pct_igual: (a.igual / base) * 100,
    pct_baja: (a.baja / base) * 100,
    dias_promedio: a.diasCnt ? a.diasSum / a.diasCnt : 0,
    tasa_resolucion: a.desenlace ? (a.cerradas / a.desenlace) * 100 : 0,
    celdas,
  };
}

export function agregarNiveles(
  tabla: TablaColumnar,
  m2r: Record<string, string>,
  f: EstadoFiltros,
  base: MovilidadNiveles
): NivelesAgregado {
  const acc = { referencia: nuevoAcum(), contrarreferencia: nuevoAcum() };
  const est = { cerradas: 0, canceladas: 0, anuladas: 0 };
  const i = indices(tabla.campos);

  for (const r of tabla.filas) {
    if (!pasaGeo(r[i.mes] as string, r[i.mo] as string, f, m2r)) continue;
    const a = acc[r[i.tipo] as "referencia" | "contrarreferencia"];
    const n = r[i.n] as number;
    const no = r[i.no] as number;
    const nd = r[i.nd] as number;
    const cerr = r[i.cerradas] as number;
    const canc = r[i.canceladas] as number;
    a.total += n;
    a.cerradas += cerr;
    a.desenlace += cerr + canc;
    a.diasSum += r[i.dias_sum] as number;
    a.diasCnt += r[i.dias_cnt] as number;
    est.cerradas += cerr;
    est.canceladas += canc;
    est.anuladas += r[i.anuladas] as number;
    if (no > 0 && nd > 0) {
      a.conNivel += n;
      if (nd > no) a.sube += n;
      else if (nd === no) a.igual += n;
      else a.baja += n;
      if (no <= 3 && nd <= 4)
        a.celdas.set(`${no}-${nd}`, (a.celdas.get(`${no}-${nd}`) ?? 0) + n);
    }
  }

  return {
    movilidad: {
      ...base,
      referencia: cerrarBloque(acc.referencia),
      contrarreferencia: cerrarBloque(acc.contrarreferencia),
    },
    estados: est,
  };
}
