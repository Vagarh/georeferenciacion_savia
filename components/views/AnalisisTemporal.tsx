"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  CalendarClock,
  Timer,
  Gauge,
  TrendingUp,
  Waves,
  Hourglass,
  Filter,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import FiltroBar from "@/components/FiltroBar";
import ChartCard, { Leyenda } from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import PanelInsights from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import { useFiltros, agregar } from "@/lib/filtros";
import {
  fmtEntero,
  fmtDecimal,
  PALETA,
  colorRegion,
  expandirHechos,
  mapaMunicipioRegion,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type TiemposCierre,
  type HechosRaw,
} from "@/lib/datos";

export default function AnalisisTemporal() {
  const [tiempos] = useDatos<TiemposCierre | null>("tiempos_cierre", null);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const [rawM] = useDatos<HechosRaw>("hechos_muni", HECHOS_RAW_VACIO);
  const { filtros, activos } = useFiltros();

  const usaMuni = filtros.municipios.length > 0;
  const dims = rawH.dims ?? DIMS_VACIAS;
  const filas = useMemo(() => {
    const f = expandirHechos(usaMuni ? rawM : rawH);
    if (!usaMuni) return f;
    const m2r = mapaMunicipioRegion(dims);
    return f.map((x) => ({ ...x, region: m2r[x.municipio ?? ""] }));
  }, [rawH, rawM, usaMuni, dims]);
  const agg = useMemo(() => agregar(filas, filtros), [filas, filtros]);
  const hayHechos = (rawH.filas?.length ?? 0) > 0;

  const promedio =
    agg.porMes.length > 0
      ? agg.porMes.reduce((a, b) => a + b.remisiones, 0) / agg.porMes.length
      : 0;
  const serieConProm = agg.porMes.map((p) => ({ ...p, promedio }));
  const mesPico =
    agg.porMes.length > 0
      ? agg.porMes.reduce((a, b) => (b.remisiones > a.remisiones ? b : a))
      : null;

  const hist = tiempos?.histograma ?? [];
  const est = tiempos?.estadisticos;
  const maxHist = Math.max(1, ...hist.map((h) => h.value));
  const maxRegion = agg.porRegion[0]?.value ?? 1;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Serie de tiempo"
        titulo="Evolución"
        resaltado="Temporal"
        descripcion="Comportamiento mensual del volumen de remisiones, distribución territorial y oportunidad de cierre en días. Los dos primeros paneles responden a los filtros."
      />

      {hayHechos && <FiltroBar dims={dims} />}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Promedio mensual"
          value={fmtEntero(promedio)}
          subtitle={`${agg.porMes.length} meses en el rango`}
          icon={<CalendarClock size={18} />}
          delay={0}
        />
        <KPICard
          title="Mes pico"
          value={mesPico ? mesPico.mes_label : "—"}
          subtitle={
            mesPico ? `${fmtEntero(mesPico.remisiones)} remisiones` : "—"
          }
          icon={<TrendingUp size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Cierre P90"
          value={`${fmtDecimal(est?.p90)} d`}
          subtitle={`Máximo observado: ${fmtDecimal(est?.max)} d`}
          trend="down"
          trendLabel="control"
          trendPositive={false}
          icon={<Gauge size={18} />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          delay={150}
        />
        <KPICard
          title="Efectividad filtrada"
          value={`${fmtDecimal(agg.tasaEfectividad)}%`}
          subtitle={`${fmtEntero(agg.cerradas)} eventos cerrados`}
          icon={<Timer size={18} />}
          delay={225}
        />
      </section>

      {/* Serie general con promedio */}
      <ChartCard
        titulo="Remisiones por mes"
        alcance="filtros"
        subtitulo={`Volumen total y promedio del rango${
          activos > 0 ? " · filtrado" : ""
        }`}
        accion={
          <Leyenda
            items={[
              { color: PALETA.green, label: "Remisiones" },
              { color: PALETA.gold, label: "Promedio" },
            ]}
          />
        }
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={serieConProm}
              margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETA.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PALETA.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2ece7"
                vertical={false}
              />
              <XAxis
                dataKey="mes_label"
                tick={{ fill: "#6b7d74", fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fill: "#6b7d74", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="remisiones"
                name="Remisiones"
                stroke={PALETA.green}
                strokeWidth={3}
                fill="url(#gradVol)"
                dot={{ r: 3, fill: PALETA.green, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="promedio"
                name="Promedio"
                stroke={PALETA.gold}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Por región + histograma tiempos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Remisiones por región del prestador"
          alcance="filtros"
          subtitulo={`Distribución territorial${activos > 0 ? " · filtrada" : ""}`}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agg.porRegion}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2ece7"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "#4a5a52", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,149,76,0.06)" }}
                  content={<ChartTooltip />}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Remisiones"
                  radius={[0, 5, 5, 0]}
                >
                  {agg.porRegion.map((r, i) => (
                    <Cell
                      key={i}
                      fill={
                        r.value === maxRegion
                          ? colorRegion(r.name)
                          : `${colorRegion(r.name)}99`
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          titulo="Distribución de la oportunidad de cierre"
          alcance="completo"
          subtitulo="Remisiones por días hasta el cierre · no responde a los filtros"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hist}
                margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2ece7"
                  vertical={false}
                />
                <XAxis
                  dataKey="rango"
                  tick={{ fill: "#6b7d74", fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,149,76,0.05)" }}
                  content={<ChartTooltip />}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Remisiones"
                  radius={[4, 4, 0, 0]}
                >
                  {hist.map((h, i) => (
                    <Cell
                      key={i}
                      fill={
                        h.value === maxHist
                          ? PALETA.green
                          : i >= hist.length - 3
                          ? PALETA.gold
                          : "rgba(0,149,76,0.5)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { l: "P25", v: est?.p25 },
              { l: "Mediana", v: est?.mediana },
              { l: "P75", v: est?.p75 },
            ].map((s) => (
              <div key={s.l} className="bg-brand-low rounded-lg py-3">
                <p className="kicker">{s.l}</p>
                <p className="text-lg font-black text-savia-forest">
                  {fmtDecimal(s.v)} d
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <Waves size={20} />,
            titulo: "Demanda estable, sin estacionalidad marcada",
            texto: (
              <>
                El volumen mensual se mueve en una banda estrecha alrededor de{" "}
                <b>{fmtEntero(promedio)}</b> remisiones; el pico ({" "}
                {mesPico?.mes_label}) apenas se despega del promedio. La
                planificación de capacidad puede asumir una carga prácticamente
                constante mes a mes.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Hourglass size={20} />,
            titulo: "Cierres rápidos con cola larga",
            texto: (
              <>
                La mediana de cierre es de{" "}
                <b>{fmtDecimal(est?.mediana)} día(s)</b> y el P75 de{" "}
                <b>{fmtDecimal(est?.p75)}</b>, pero el P90 sube a{" "}
                <b>{fmtDecimal(est?.p90)}</b> y hay casos de hasta{" "}
                <b>{fmtDecimal(est?.max)}</b> días. El foco de mejora es esa cola
                del 10 % de remisiones que se demoran.
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Filter size={20} />,
            titulo: "Usa los filtros para segmentar",
            texto: (
              <>
                Los dos primeros paneles y los KPIs se recalculan al vuelo. Por
                ejemplo, filtra por <i>Contrarreferencia</i> para ver su serie
                aislada, o por una subregión y municipio concretos para revisar
                su comportamiento temporal frente al total.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
