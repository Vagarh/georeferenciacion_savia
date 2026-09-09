"use client";

import {
  MapPinned,
  ArrowRight,
  Route,
  Share2,
  Network,
  Crosshair,
  Waypoints,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import FiltroBar from "@/components/FiltroBar";
import MapaRed from "@/components/MapaRed";
import PanelInsights from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtEntero,
  fmtPct,
  colorRegion,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type HechosRaw,
  type MapaRed as TMapaRed,
} from "@/lib/datos";

const VACIO: TMapaRed = {
  meses: [],
  nodos: [],
  flujos: [],
  comunidades: [],
  bbox: { minLon: -77, maxLon: -74, minLat: 5.5, maxLat: 8.9 },
  resumen: {
    municipios: 0,
    flujos_intermunicipales: 0,
    remisiones_mismo_municipio: 0,
    pct_intermunicipal: 0,
    num_comunidades: 0,
  },
};

export default function MapaDeRed() {
  const [data, cargando] = useDatos<TMapaRed>("mapa_red", VACIO);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const dims = rawH.dims ?? DIMS_VACIAS;
  const hayHechos = (rawH.filas?.length ?? 0) > 0;

  const topFlujos = [...data.flujos]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 12);
  const maxFlujo = topFlujos[0]?.valor ?? 1;

  const topEmisores = [...data.nodos]
    .sort((a, b) => b.origen - a.origen)
    .slice(0, 6);

  // Métricas para los insights
  const totalOrigen = data.nodos.reduce((s, n) => s + n.origen, 0) || 1;
  const medellin = data.nodos.find((n) => n.nombre.startsWith("Medell"));
  const pctMedellin = medellin
    ? ((medellin.origen + medellin.destino) /
        data.nodos.reduce((s, n) => s + n.origen + n.destino, 0)) *
      100
    : 0;
  const top5Emisores = [...data.nodos]
    .sort((a, b) => b.origen - a.origen)
    .slice(0, 5)
    .reduce((s, n) => s + n.origen, 0);
  const pctTop5 = (top5Emisores / totalOrigen) * 100;
  const numComunidades =
    data.resumen.num_comunidades ?? data.comunidades?.length ?? 0;
  const comunidadMayor = [...(data.comunidades ?? [])].sort(
    (a, b) => b.municipios - a.municipios
  )[0];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Georreferenciación"
        titulo="Mapa de"
        resaltado="Red"
        descripcion="Los municipios de Antioquia como nodos de la red de referencia y las remisiones entre ellos como arcos. El tamaño refleja el volumen; el grosor del arco, la intensidad del flujo. Usa los filtros para aislar una subregión o municipio y su vecindario, o colorea por comunidad de remisión."
      />

      {hayHechos && <FiltroBar dims={dims} soloGeo />}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Municipios en la red"
          value={fmtEntero(data.resumen.municipios)}
          subtitle="Con remisiones emitidas o recibidas"
          icon={<MapPinned size={18} />}
          delay={0}
        />
        <KPICard
          title="Flujo intermunicipal"
          value={fmtPct(data.resumen.pct_intermunicipal, 0)}
          subtitle={`${fmtEntero(
            data.resumen.flujos_intermunicipales
          )} remisiones cruzan de municipio`}
          trend="neutral"
          trendLabel="del total"
          icon={<Route size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Comunidades RAS"
          value={fmtEntero(numComunidades)}
          subtitle="Circuitos de remisión detectados (Louvain)"
          icon={<Waypoints size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={150}
        />
        <KPICard
          title="Corredor principal"
          value={topFlujos[0] ? `${topFlujos[0].o} → ${topFlujos[0].d}` : "—"}
          subtitle={`${fmtEntero(topFlujos[0]?.valor)} remisiones`}
          icon={<Share2 size={18} />}
          delay={225}
        />
      </section>

      <ChartCard
        titulo="Red de remisiones de Antioquia"
        subtitulo="Pasa el cursor sobre un municipio para aislar sus conexiones · usa los filtros de arriba para fijar una subregión o municipio"
      >
        {cargando ? (
          <div className="h-[420px] grid place-items-center text-sm text-brand-gray1">
            Cargando mapa…
          </div>
        ) : (
          <MapaRed data={data} />
        )}
      </ChartCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Corredores de remisión más intensos"
          subtitulo="Top 12 flujos entre municipios distintos"
        >
          <div className="space-y-2.5">
            {topFlujos.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] items-center gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-savia-forest truncate">
                    <span className="truncate">{f.o}</span>
                    <ArrowRight size={13} className="text-brand-gray1 shrink-0" />
                    <span className="truncate text-brand-muted">{f.d}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-brand-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(f.valor / maxFlujo) * 100}%`,
                        background: colorRegion(f.region_o),
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-black text-savia-forest tabular-nums">
                  {fmtEntero(f.valor)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          titulo="Municipios que más remiten"
          subtitulo="Volumen de remisiones emitidas"
        >
          <div className="space-y-3">
            {topEmisores.map((n) => {
              const max = topEmisores[0].origen || 1;
              return (
                <div key={n.nombre} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-savia-forest">
                      {n.nombre}
                      <span className="ml-2 text-brand-gray1 font-medium">
                        {n.region}
                      </span>
                    </span>
                    <span className="font-bold text-brand-charcoal tabular-nums">
                      {fmtEntero(n.origen)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-brand-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(n.origen / max) * 100}%`,
                        background: colorRegion(n.region),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-brand-gray1">
            El punto de coordenadas de cada municipio es el centroide de las
            direcciones geolocalizadas de los afiliados; no representa ninguna
            ubicación individual.
          </p>
        </ChartCard>
      </section>

      <PanelInsights
        items={[
          {
            tono: "gold",
            icon: <Crosshair size={20} />,
            titulo: "Red muy centralizada",
            texto: (
              <>
                Medellín concentra cerca del{" "}
                <b>{fmtPct(pctMedellin, 0)}</b> de toda la actividad de la red
                (emisión + recepción) y los cinco municipios que más remiten
                suman <b>{fmtPct(pctTop5, 0)}</b> de las remisiones emitidas. La
                red es de tipo <i>hub-and-spoke</i>: un centro dominante y muchos
                nodos periféricos.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Route size={20} />,
            titulo: "La mitad se resuelve fuera del municipio",
            texto: (
              <>
                <b>{fmtPct(data.resumen.pct_intermunicipal, 0)}</b> de las
                remisiones cruzan de municipio (
                {fmtEntero(data.resumen.flujos_intermunicipales)} casos). El
                corredor más cargado es{" "}
                <b>
                  {topFlujos[0]?.o} → {topFlujos[0]?.d}
                </b>
                . Reforzar la capacidad resolutiva local en esos corredores
                aliviaría la presión sobre el Valle de Aburrá.
              </>
            ),
          },
          {
            tono: "green",
            icon: <Network size={20} />,
            titulo: "Comunidades de remisión sobre el mapa",
            texto: (
              <>
                Cambia el color a <i>Por comunidad RAS</i>: los municipios se
                agrupan en <b>{fmtEntero(numComunidades)}</b> circuitos que se
                remiten sobre todo entre sí.
                {comunidadMayor && (
                  <>
                    {" "}
                    El mayor abarca <b>{comunidadMayor.municipios}</b> municipios
                    ({comunidadMayor.sedes} sedes).
                  </>
                )}{" "}
                Son la unidad natural para organizar rutas y contratación.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
