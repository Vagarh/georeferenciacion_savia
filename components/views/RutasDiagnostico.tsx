"use client";

import { useMemo, useState } from "react";
import {
  Stethoscope,
  ArrowRight,
  Route,
  Users,
  Timer,
  Compass,
  Grid3x3,
  MoveRight,
  Waypoints,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import FiltroBar from "@/components/FiltroBar";
import MapaRed from "@/components/MapaRed";
import PanelInsights, { ComoLeer } from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtEntero,
  fmtPct,
  fmtDecimal,
  escalaVerde,
  colorRegion,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type HechosRaw,
  type FlujoDiagnosticos,
  type MapaRed as TMapaRed,
} from "@/lib/datos";

const VACIO: FlujoDiagnosticos = {
  municipios: [],
  diagnosticos: [],
  por_diagnostico: {},
};

export default function RutasDiagnostico() {
  const [data] = useDatos<FlujoDiagnosticos>("flujo_diagnosticos", VACIO);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const dims = rawH.dims ?? DIMS_VACIAS;
  const hayHechos = (rawH.filas?.length ?? 0) > 0;

  const [sel, setSel] = useState<string>("");
  const diag = sel || data.diagnosticos[0]?.nombre || "";
  const bloque = data.por_diagnostico[diag];

  // Construye un mapa de red específico para el diagnóstico seleccionado
  const mapa = useMemo<TMapaRed>(() => {
    const M = data.municipios;
    if (!bloque || M.length === 0)
      return {
        nodos: [],
        flujos: [],
        bbox: { minLon: -77, maxLon: -74, minLat: 5.5, maxLat: 8.9 },
        resumen: {
          municipios: 0,
          flujos_intermunicipales: 0,
          remisiones_mismo_municipio: 0,
          pct_intermunicipal: 0,
        },
      };

    const orig = new Map<number, number>();
    const dest = new Map<number, number>();
    for (const [o, d, v] of bloque.flujos) {
      orig.set(o, (orig.get(o) ?? 0) + v);
      dest.set(d, (dest.get(d) ?? 0) + v);
    }
    const usados = new Set<number>([...orig.keys(), ...dest.keys()]);
    const nodos = [...usados].map((i) => ({
      nombre: M[i].nombre,
      region: M[i].region,
      lon: M[i].lon,
      lat: M[i].lat,
      origen: orig.get(i) ?? 0,
      destino: dest.get(i) ?? 0,
    }));
    const flujos = bloque.flujos.map(([o, d, v]) => ({
      o: M[o].nombre,
      d: M[d].nombre,
      region_o: M[o].region,
      olon: M[o].lon,
      olat: M[o].lat,
      dlon: M[d].lon,
      dlat: M[d].lat,
      valor: v,
    }));
    const lons = nodos.map((n) => n.lon);
    const lats = nodos.map((n) => n.lat);
    return {
      nodos,
      flujos,
      bbox: {
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
      },
      resumen: {
        municipios: nodos.length,
        flujos_intermunicipales: bloque.intermunicipal,
        remisiones_mismo_municipio: 0,
        pct_intermunicipal: bloque.pct_intermunicipal,
      },
    };
  }, [bloque, data.municipios]);

  const maxRuta = bloque?.rutas[0]?.valor ?? 1;

  // Matriz subregión → subregión
  const regiones = useMemo(() => {
    if (!bloque) return [];
    const s = new Set<string>();
    for (const c of bloque.celdas_region) {
      s.add(c.o);
      s.add(c.d);
    }
    return [...s].sort();
  }, [bloque]);
  const celda = (o: string, d: string) =>
    bloque?.celdas_region.find((c) => c.o === o && c.d === d)?.v ?? 0;
  const maxCelda = Math.max(1, ...(bloque?.celdas_region.map((c) => c.v) ?? [1]));

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Rutas clínicas"
        titulo="Flujo por"
        resaltado="Diagnóstico"
        descripcion="Para los diagnósticos principales más frecuentes: por dónde viaja el paciente cuando lo remiten. El mapa dibuja la ruta origen → destino entre municipios y la tabla lista los pares de sedes que más concentran ese diagnóstico."
      />

      {/* Selector de diagnóstico */}
      <div className="card animate-fade-up !p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-savia-forest shrink-0">
            <Stethoscope size={15} />
            Diagnóstico principal
          </label>
          <select
            value={diag}
            onChange={(e) => setSel(e.target.value)}
            className="w-full md:max-w-xl text-sm font-semibold border border-brand-gray3 rounded-lg px-3 py-2 bg-white text-savia-forest focus:outline-none focus:border-savia-green"
          >
            {data.diagnosticos.map((d) => (
              <option key={d.nombre} value={d.nombre}>
                {d.nombre} · {fmtEntero(d.total)} remisiones
              </option>
            ))}
          </select>
        </div>
      </div>

      {hayHechos && <FiltroBar dims={dims} soloGeo />}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Remisiones del diagnóstico"
          value={fmtEntero(bloque?.total)}
          subtitle={`${fmtPct(bloque?.pct_intermunicipal, 0)} cruzan de municipio`}
          icon={<Route size={18} />}
          delay={0}
        />
        <KPICard
          title="Sale de su subregión"
          value={fmtPct(bloque?.pct_fuera_subregion, 0)}
          subtitle="Se resuelve en otra subregión de Antioquia"
          trend="neutral"
          trendLabel="derivación"
          icon={<Compass size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Edad promedio"
          value={`${fmtDecimal(bloque?.edad_promedio)} años`}
          subtitle={`Cierre medio: ${fmtDecimal(bloque?.dias_promedio)} días`}
          icon={<Users size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={150}
        />
        <KPICard
          title="Tasa de cierre"
          value={fmtPct(bloque?.tasa_cierre, 0)}
          subtitle={`Contrarreferencia: ${fmtPct(
            bloque?.pct_contrarreferencia,
            1
          )}`}
          trend="up"
          trendLabel="cierre"
          icon={<Timer size={18} />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          delay={225}
        />
      </section>

      <ChartCard
        titulo={`Ruta de remisión · ${diag}`}
        subtitulo="Municipio de origen → municipio de destino · rueda para acercar, arrastra para desplazar"
        accion={
          <span className="badge-green">
            <Waypoints size={13} /> {fmtEntero(mapa.nodos.length)} municipios
          </span>
        }
      >
        {mapa.flujos.length > 0 ? (
          <MapaRed data={mapa} permitirComunidad={false} />
        ) : (
          <div className="h-[360px] grid place-items-center text-sm text-brand-gray1">
            Sin rutas intermunicipales suficientes para este diagnóstico.
          </div>
        )}
        <ComoLeer>
          Cada arco es un par origen→destino de este diagnóstico; el grosor y las
          partículas indican cuántas remisiones lo recorren. Filtra por subregión
          arriba para quedarte solo con las rutas que la tocan.
        </ComoLeer>
      </ChartCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Pares de sedes que más concentran el diagnóstico"
          subtitulo="Top 10 rutas sede de origen → sede de destino"
        >
          <div className="space-y-2.5">
            {(bloque?.rutas ?? []).map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] items-center gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-savia-forest truncate">
                    <span className="truncate">{r.origen}</span>
                    <ArrowRight size={13} className="text-brand-gray1 shrink-0" />
                    <span className="truncate text-brand-muted">{r.destino}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-brand-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(r.valor / maxRuta) * 100}%`,
                        background:
                          r.origen === r.destino ? "#4fc3c7" : "#00954c",
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-black text-savia-forest tabular-nums">
                  {fmtEntero(r.valor)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-brand-gray1">
            Las barras en tono agua son remisiones dentro de la misma sede
            (entre servicios o niveles).
          </p>
        </ChartCard>

        <ChartCard
          titulo="Flujo entre subregiones"
          subtitulo="Origen (fila) → destino (columna) para este diagnóstico"
          className="overflow-x-auto"
        >
          {regiones.length > 0 ? (
            <table className="w-full border-separate border-spacing-1 min-w-[420px]">
              <thead>
                <tr>
                  <th className="w-24" />
                  {regiones.map((r) => (
                    <th
                      key={r}
                      className="text-[9px] font-bold text-brand-muted uppercase tracking-wide pb-1 align-bottom"
                    >
                      <div className="h-16 flex items-end justify-center">
                        <span className="-rotate-45 origin-bottom-left whitespace-nowrap translate-x-2">
                          {r}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regiones.map((o) => (
                  <tr key={o}>
                    <td className="text-[10px] font-bold text-savia-forest pr-2 text-right whitespace-nowrap">
                      {o}
                    </td>
                    {regiones.map((d) => {
                      const v = celda(o, d);
                      const t = v / maxCelda;
                      return (
                        <td
                          key={d}
                          title={`${o} → ${d}: ${fmtEntero(v)}`}
                          className="h-9 rounded-md text-center text-[10px] font-bold"
                          style={{
                            background:
                              v === 0
                                ? "#f4f7f5"
                                : escalaVerde(0.15 + t * 0.85),
                            color: t > 0.5 ? "#fff" : "#0b3d2c",
                          }}
                        >
                          {v > 0 ? fmtEntero(v) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-brand-muted">Sin datos de subregión.</p>
          )}
          <p className="mt-3 text-[11px] text-brand-gray1">
            La diagonal es la atención resuelta dentro de la propia subregión;
            todo lo demás es derivación territorial.
          </p>
        </ChartCard>
      </section>

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <Stethoscope size={20} />,
            titulo: "Para qué sirve esta vista",
            texto: (
              <>
                Muestra la <b>geografía de la resolución</b> por patología: qué
                diagnósticos se atienden cerca del paciente y cuáles obligan a
                trasladarlo. Es la base para decidir dónde reforzar servicios
                (p. ej. hemodinamia para el infarto, cirugía para la apendicitis)
                y para negociar rutas con la red contratada.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <MoveRight size={20} />,
            titulo: "Lectura del mapa",
            texto: (
              <>
                {bloque ? (
                  <>
                    <b>{fmtPct(bloque.pct_fuera_subregion, 0)}</b> de las
                    remisiones de <i>{diag.toLowerCase()}</i> se resuelven fuera
                    de la subregión de origen y{" "}
                    <b>{fmtPct(bloque.pct_intermunicipal, 0)}</b> cruzan de
                    municipio. El arco más grueso marca el corredor dominante de
                    esta patología.
                  </>
                ) : (
                  "Selecciona un diagnóstico para ver su ruta."
                )}
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Grid3x3 size={20} />,
            titulo: "Diagnóstico principal, no procedimiento",
            texto: (
              <>
                El dato es el <b>diagnóstico principal registrado en la
                solicitud</b> (CIE-10), no el desenlace clínico ni el
                procedimiento realizado. Diagnósticos muy inespecíficos («dolor
                abdominal no especificado») concentran volumen pero dicen poco
                del motivo real de la derivación.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
