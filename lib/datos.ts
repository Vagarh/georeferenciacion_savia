// =====================================================================
// Utilidades de datos y formato para el dashboard
// =====================================================================
// Todos los JSON viven en /public/data y son generados por
// scripts/preparar_datos.py (datos agregados, sin PII).

/** Carga un JSON desde /public/data. Devuelve `fallback` si falla. */
export async function cargarJson<T>(nombre: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`/data/${nombre}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`No se pudo cargar /data/${nombre}.json`, err);
    return fallback;
  }
}

// --- Formateadores ---
const nfEntero = new Intl.NumberFormat("es-CO");
const nfDecimal = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const fmtEntero = (n: number | null | undefined): string =>
  n == null ? "—" : nfEntero.format(Math.round(n));

export const fmtDecimal = (n: number | null | undefined): string =>
  n == null ? "—" : nfDecimal.format(n);

/** Formato con `dec` decimales fijos y separadores es-CO (métricas finas). */
export const fmtNum = (n: number | null | undefined, dec = 2): string =>
  n == null
    ? "—"
    : n.toLocaleString("es-CO", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });

export const fmtPct = (n: number | null | undefined, dec = 1): string =>
  n == null
    ? "—"
    : `${n.toLocaleString("es-CO", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })}%`;

/** Abrevia miles: 12456 -> "12,5 k". */
export const fmtCompacto = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000) return `${nfDecimal.format(n / 1000)} k`;
  return nfEntero.format(n);
};

// --- Paleta de series (coherente con tailwind.config.js) ---
export const PALETA = {
  green: "#00954c",
  deep: "#00693b",
  forest: "#0b3d2c",
  teal: "#009ca6",
  aqua: "#4fc3c7",
  lime: "#8cc63f",
  gold: "#f2a900",
  slate: "#64748b",
  plum: "#8b5cf6",
  rose: "#e11d48",
};

/** Secuencia categórica para gráficos con varias series. */
export const SERIE_CATEGORICA = [
  PALETA.green,
  PALETA.teal,
  PALETA.lime,
  PALETA.gold,
  PALETA.slate,
  PALETA.plum,
  PALETA.aqua,
  PALETA.rose,
];

/** Escala secuencial verde para heatmaps (0 → 1). */
export function escalaVerde(t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  // interpola entre #eef9f2 (claro) y #00693b (oscuro)
  const c0 = [238, 249, 242];
  const c1 = [0, 105, 59];
  const mez = c0.map((v, i) => Math.round(v + (c1[i] - v) * clamp));
  return `rgb(${mez[0]}, ${mez[1]}, ${mez[2]})`;
}

/** Color estable por región de Antioquia (mapa + gráficos). */
export const COLOR_REGION: Record<string, string> = {
  Medellin: "#00693b",
  "Valle De Aburra": "#00954c",
  Oriente: "#009ca6",
  Uraba: "#4fc3c7",
  Suroeste: "#8cc63f",
  Norte: "#f2a900",
  Occidente: "#e07b39",
  Nordeste: "#8b5cf6",
  "Magdalena Medio": "#d4568c",
  "Bajo Cauca": "#64748b",
  "Sin región": "#9aa8a0",
};

export const colorRegion = (r: string): string =>
  COLOR_REGION[r] ?? "#9aa8a0";

/** Paleta cualitativa amplia para las comunidades RAS (hasta ~20 grupos). */
export const PALETA_COMUNIDAD = [
  "#00693b",
  "#009ca6",
  "#8cc63f",
  "#f2a900",
  "#8b5cf6",
  "#e07b39",
  "#4fc3c7",
  "#d4568c",
  "#0b3d2c",
  "#64748b",
  "#12a150",
  "#b45309",
  "#2563eb",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
  "#0d9488",
];

/** Color estable por id de comunidad RAS. `null` → gris neutro. */
export const colorComunidad = (id: number | null | undefined): string =>
  id == null ? "#c2cec8" : PALETA_COMUNIDAD[id % PALETA_COMUNIDAD.length];

/**
 * Proyección equirectangular simple (lon/lat → x/y en píxeles). Antioquia es
 * pequeña: la distorsión es despreciable y evita dependencias de d3-geo.
 */
export function crearProyeccion(
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  ancho: number,
  alto: number,
  pad = 28
) {
  const spanLon = bbox.maxLon - bbox.minLon || 1;
  const spanLat = bbox.maxLat - bbox.minLat || 1;
  const w = ancho - pad * 2;
  const h = alto - pad * 2;
  // corrige el aspecto por la latitud media
  const kLat = Math.cos((((bbox.minLat + bbox.maxLat) / 2) * Math.PI) / 180);
  const escala = Math.min(w / (spanLon * kLat), h / spanLat);
  const offX = pad + (w - spanLon * kLat * escala) / 2;
  const offY = pad + (h - spanLat * escala) / 2;
  return (lon: number, lat: number): [number, number] => [
    offX + (lon - bbox.minLon) * kLat * escala,
    // y invertida: lat mayor = arriba
    offY + (bbox.maxLat - lat) * escala,
  ];
}

// --- Tipos de los JSON ---
export interface Resumen {
  total_remisiones: number;
  sedes_origen: number;
  sedes_destino: number;
  municipios_origen: number;
  tiempo_promedio_cierre: number;
  tiempo_mediana_cierre: number;
  tasa_efectividad: number;
  tasa_resolucion: number;
  cerradas: number;
  canceladas: number;
  anuladas: number;
  referencias: number;
  contrarreferencias: number;
  pct_referencias: number;
  edad_promedio: number;
  periodo: string;
  actualizado: string;
}

// --- Movilidad entre niveles de complejidad ---
export interface MovilidadBloque {
  total: number;
  sube: number;
  igual: number;
  baja: number;
  sin_dato: number;
  pct_sube: number;
  pct_igual: number;
  pct_baja: number;
  dias_promedio: number;
  tasa_resolucion: number;
  celdas: { o: number; d: number; value: number }[];
}

export interface MovilidadNiveles {
  referencia: MovilidadBloque;
  contrarreferencia: MovilidadBloque;
  niveles_origen: number[];
  niveles_destino: number[];
  nota: string;
}

// --- Perfil de clústeres RAD ---
export interface ClusterPerfil {
  cluster: number;
  sedes: number;
  pct_sedes: number;
  remisiones_origen_prom: number;
  remisiones_destino_prom: number;
  nivel_complejidad_prom: number;
  dias_cierre_prom: number;
  tasa_efectivas_prom: number;
  cobertura_municipal_prom: number;
  pagerank_prom: number;
  intermediacion_prom: number;
  pct_subsidiado_prom: number;
  tasa_urgencias_prom: number;
  etiqueta: string;
  rasgo: string;
}

export interface ClusteringPerfil {
  metodo: string;
  num_sedes: number;
  num_clusters: number;
  clusters: ClusterPerfil[];
}

export interface PuntoSerie {
  mes: string;
  mes_label: string;
  remisiones?: number;
  referencias?: number;
  contrarreferencias?: number;
  [k: string]: string | number | undefined;
}

export interface Categoria {
  name: string;
  value: number;
}

export interface SedeRanking {
  sede: string;
  remisiones: number;
}

export interface RegionRanking {
  region: string;
  remisiones: number;
}

export interface Conexion {
  origen: string;
  destino: string;
  flujo: number;
}

export interface Diagnostico {
  nombre: string;
  count: number;
}

export interface MatrizFlujo {
  regiones: string[];
  celdas: { origen: string; destino: string; value: number }[];
}

export interface TiemposCierre {
  histograma: { rango: string; value: number }[];
  estadisticos: {
    media: number;
    mediana: number;
    p25: number;
    p75: number;
    p90: number;
    max: number;
  };
}

export interface ClusterMetodo {
  metodo: string;
  silhouette: number;
  calinski_harabasz: number;
  davies_bouldin: number;
}

export interface RasAlgoritmo {
  algoritmo: string;
  num_comunidades: number;
  modularidad: number;
  tam_promedio: number;
  tam_min: number;
  tam_max: number;
}

export interface ComunidadTam {
  comunidad: string;
  sedes: number;
}

export interface ZaidResumen {
  num_zaid: number;
  total_sedes: number;
  sedes_zona_mayor: number;
  promedio_sedes: number;
  coherencia: Record<string, number>;
}

export interface ZaidFila {
  zaid: string;
  num_sedes: number;
  cluster_principal: number;
  comunidad_principal: number;
}

// --- Mapa de red ---
export interface NodoMapa {
  nombre: string;
  region: string;
  /** id de comunidad RAS del municipio (puede faltar). */
  comunidad?: number | null;
  lon: number;
  lat: number;
  origen: number;
  destino: number;
  /** serie mensual: [idxMes, origen, destino] solo con meses con actividad. */
  serie?: number[][];
}

export interface FlujoMapa {
  o: string;
  d: string;
  region_o: string;
  olon: number;
  olat: number;
  dlon: number;
  dlat: number;
  valor: number;
  /** serie mensual: [idxMes, valor]. */
  serie?: number[][];
}

export interface ComunidadMapa {
  id: number;
  sedes: number;
  municipios: number;
  regiones: string[];
}

/** Lugar fuera de Antioquia que emite o recibe remisiones. */
export interface LugarExterno {
  nombre: string;
  lon: number;
  lat: number;
  valor: number;
  /** municipio de Antioquia con el que más intercambia (para dibujar el arco). */
  ancla: string | null;
}

export interface ExternosMapa {
  total_salidas: number;
  total_entradas: number;
  pct_salidas: number;
  pct_entradas: number;
  destinos: LugarExterno[];
  origenes: LugarExterno[];
}

// --- Flujo de remisión por diagnóstico ---
export interface DiagMunicipio {
  nombre: string;
  region: string;
  lon: number;
  lat: number;
}

export interface DiagBloque {
  total: number;
  intermunicipal: number;
  pct_intermunicipal: number;
  pct_fuera_subregion: number;
  edad_promedio: number;
  dias_promedio: number;
  tasa_cierre: number;
  pct_contrarreferencia: number;
  /** [idxMunicipioOrigen, idxMunicipioDestino, valor] */
  flujos: number[][];
  rutas: { origen: string; destino: string; valor: number }[];
  celdas_region: { o: string; d: string; v: number }[];
}

export interface FlujoDiagnosticos {
  municipios: DiagMunicipio[];
  diagnosticos: { nombre: string; total: number }[];
  por_diagnostico: Record<string, DiagBloque>;
}

export interface MapaRed {
  meses?: string[];
  nodos: NodoMapa[];
  flujos: FlujoMapa[];
  comunidades?: ComunidadMapa[];
  externos?: ExternosMapa;
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  resumen: {
    municipios: number;
    flujos_intermunicipales: number;
    remisiones_mismo_municipio: number;
    pct_intermunicipal: number;
    num_comunidades?: number;
  };
}

/** Contorno del departamento de Antioquia para el fondo del mapa. */
export interface AntioquiaGeo {
  nombre: string;
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  outline: [number, number][];
}

// --- Dendrograma ---
export interface DendroNodo {
  nombre: string;
  altura: number;
  cluster: number;
  children?: DendroNodo[];
}

export interface Dendrograma {
  arbol: DendroNodo;
  num_hojas: number;
  k: number;
  metodo: string;
}

// --- Tabla de hechos (filtros) ---
// Hay dos tablas: `hechos.json` (con régimen y nivel, sin municipio) y
// `hechos_muni.json` (con municipio, sin régimen ni nivel). Por eso varios
// campos son opcionales: dependen de cuál se esté usando.
export interface HechoFila {
  mes: string;
  mes_label: string;
  region?: string;
  municipio?: string;
  regimen?: string;
  tipo?: string;
  nivel?: number;
  n: number;
  cerradas: number;
  dias_sum: number;
  dias_cnt: number;
}

export interface DimsHechos {
  meses: string[];
  regiones: string[];
  municipios: string[];
  municipios_por_region: Record<string, string[]>;
  regimenes: string[];
  tipos: string[];
  niveles: number[];
}

export const DIMS_VACIAS: DimsHechos = {
  meses: [],
  regiones: [],
  municipios: [],
  municipios_por_region: {},
  regimenes: [],
  tipos: [],
  niveles: [],
};

/** Formato en disco: columnar y compacto. `dims` solo viene en hechos.json. */
export interface HechosRaw {
  dims?: DimsHechos;
  campos: string[];
  filas: (string | number)[][];
}

export const HECHOS_RAW_VACIO: HechosRaw = { campos: [], filas: [] };

const MES_ABR = [
  "",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Invierte dims.municipios_por_region -> { municipio: subregión }. */
export function mapaMunicipioRegion(
  dims: DimsHechos
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [reg, munis] of Object.entries(dims.municipios_por_region))
    for (const mu of munis) m[mu] = reg;
  return m;
}

/** Expande el formato columnar a filas tipadas (sirve para ambas tablas). */
export function expandirHechos(raw: HechosRaw): HechoFila[] {
  const i = Object.fromEntries(raw.campos.map((c, k) => [c, k])) as Record<
    string,
    number
  >;
  return raw.filas.map((r) => {
    const mes = r[i.mes] as string;
    const fila: HechoFila = {
      mes,
      mes_label: MES_ABR[Number(mes.slice(5, 7))] ?? mes,
      n: r[i.n] as number,
      cerradas: r[i.cerradas] as number,
      dias_sum: r[i.dias_sum] as number,
      dias_cnt: r[i.dias_cnt] as number,
    };
    if (i.region !== undefined) fila.region = r[i.region] as string;
    if (i.municipio !== undefined) fila.municipio = r[i.municipio] as string;
    if (i.regimen !== undefined) fila.regimen = r[i.regimen] as string;
    if (i.tipo !== undefined) fila.tipo = r[i.tipo] as string;
    if (i.nivel !== undefined) fila.nivel = r[i.nivel] as number;
    return fila;
  });
}
