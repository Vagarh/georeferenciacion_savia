"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeftRight,
  Timer,
  CheckCircle2,
  Building2,
  ChevronRight,
  Stethoscope,
  Activity,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import FiltroBar from "@/components/FiltroBar";
import { Leyenda } from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import { useDatos } from "@/lib/useDatos";
import { useFiltros, agregar } from "@/lib/filtros";
import {
  fmtEntero,
  fmtDecimal,
  fmtPct,
  PALETA,
  expandirHechos,
  mapaMunicipioRegion,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type Resumen,
  type Diagnostico,
  type HechosRaw,
} from "@/lib/datos";

export default function ResumenEjecutivo() {
  const [resumen] = useDatos<Resumen | null>("resumen", null);
  const [diagnosticos] = useDatos<Diagnostico[]>("top_diagnosticos", []);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const [rawM] = useDatos<HechosRaw>("hechos_muni", HECHOS_RAW_VACIO);
  const { filtros, activos } = useFiltros();

  // Con municipio(s) seleccionado(s) se usa la tabla por municipio.
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

  const totalRegimen = agg.porRegimen.reduce((a, b) => a + b.value, 0) || 1;
  const maxDiag = diagnosticos[0]?.count ?? 1;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Referencias y contrarreferencias"
        titulo="Resumen"
        resaltado="Ejecutivo"
        descripcion="Panorama consolidado del sistema de referencia y contrarreferencia de Savia Salud EPS: volumen de remisiones, oportunidad de cierre y efectividad de la gestión entre sedes prestadoras de Antioquia."
      />

      {hayHechos && <FiltroBar dims={dims} />}

      {/* Fila de KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Remisiones"
          value={fmtEntero(hayHechos ? agg.total : resumen?.total_remisiones)}
          subtitle={
            activos > 0 ? "Con filtros aplicados" : resumen?.periodo ?? "—"
          }
          icon={<ArrowLeftRight size={18} />}
          delay={0}
        />
        <KPICard
          title="Referencias"
          value={
            usaMuni
              ? "—"
              : fmtPct(
                  hayHechos ? agg.pctReferencias : resumen?.pct_referencias,
                  0
                )
          }
          subtitle={
            usaMuni
              ? "Sin desglose por tipo en modo municipio"
              : `${fmtEntero(
                  hayHechos
                    ? agg.contrarreferencias
                    : resumen?.contrarreferencias
                )} contrarreferencias`
          }
          trend="neutral"
          trendLabel="del total"
          icon={<Activity size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Tiempo Prom. Cierre"
          value={`${fmtDecimal(
            hayHechos ? agg.tiempoPromedio : resumen?.tiempo_promedio_cierre
          )} d`}
          subtitle={`Mediana global: ${fmtDecimal(
            resumen?.tiempo_mediana_cierre
          )} días`}
          trend="down"
          trendLabel="ágil"
          trendPositive={false}
          icon={<Timer size={18} />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          delay={150}
        />
        <KPICard
          title="Tasa Efectividad"
          value={fmtPct(
            hayHechos ? agg.tasaEfectividad : resumen?.tasa_efectividad,
            1
          )}
          subtitle="Eventos en estado Cerrada"
          trend="up"
          trendLabel="cierre"
          trendPositive
          icon={<CheckCircle2 size={18} />}
          delay={225}
        />
      </section>

      {/* Bento: evolución + régimen */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 card animate-fade-up delay-300">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h4 className="text-xl font-bold text-savia-forest">
                Evolución Mensual
              </h4>
              <p className="text-sm text-brand-muted">
                {usaMuni
                  ? "Volumen mensual del municipio"
                  : "Referencias frente a contrarreferencias"}
                {activos > 0 && " · filtrado"}
              </p>
            </div>
            {!usaMuni && (
              <Leyenda
                items={[
                  { color: PALETA.green, label: "Referencias" },
                  { color: PALETA.teal, label: "Contrarreferencias" },
                ]}
              />
            )}
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={agg.porMes}
                margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradRef" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETA.green} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={PALETA.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradContra" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETA.teal} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={PALETA.teal} stopOpacity={0} />
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
                  dataKey={usaMuni ? "remisiones" : "referencias"}
                  name={usaMuni ? "Remisiones" : "Referencias"}
                  stroke={PALETA.green}
                  strokeWidth={3}
                  fill="url(#gradRef)"
                  dot={{ r: 3, fill: PALETA.green, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                {!usaMuni && (
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="contrarreferencias"
                    name="Contrarreferencias"
                    stroke={PALETA.teal}
                    strokeWidth={2.5}
                    fill="url(#gradContra)"
                    dot={{ r: 3, fill: PALETA.teal, strokeWidth: 2, stroke: "#fff" }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tarjeta oscura: régimen */}
        <div className="md:col-span-4 bg-savia-forest text-white p-8 rounded-xl shadow-card-lg space-y-8 relative overflow-hidden animate-fade-up delay-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-savia-green opacity-30 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-1">Régimen de Afiliación</h4>
            <p className="text-xs text-white/60">Distribución de las remisiones</p>
          </div>

          <div className="space-y-6 relative z-10">
            {usaMuni && (
              <p className="text-xs text-white/60 leading-relaxed">
                El desglose por régimen no está disponible al filtrar por
                municipio. Total: <b className="text-white">{fmtEntero(agg.total)}</b>{" "}
                remisiones.
              </p>
            )}
            {agg.porRegimen.map((r, i) => {
              const pct = (r.value / totalRegimen) * 100;
              return (
                <div key={r.name} className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-medium opacity-80">{r.name}</span>
                    <span className="font-bold">
                      {fmtPct(pct, 1)}
                      <span className="ml-1.5 font-medium opacity-60">
                        {fmtEntero(r.value)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          i === 0 ? PALETA.lime : "rgba(255,255,255,0.55)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 pt-2 border-t border-white/15 text-xs text-white/70 leading-relaxed">
            Edad promedio del afiliado remitido:{" "}
            <span className="font-black text-white">
              {fmtDecimal(resumen?.edad_promedio)} años
            </span>
          </div>
        </div>
      </section>

      {/* Tabla: top diagnósticos */}
      <section className="bg-white rounded-xl shadow-card border border-brand-gray3 overflow-hidden animate-fade-up">
        <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h4 className="text-xl font-bold text-savia-forest">
              Principales Diagnósticos de Remisión
            </h4>
            <p className="text-sm text-brand-muted">
              Diagnóstico principal registrado en la solicitud · período completo
            </p>
          </div>
          <span className="badge-green">
            <Stethoscope size={13} /> CIE-10
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-low border-y border-brand-gray3 table-header">
                <th className="px-8 py-4 w-10">#</th>
                <th className="px-8 py-4">Diagnóstico</th>
                <th className="px-8 py-4 text-right">Remisiones</th>
                <th className="px-8 py-4 w-1/3">Peso relativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray3">
              {diagnosticos.map((d, i) => (
                <tr
                  key={d.nombre}
                  className="hover:bg-brand-low/50 transition-colors"
                >
                  <td className="px-8 py-4 text-sm font-mono text-brand-gray1">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-8 py-4 text-sm font-semibold text-savia-forest leading-tight">
                    {d.nombre}
                  </td>
                  <td className="px-8 py-4 text-sm text-right font-bold text-brand-charcoal">
                    {fmtEntero(d.count)}
                  </td>
                  <td className="px-8 py-4">
                    <div className="h-2 w-full bg-brand-low rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(d.count / maxDiag) * 100}%`,
                          background:
                            i === 0 ? PALETA.green : "rgba(0,149,76,0.45)",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Insights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up">
        <div className="card border-l-4 border-l-savia-green bg-savia-ice/40">
          <div className="w-10 h-10 rounded-lg bg-savia-mint flex items-center justify-center text-savia-deep mb-4">
            <Building2 size={20} />
          </div>
          <h5 className="text-sm font-bold text-savia-forest mb-2">
            Cobertura de la red
          </h5>
          <p className="text-xs text-brand-muted leading-relaxed">
            {fmtEntero(resumen?.sedes_origen)} sedes remiten hacia{" "}
            {fmtEntero(resumen?.sedes_destino)} sedes receptoras en{" "}
            {fmtEntero(resumen?.municipios_origen)} municipios de Antioquia.
          </p>
        </div>
        <div className="card border-l-4 border-l-savia-gold bg-amber-50/30">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
            <Timer size={20} />
          </div>
          <h5 className="text-sm font-bold text-savia-forest mb-2">
            Oportunidad de cierre
          </h5>
          <p className="text-xs text-brand-muted leading-relaxed">
            La mitad de las remisiones se cierran en{" "}
            {fmtDecimal(resumen?.tiempo_mediana_cierre)} día(s). La cola de casos
            &gt; 15 días es el foco de mejora del proceso.
          </p>
        </div>
        <div className="card border-l-4 border-l-savia-teal bg-savia-ice/40">
          <div className="w-10 h-10 rounded-lg bg-savia-mint flex items-center justify-center text-savia-teal mb-4">
            <ChevronRight size={20} />
          </div>
          <h5 className="text-sm font-bold text-savia-forest mb-2">
            Predominio de referencia
          </h5>
          <p className="text-xs text-brand-muted leading-relaxed">
            {fmtPct(resumen?.pct_referencias, 0)} del flujo son referencias. Un
            registro más completo de contrarreferencias mejoraría la trazabilidad
            del retorno del paciente.
          </p>
        </div>
      </section>
    </div>
  );
}
