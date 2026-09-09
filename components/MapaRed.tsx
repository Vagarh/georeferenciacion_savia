"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Plus, Minus, Maximize2, Waypoints, Globe2 } from "lucide-react";
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

type Metrica = "total" | "origen" | "destino";
type ModoColor = "region" | "comunidad";

const ANCHO = 960;
const ALTO = 640;
const K_MIN = 1;
const K_MAX = 9;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function MapaRed({
  data,
  modoColorInicial = "region",
  permitirComunidad = true,
}: {
  data: TMapaRed;
  modoColorInicial?: ModoColor;
  permitirComunidad?: boolean;
}) {
  const [metrica, setMetrica] = useState<Metrica>("total");
  const [modoColor, setModoColor] = useState<ModoColor>(
    permitirComunidad ? modoColorInicial : "region"
  );
  const [animar, setAnimar] = useState(true);
  const [verExternos, setVerExternos] = useState(true);
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

  // --- Rango de meses activo (recalcula volúmenes por período) ---
  const meses = data.meses ?? [];
  const rango = useMemo(() => {
    if (!meses.length) return null;
    const desde = filtros.mesDesde ?? meses[0];
    const hasta = filtros.mesHasta ?? meses[meses.length - 1];
    const iDesde = Math.max(0, meses.indexOf(desde));
    const iHasta =
      meses.indexOf(hasta) < 0 ? meses.length - 1 : meses.indexOf(hasta);
    if (iDesde <= 0 && iHasta >= meses.length - 1) return null;
    return [iDesde, iHasta] as [number, number];
  }, [meses, filtros.mesDesde, filtros.mesHasta]);

  const enRango = useCallback(
    (i: number) => !rango || (i >= rango[0] && i <= rango[1]),
    [rango]
  );

  const nodos = useMemo(() => {
    if (!rango) return data.nodos;
    return data.nodos.map((n) => {
      let o = 0;
      let d = 0;
      for (const [i, so, sd] of n.serie ?? [])
        if (enRango(i)) {
          o += so;
          d += sd;
        }
      return { ...n, origen: o, destino: d };
    });
  }, [data.nodos, rango, enRango]);

  const flujos = useMemo(() => {
    if (!rango) return data.flujos;
    return data.flujos
      .map((f) => {
        let v = 0;
        for (const [i, sv] of f.serie ?? []) if (enRango(i)) v += sv;
        return { ...f, valor: v };
      })
      .filter((f) => f.valor > 0);
  }, [data.flujos, rango, enRango]);

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
      !haySeleccion || seleccionados.has(nombre) || conectados.has(nombre),
    [haySeleccion, seleccionados, conectados]
  );
  const flujoVisible = useCallback(
    (f: { o: string; d: string }) =>
      !haySeleccion || seleccionados.has(f.o) || seleccionados.has(f.d),
    [haySeleccion, seleccionados]
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

  const nodosVisibles = useMemo(
    () => nodos.filter((n) => visible(n.nombre)),
    [nodos, visible]
  );
  const flujosVisibles = useMemo(
    () => flujos.filter(flujoVisible),
    [flujos, flujoVisible]
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
  const claveSel = `${filtros.regiones.join()}|${filtros.municipios.join()}`;
  useEffect(() => {
    if (!haySeleccion || nodosVisibles.length === 0) {
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
        </div>
        <p className="text-[11px] text-brand-gray1">
          Rueda para acercar · arrastra para desplazar · tamaño del punto =
          volumen
        </p>
      </div>

      {haySeleccion && (
        <p className="mb-3 text-xs text-savia-deep bg-savia-ice border border-savia-mint rounded-lg px-3 py-2">
          Vista acercada a <b>{seleccionados.size}</b> municipio(s) de la
          selección y <b>{conectados.size}</b> conectado(s) por remisión. El
          resto de la red está oculto.
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
