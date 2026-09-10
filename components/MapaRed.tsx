"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Plus, Minus, Maximize2, Waypoints, Globe2, Filter } from "lucide-react";
import {
  crearProyeccion,
  colorRegion,
  colorComunidad,
  fmtEntero,
  COLOR_REGION,
  type MapaRed as TMapaRed,
  type AntioquiaGeo,
} from "@/lib/datos";
import { useDatos } from "@/lib/useDatos";
import { useFiltros } from "@/lib/filtros";
import { useMapaPeriodo } from "@/lib/mapaPeriodo";

type Metrica = "total" | "origen" | "destino";
type ModoColor = "region" | "comunidad";
type FocoFlujo = "todos" | "top10" | "top25" | "top50" | "livianos";

const FOCO_OPCIONES: { id: FocoFlujo; label: string; corto: string }[] = [
  { id: "todos", label: "Todos los corredores", corto: "todos los corredores" },
  { id: "top10", label: "Top 10 corredores", corto: "el Top 10 de corredores" },
  { id: "top25", label: "Top 25 corredores", corto: "el Top 25 de corredores" },
  { id: "top50", label: "Top 50 corredores", corto: "el Top 50 de corredores" },
  { id: "livianos", label: "20 más livianos", corto: "los 20 corredores más livianos" },
];

const ANCHO = 960;
const ALTO = 640;
const K_MIN = 1;
const K_MAX = 9;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function MapaRed({
  data,
  modoColorInicial = "region",
  permitirComunidad = true,
  comunidadSel = null,
}: {
  data: TMapaRed;
  modoColorInicial?: ModoColor;
  permitirComunidad?: boolean;
  /** Si se pasa un id de comunidad RAS, el mapa muestra solo esa comunidad. */
  comunidadSel?: number | null;
}) {
  const [metrica, setMetrica] = useState<Metrica>("total");
  const [modoColor, setModoColor] = useState<ModoColor>(
    permitirComunidad ? modoColorInicial : "region"
  );
  const [animar, setAnimar] = useState(true);
  const [verExternos, setVerExternos] = useState(true);
  const [focoFlujo, setFocoFlujo] = useState<FocoFlujo>("todos");
  const [hover, setHover] = useState<string | null>(null);
  const [vista, setVista] = useState({ k: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrastre = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );
  const { filtros } = useFiltros();
  const [geo] = useDatos<AntioquiaGeo | null>("antioquia", null);

  // Proyecta con el bbox del departamento cuando está disponible: así el
  // contorno de Antioquia enmarca el mapa y los nodos caen en su posición real.
  const proy = useMemo(
    () => crearProyeccion(geo?.bbox ?? data.bbox, ANCHO, ALTO, 28),
    [geo, data.bbox]
  );

  const contornoPath = useMemo(() => {
    if (!geo?.outline?.length) return "";
    return (
      "M " +
      geo.outline
        .map(([lon, lat]) => {
          const [x, y] = proy(lon, lat);
          return `${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" L ") +
      " Z"
    );
  }, [geo, proy]);

  // --- Recorte por período (rango de meses de los filtros) ---
  // El hook reagrega la serie mensual de cada nodo y flujo al rango activo,
  // así que acortar el período cambia de verdad los volúmenes del mapa.
  const { nodos, flujos: flujosPeriodo, rango, meses } = useMapaPeriodo(data);
  const flujos = flujosPeriodo;

  const etiquetaPeriodo = useMemo(() => {
    if (!rango) return null;
    const bonito = (m: string) => {
      const [y, mm] = m.split("-");
      const ABR = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      return `${ABR[Number(mm)]} ${y.slice(2)}`;
    };
    return `${bonito(meses[rango[0]])} – ${bonito(meses[rango[1]])}`;
  }, [rango, meses]);

  // --- Selección geográfica: subregión / municipio ---
  const haySeleccion =
    filtros.municipios.length > 0 || filtros.regiones.length > 0;

  const esSeleccionado = useMemo(() => {
    const munis = new Set(filtros.municipios);
    const regs = new Set(filtros.regiones);
    return (nombre: string, region: string) => {
      if (munis.size) return munis.has(nombre);
      if (regs.size) return regs.has(region);
      return false;
    };
  }, [filtros.municipios, filtros.regiones]);

  // Filtro por comunidad RAS (lo controla la vista Redes·RAS)
  const comPorNombre = useMemo(
    () => new Map(nodos.map((n) => [n.nombre, n.comunidad ?? null])),
    [nodos]
  );
  const enComunidad = useCallback(
    (nombre: string) =>
      comunidadSel == null || comPorNombre.get(nombre) === comunidadSel,
    [comunidadSel, comPorNombre]
  );
  useEffect(() => {
    if (comunidadSel != null) setModoColor("comunidad");
  }, [comunidadSel]);

  const { seleccionados, conectados } = useMemo(() => {
    const sel = new Set<string>();
    const con = new Set<string>();
    if (!haySeleccion) return { seleccionados: sel, conectados: con };
    for (const n of nodos)
      if (esSeleccionado(n.nombre, n.region)) sel.add(n.nombre);
    for (const f of flujos) {
      if (sel.has(f.o)) con.add(f.d);
      if (sel.has(f.d)) con.add(f.o);
    }
    for (const s of sel) con.delete(s);
    return { seleccionados: sel, conectados: con };
  }, [nodos, flujos, haySeleccion, esSeleccionado]);

  const visible = useCallback(
    (nombre: string) =>
      enComunidad(nombre) &&
      (!haySeleccion || seleccionados.has(nombre) || conectados.has(nombre)),
    [haySeleccion, seleccionados, conectados, enComunidad]
  );
  const flujoVisible = useCallback(
    (f: { o: string; d: string }) =>
      enComunidad(f.o) &&
      enComunidad(f.d) &&
      (!haySeleccion || seleccionados.has(f.o) || seleccionados.has(f.d)),
    [haySeleccion, seleccionados, enComunidad]
  );

  const valorNodo = useCallback(
    (n: TMapaRed["nodos"][number]) =>
      metrica === "origen"
        ? n.origen
        : metrica === "destino"
        ? n.destino
        : n.origen + n.destino,
    [metrica]
  );

  // Corredores en foco: top N (o cola) por volumen entre los ya filtrados
  // por período y selección geográfica.
  const flujosVisibles = useMemo(() => {
    const base = flujos.filter(flujoVisible);
    if (focoFlujo === "todos") return base;
    const orden = [...base].sort((a, b) => b.valor - a.valor);
    if (focoFlujo === "livianos") return orden.slice(-20);
    const n = focoFlujo === "top10" ? 10 : focoFlujo === "top25" ? 25 : 50;
    return orden.slice(0, n);
  }, [flujos, flujoVisible, focoFlujo]);

  // Al enfocar corredores, el mapa solo deja los municipios que esos arcos tocan
  // (más los de la selección geográfica, si la hay).
  const nombresEnFoco = useMemo(() => {
    if (focoFlujo === "todos") return null;
    const s = new Set<string>();
    for (const f of flujosVisibles) {
      s.add(f.o);
      s.add(f.d);
    }
    return s;
  }, [focoFlujo, flujosVisibles]);

  const nodosVisibles = useMemo(
    () =>
      nodos.filter(
        (n) =>
          visible(n.nombre) &&
          (!nombresEnFoco ||
            nombresEnFoco.has(n.nombre) ||
            seleccionados.has(n.nombre))
      ),
    [nodos, visible, nombresEnFoco, seleccionados]
  );

  const maxNodo = useMemo(
    () => Math.max(1, ...nodosVisibles.map(valorNodo)),
    [nodosVisibles, valorNodo]
  );
  const maxFlujo = useMemo(
    () => Math.max(1, ...flujosVisibles.map((f) => f.valor)),
    [flujosVisibles]
  );

  const radio = (n: TMapaRed["nodos"][number]) =>
    2.5 + Math.sqrt(valorNodo(n) / maxNodo) * 17;

  const colorNodo = (n: TMapaRed["nodos"][number]) =>
    modoColor === "comunidad"
      ? colorComunidad(n.comunidad)
      : colorRegion(n.region);

  const nodosOrden = useMemo(
    () => [...nodosVisibles].sort((a, b) => valorNodo(b) - valorNodo(a)),
    [nodosVisibles, valorNodo]
  );
  const flujosOrden = useMemo(
    () => [...flujosVisibles].sort((a, b) => a.valor - b.valor),
    [flujosVisibles]
  );
  const topFlujos = useMemo(
    () =>
      new Set(
        [...flujosVisibles]
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8)
          .map((f) => `${f.o}→${f.d}`)
      ),
    [flujosVisibles]
  );

  // Flujos que llevan partículas animadas (los más intensos visibles)
  const flujosAnim = useMemo(
    () =>
      [...flujosVisibles]
        .sort((a, b) => b.valor - a.valor)
        .slice(0, haySeleccion ? 30 : 22),
    [flujosVisibles, haySeleccion]
  );

  const regionesUsadas = useMemo(
    () =>
      Object.keys(COLOR_REGION).filter((r) =>
        nodosVisibles.some((n) => n.region === r)
      ),
    [nodosVisibles]
  );
  const comunidadesUsadas = useMemo(() => {
    const ids = new Set<number>();
    for (const n of nodosVisibles) if (n.comunidad != null) ids.add(n.comunidad);
    return [...ids].sort((a, b) => a - b);
  }, [nodosVisibles]);

  // --- Auto-encuadre al filtrar: acerca a los nodos visibles ---
  const claveSel = `${filtros.regiones.join()}|${filtros.municipios.join()}|c${comunidadSel ?? ""}`;
  useEffect(() => {
    if ((!haySeleccion && comunidadSel == null) || nodosVisibles.length === 0) {
      setVista({ k: 1, tx: 0, ty: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodosVisibles) {
      const [x, y] = proy(n.lon, n.lat);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = 70;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + pad * 2);
    const k = clamp(Math.min(ANCHO / w, ALTO / h), K_MIN, K_MAX);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setVista({
      k,
      tx: clamp(ANCHO / 2 - k * cx, ANCHO * (1 - k), 0),
      ty: clamp(ALTO / 2 - k * cy, ALTO * (1 - k), 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSel, proy]);

  // --- Zoom con rueda (listener no pasivo) ---
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * ANCHO;
      const py = ((e.clientY - rect.top) / rect.height) * ALTO;
      setVista((v) => {
        const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        const k = clamp(v.k * f, K_MIN, K_MAX);
        const r = k / v.k;
        return {
          k,
          tx: clamp(px - r * (px - v.tx), ANCHO * (1 - k), 0),
          ty: clamp(py - r * (py - v.ty), ALTO * (1 - k), 0),
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const zoom = (dir: 1 | -1) =>
    setVista((v) => {
      const k = clamp(v.k * (dir === 1 ? 1.4 : 1 / 1.4), K_MIN, K_MAX);
      const r = k / v.k;
      const cx = ANCHO / 2;
      const cy = ALTO / 2;
      return {
        k,
        tx: clamp(cx - r * (cx - v.tx), ANCHO * (1 - k), 0),
        ty: clamp(cy - r * (cy - v.ty), ALTO * (1 - k), 0),
      };
    });
  const resetVista = () => setVista({ k: 1, tx: 0, ty: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, tx: vista.tx, ty: vista.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - a.x) / rect.width) * ANCHO;
    const dy = ((e.clientY - a.y) / rect.height) * ALTO;
    setVista((v) => ({
      k: v.k,
      tx: clamp(a.tx + dx, ANCHO * (1 - v.k), 0),
      ty: clamp(a.ty + dy, ALTO * (1 - v.k), 0),
    }));
  };
  const onPointerUp = () => {
    arrastre.current = null;
  };

  const nodoHover = hover ? nodos.find((n) => n.nombre === hover) : null;
  const posHover = nodoHover ? proy(nodoHover.lon, nodoHover.lat) : null;
  const posHoverPx = posHover
    ? [posHover[0] * vista.k + vista.tx, posHover[1] * vista.k + vista.ty]
    : null;

  const curva = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const norm = Math.hypot(dx, dy) || 1;
    const curv = Math.min(60, norm * 0.18);
    const cx = mx - (dy / norm) * curv;
    const cy = my + (dx / norm) * curv;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  const arcoPath = (f: TMapaRed["flujos"][number]) => {
    const [x1, y1] = proy(f.olon, f.olat);
    const [x2, y2] = proy(f.dlon, f.dlat);
    return curva(x1, y1, x2, y2);
  };

  // --- Lugares fuera de Antioquia (borde del recuadro) ---
  const externos = useMemo(() => {
    if (!data.externos) return [];
    const pos = new Map(nodos.map((n) => [n.nombre, proy(n.lon, n.lat)]));
    const m = 18;
    const arm = (
      arr: NonNullable<TMapaRed["externos"]>["destinos"],
      tipo: "salida" | "entrada"
    ) =>
      arr.map((e) => {
        const [rx, ry] = proy(e.lon, e.lat);
        // pequeño desfase por tipo para que no se solapen salida y entrada
        const dy = tipo === "salida" ? -9 : 9;
        const x = clamp(rx, m, ANCHO - m);
        const y = clamp(ry + dy, m, ALTO - m);
        const a = (e.ancla && pos.get(e.ancla)) || [ANCHO / 2, ALTO * 0.62];
        return { ...e, tipo, x, y, ax: a[0], ay: a[1] };
      });
    return [
      ...arm(data.externos.destinos, "salida"),
      ...arm(data.externos.origenes, "entrada"),
    ];
  }, [data.externos, nodos, proy]);
  const maxExterno = Math.max(1, ...externos.map((e) => e.valor));
  const colorExterno = (t: "salida" | "entrada") =>
    t === "salida" ? "#d97706" : "#0ea5e9";

  return (
    <div className="relative">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-brand-gray3 overflow-hidden text-xs font-bold">
            {(
              [
                ["total", "Actividad total"],
                ["origen", "Emisor"],
                ["destino", "Receptor"],
              ] as [Metrica, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMetrica(m)}
                className={clsx(
                  "px-3 py-1.5 transition-colors",
                  metrica === m
                    ? "bg-savia-green text-white"
                    : "bg-white text-brand-muted hover:bg-brand-low"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {permitirComunidad && (
            <div className="inline-flex rounded-lg border border-brand-gray3 overflow-hidden text-xs font-bold">
              {(
                [
                  ["region", "Por subregión"],
                  ["comunidad", "Por comunidad RAS"],
                ] as [ModoColor, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setModoColor(m)}
                  className={clsx(
                    "px-3 py-1.5 transition-colors",
                    modoColor === m
                      ? "bg-savia-teal text-white"
                      : "bg-white text-brand-muted hover:bg-brand-low"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setAnimar((a) => !a)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
              animar
                ? "border-savia-green bg-savia-ice text-savia-deep"
                : "border-brand-gray3 bg-white text-brand-muted hover:bg-brand-low"
            )}
          >
            <Waypoints size={13} />
            Flujo animado
          </button>
          {data.externos && (
            <button
              onClick={() => setVerExternos((a) => !a)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                verExternos
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-brand-gray3 bg-white text-brand-muted hover:bg-brand-low"
              )}
            >
              <Globe2 size={13} />
              Fuera de Antioquia
            </button>
          )}
          <label
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors",
              focoFlujo !== "todos"
                ? "border-savia-green bg-savia-ice text-savia-deep"
                : "border-brand-gray3 bg-white text-brand-muted"
            )}
          >
            <Filter size={13} />
            <span className="sr-only">Corredores mostrados</span>
            <select
              value={focoFlujo}
              onChange={(e) => setFocoFlujo(e.target.value as FocoFlujo)}
              className="bg-transparent font-bold focus:outline-none"
            >
              {FOCO_OPCIONES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-brand-gray1">
          {etiquetaPeriodo && (
            <span className="rounded-full bg-savia-ice text-savia-deep font-bold px-2 py-0.5 border border-savia-mint">
              {etiquetaPeriodo}
            </span>
          )}
          <span>Rueda para acercar · arrastra para desplazar</span>
        </div>
      </div>

      {/* Cómo leer el mapa */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-brand-gray3 bg-brand-low/60 px-3 py-2 text-[11px] font-semibold text-brand-muted">
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray1">
          Cómo leer
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" fill="#00954c" opacity="0.75" />
            <circle cx="19" cy="5" r="2.4" fill="#00954c" opacity="0.75" />
          </svg>
          Municipio · tamaño = volumen
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="10" aria-hidden>
            <line x1="1" y1="5" x2="25" y2="5" stroke="#00954c" strokeWidth="2.5" strokeOpacity="0.6" />
          </svg>
          Arco continuo = flujo entre municipios (grosor = intensidad)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="26" height="10" aria-hidden>
            <line x1="1" y1="5" x2="25" y2="5" stroke="#00693b" strokeWidth="2.5" strokeDasharray="2 4" />
          </svg>
          {focoFlujo === "todos"
            ? "Punteado animado = los 8 corredores más cargados"
            : `Mostrando ${
                FOCO_OPCIONES.find((o) => o.id === focoFlujo)?.corto
              } · el resto está oculto`}
        </span>
        {animar && (
          <span className="flex items-center gap-1.5">
            <svg width="26" height="10" aria-hidden>
              <circle cx="7" cy="5" r="2.2" fill="#0b3d2c" />
              <circle cx="15" cy="5" r="2.2" fill="#0b3d2c" opacity="0.6" />
              <circle cx="22" cy="5" r="2.2" fill="#0b3d2c" opacity="0.3" />
            </svg>
            Puntos que corren = sentido y ritmo del flujo
          </span>
        )}
        {verExternos && data.externos && (
          <span className="flex items-center gap-1.5">
            <svg width="26" height="12" aria-hidden>
              <line x1="1" y1="6" x2="16" y2="6" stroke="#d97706" strokeWidth="1.6" strokeDasharray="3 3" />
              <rect x="16" y="2" width="8" height="8" transform="rotate(45 20 6)" fill="#fff" stroke="#d97706" strokeWidth="1.6" />
            </svg>
            Rombo en el borde = cruza la frontera del departamento
          </span>
        )}
      </div>

      {haySeleccion && (
        <p className="mb-3 text-xs text-savia-deep bg-savia-ice border border-savia-mint rounded-lg px-3 py-2">
          Vista acercada a <b>{seleccionados.size}</b> municipio(s) de la
          selección y <b>{conectados.size}</b> conectado(s) por remisión. El
          resto de la red está oculto.
        </p>
      )}

      {focoFlujo !== "todos" && (
        <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-savia-deep bg-savia-ice border border-savia-mint rounded-lg px-3 py-2">
          <span>
            Mapa limitado a{" "}
            <b>{FOCO_OPCIONES.find((o) => o.id === focoFlujo)?.corto}</b> —{" "}
            <b>{flujosVisibles.length}</b> arco(s) y los{" "}
            <b>{nodosVisibles.length}</b> municipio(s) que conectan.
          </span>
          <button
            onClick={() => setFocoFlujo("todos")}
            className="font-bold underline underline-offset-2 hover:text-savia-forest"
          >
            Ver todos
          </button>
        </p>
      )}

      <div className="relative rounded-xl border border-brand-gray3 bg-gradient-to-b from-[#e8f0ed] to-[#dae6e2] overflow-hidden">
        {/* Controles de zoom */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
          <button
            onClick={() => zoom(1)}
            aria-label="Acercar"
            className="w-8 h-8 grid place-items-center rounded-lg bg-white/90 border border-brand-gray3 text-savia-forest hover:bg-white shadow-sm"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={() => zoom(-1)}
            aria-label="Alejar"
            className="w-8 h-8 grid place-items-center rounded-lg bg-white/90 border border-brand-gray3 text-savia-forest hover:bg-white shadow-sm"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={resetVista}
            aria-label="Restablecer vista"
            className="w-8 h-8 grid place-items-center rounded-lg bg-white/90 border border-brand-gray3 text-savia-forest hover:bg-white shadow-sm"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="Mapa de red de remisiones por municipio"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <defs>
            <radialGradient id="halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00954c" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#00954c" stopOpacity={0} />
            </radialGradient>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="landShadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="6"
                floodColor="#0b3d2c"
                floodOpacity="0.14"
              />
            </filter>
          </defs>

          {/* fondo para captar el arrastre */}
          <rect x={0} y={0} width={ANCHO} height={ALTO} fill="transparent" />

          <g transform={`translate(${vista.tx} ${vista.ty}) scale(${vista.k})`}>
            {/* Silueta del departamento de Antioquia */}
            {contornoPath && (
              <path
                d={contornoPath}
                fill="#fbfdfb"
                stroke="#a9ccbb"
                strokeWidth={1.3 / vista.k}
                strokeLinejoin="round"
                filter="url(#landShadow)"
                pointerEvents="none"
              />
            )}
            {nodosOrden[0] && !haySeleccion && (
              (() => {
                const [x, y] = proy(nodosOrden[0].lon, nodosOrden[0].lat);
                return <circle cx={x} cy={y} r={90} fill="url(#halo)" />;
              })()
            )}

            {/* Arcos de flujo */}
            <g fill="none">
              {flujosOrden.map((f, i) => {
                const t = f.valor / maxFlujo;
                const esTop = topFlujos.has(`${f.o}→${f.d}`);
                const activo = hover && (f.o === hover || f.d === hover);
                const opacidad = hover
                  ? activo
                    ? 0.9
                    : 0.05
                  : haySeleccion
                  ? 0.25 + t * 0.55
                  : 0.12 + t * 0.5;
                return (
                  <path
                    key={i}
                    d={arcoPath(f)}
                    stroke={
                      modoColor === "comunidad"
                        ? "#7c8b83"
                        : colorRegion(f.region_o)
                    }
                    strokeWidth={(0.6 + Math.sqrt(t) * 5) / Math.sqrt(vista.k)}
                    strokeOpacity={opacidad}
                    strokeLinecap="round"
                    className={clsx(esTop && !hover && "mapa-flujo-anim")}
                    style={esTop ? { strokeDasharray: "2 6" } : undefined}
                  />
                );
              })}
            </g>

            {/* Partículas animadas de flujo */}
            {animar && (
              <g className="motion-reduce:hidden">
                {flujosAnim.map((f, i) => {
                  const t = f.valor / maxFlujo;
                  const dur = clamp(6 - Math.sqrt(t) * 4, 1.6, 6);
                  const n = 1 + Math.round(t * 2);
                  const col =
                    modoColor === "comunidad" ? "#0b3d2c" : colorRegion(f.region_o);
                  const d = arcoPath(f);
                  return (
                    <g key={`p${i}`}>
                      {Array.from({ length: n }).map((_, j) => (
                        <circle
                          key={j}
                          r={2.4 / Math.sqrt(vista.k)}
                          fill={col}
                          opacity={hover ? 0.15 : 0.85}
                        >
                          <animateMotion
                            dur={`${dur}s`}
                            begin={`${(j * dur) / n}s`}
                            repeatCount="indefinite"
                            path={d}
                            rotate="auto"
                          />
                        </circle>
                      ))}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Nodos */}
            <g>
              {nodosOrden.map((n) => {
                const [x, y] = proy(n.lon, n.lat);
                const r = radio(n) / Math.sqrt(vista.k);
                const activo = hover === n.nombre;
                const sel = seleccionados.has(n.nombre);
                const atenuado = hover ? !activo : false;
                return (
                  <circle
                    key={n.nombre}
                    cx={x}
                    cy={y}
                    r={r}
                    fill={colorNodo(n)}
                    fillOpacity={atenuado ? 0.22 : sel ? 0.95 : 0.72}
                    stroke={sel ? "#0b3d2c" : "#fff"}
                    strokeWidth={(activo || sel ? 2 : 0.8) / Math.sqrt(vista.k)}
                    filter={activo || sel ? "url(#glow)" : undefined}
                    className="cursor-pointer transition-[fill-opacity]"
                    onMouseEnter={() => setHover(n.nombre)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>

            {/* Lugares fuera de Antioquia, en el borde del recuadro */}
            {verExternos && externos.length > 0 && (
              <g>
                {externos.map((e, i) => {
                  const col = colorExterno(e.tipo);
                  const t = e.valor / maxExterno;
                  const s = (4 + Math.sqrt(t) * 8) / Math.sqrt(vista.k);
                  const desde =
                    e.tipo === "salida" ? [e.ax, e.ay] : [e.x, e.y];
                  const hasta =
                    e.tipo === "salida" ? [e.x, e.y] : [e.ax, e.ay];
                  return (
                    <g
                      key={`ext-${i}`}
                      opacity={hover ? 0.18 : 1}
                      className="pointer-events-none"
                    >
                      <path
                        d={curva(desde[0], desde[1], hasta[0], hasta[1])}
                        fill="none"
                        stroke={col}
                        strokeWidth={(0.6 + Math.sqrt(t) * 2.6) / Math.sqrt(vista.k)}
                        strokeOpacity={0.38}
                        strokeDasharray={`${4 / vista.k} ${4 / vista.k}`}
                        strokeLinecap="round"
                      />
                      <rect
                        x={e.x - s}
                        y={e.y - s}
                        width={s * 2}
                        height={s * 2}
                        transform={`rotate(45 ${e.x} ${e.y})`}
                        fill="#fff"
                        stroke={col}
                        strokeWidth={1.6 / Math.sqrt(vista.k)}
                      >
                        <title>
                          {e.tipo === "salida" ? "Salen a " : "Vienen de "}
                          {e.nombre}: {fmtEntero(e.valor)}
                        </title>
                      </rect>
                      <text
                        x={e.x}
                        y={e.y - s - 4 / vista.k}
                        textAnchor="middle"
                        style={{
                          fontSize: 9.5 / Math.sqrt(vista.k),
                          fontWeight: 800,
                          paintOrder: "stroke",
                          stroke: "#fbfdfb",
                          strokeWidth: 3 / vista.k,
                        }}
                        fill={col}
                      >
                        {e.nombre}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Etiquetas de los mayores hubs (sin solaparse) */}
            <g className="pointer-events-none">
              {(() => {
                const puestas: [number, number][] = [];
                return nodosOrden.slice(0, haySeleccion ? 18 : 12).map((n) => {
                  const [x, y] = proy(n.lon, n.lat);
                  const cerca = puestas.some(
                    ([px, py]) => Math.hypot(px - x, py - y) < 46 / vista.k
                  );
                  if (cerca) return null;
                  puestas.push([x, y]);
                  return (
                    <text
                      key={n.nombre}
                      x={x}
                      y={y - radio(n) / Math.sqrt(vista.k) - 5 / vista.k}
                      textAnchor="middle"
                      style={{
                        fontSize: 10.5 / Math.sqrt(vista.k),
                        fontWeight: 800,
                        paintOrder: "stroke",
                        stroke: "#fbfdfb",
                        strokeWidth: 3 / vista.k,
                      }}
                      className="fill-savia-forest"
                    >
                      {n.nombre}
                    </text>
                  );
                });
              })()}
            </g>
          </g>
        </svg>
      </div>

      {/* Tooltip flotante */}
      {nodoHover && posHoverPx && (
        <div
          className="absolute z-10 bg-white border border-brand-gray3 rounded-xl p-3 shadow-card-lg text-xs pointer-events-none min-w-[10rem]"
          style={{
            left: `${(posHoverPx[0] / ANCHO) * 100}%`,
            top: `${(posHoverPx[1] / ALTO) * 100}%`,
            transform: "translate(-50%, calc(-100% - 14px))",
          }}
        >
          <p className="font-bold text-savia-forest">{nodoHover.nombre}</p>
          <p className="text-brand-gray1 mb-1.5">
            {nodoHover.region}
            {modoColor === "comunidad" && nodoHover.comunidad != null && (
              <> · Comunidad {nodoHover.comunidad}</>
            )}
          </p>
          <div className="flex justify-between gap-4">
            <span className="text-brand-muted">Emitidas</span>
            <span className="font-bold">{fmtEntero(nodoHover.origen)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-brand-muted">Recibidas</span>
            <span className="font-bold">{fmtEntero(nodoHover.destino)}</span>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
        {modoColor === "region"
          ? regionesUsadas.map((r) => (
              <span
                key={r}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: colorRegion(r) }}
                />
                {r}
              </span>
            ))
          : comunidadesUsadas.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: colorComunidad(id) }}
                />
                Comunidad {id}
              </span>
            ))}
        {verExternos && data.externos && (
          <>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted">
              <span className="w-2.5 h-2.5 rotate-45 border-2 bg-white border-amber-600" />
              Sale del departamento
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted">
              <span className="w-2.5 h-2.5 rotate-45 border-2 bg-white border-sky-500" />
              Entra al departamento
            </span>
          </>
        )}
      </div>
      {modoColor === "comunidad" && (
        <p className="mt-2 text-[11px] text-brand-gray1">
          Cada color agrupa los municipios cuyas sedes se remiten sobre todo
          entre sí (detección de comunidades Louvain sobre el grafo de
          remisiones). Es el mismo circuito que analiza la vista{" "}
          <b>Redes · RAS</b>, proyectado sobre el mapa.
        </p>
      )}
      {verExternos && data.externos && (
        <p className="mt-2 text-[11px] text-brand-gray1">
          Los rombos en el borde son remisiones que cruzan la frontera de
          Antioquia:{" "}
          <b>{fmtEntero(data.externos.total_salidas)}</b> salen del departamento
          (sobre todo a Montería) y{" "}
          <b>{fmtEntero(data.externos.total_entradas)}</b> llegan desde otros
          departamentos. Su posición es aproximada — solo indica la dirección.
        </p>
      )}
    </div>
  );
}
