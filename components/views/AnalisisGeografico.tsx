"use client";

import {
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
  MapPinned,
  Building2,
  ArrowRight,
  Network,
  Grid3x3,
  Repeat,
  MoveRight,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import PanelInsights from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtEntero,
  PALETA,
  escalaVerde,
  type Resumen,
  type RegionRanking,
  type Conexion,
  type MatrizFlujo,
} from "@/lib/datos";

export default function AnalisisGeografico() {
  const [resumen] = useDatos<Resumen | null>("resumen", null);
  const [regOrigen] = useDatos<RegionRanking[]>("regiones_origen", []);
  const [regDestino] = useDatos<RegionRanking[]>("regiones_destino", []);
  const [conexiones] = useDatos<Conexion[]>("top_conexiones", []);
  const [matriz] = useDatos<MatrizFlujo>("matriz_flujo_regiones", {
    regiones: [],
    celdas: [],
  });

  const regionTop = regOrigen[0]?.region ?? "—";
  const maxFlujo = conexiones[0]?.flujo ?? 1;

  // Índice rápido para la matriz de calor
  const celda = (o: string, d: string) =>
    matriz.celdas.find((c) => c.origen === o && c.destino === d)?.value ?? 0;
  const maxCelda = Math.max(1, ...matriz.celdas.map((c) => c.value));

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Distribución territorial"
        titulo="Análisis"
        resaltado="Geográfico"
        descripcion="Origen y destino de las remisiones por región de Antioquia, matriz de flujo interregional y las conexiones sede a sede más intensas de la red."
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Sedes que remiten"
          value={fmtEntero(resumen?.sedes_origen)}
          subtitle="Prestadores de origen"
          icon={<Building2 size={18} />}
          delay={0}
        />
        <KPICard
          title="Sedes receptoras"
          value={fmtEntero(resumen?.sedes_destino)}
          subtitle="Prestadores de destino"
          icon={<Building2 size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Municipios"
          value={fmtEntero(resumen?.municipios_origen)}
          subtitle="Con actividad de remisión"
          icon={<MapPinned size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={150}
        />
        <KPICard
          title="Región líder"
          value={regionTop}
          subtitle={`${fmtEntero(regOrigen[0]?.remisiones)} remisiones de origen`}
          icon={<MapPinned size={18} />}
          delay={225}
        />
      </section>

      {/* Barras origen / destino */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Remisiones por región de origen"
          subtitulo="Dónde se genera la solicitud"
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regOrigen}
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
                  dataKey="region"
                  width={110}
                  tick={{ fill: "#4a5a52", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,149,76,0.06)" }}
                  content={<ChartTooltip />}
                />
                <Bar isAnimationActive={false} dataKey="remisiones" name="Remisiones" radius={[0, 5, 5, 0]}>
                  {regOrigen.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? PALETA.green : "rgba(0,149,76,0.55)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          titulo="Remisiones por región de destino"
          subtitulo="Dónde se resuelve la atención"
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regDestino}
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
                  dataKey="region"
                  width={110}
                  tick={{ fill: "#4a5a52", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,156,166,0.06)" }}
                  content={<ChartTooltip />}
                />
                <Bar isAnimationActive={false} dataKey="remisiones" name="Remisiones" radius={[0, 5, 5, 0]}>
                  {regDestino.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? PALETA.teal : "rgba(0,156,166,0.55)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* Matriz de flujo interregional */}
      <ChartCard
        titulo="Matriz de flujo interregional"
        subtitulo="Origen (fila) → Destino (columna) · top 10 regiones"
        className="overflow-x-auto"
      >
        {matriz.regiones.length > 0 ? (
          <div className="min-w-[720px]">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-32" />
                  {matriz.regiones.map((r) => (
                    <th
                      key={r}
                      className="text-[10px] font-bold text-brand-muted uppercase tracking-wide pb-2 align-bottom"
                    >
                      <div className="h-20 flex items-end justify-center">
                        <span className="-rotate-45 origin-bottom-left whitespace-nowrap translate-x-3">
                          {r}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriz.regiones.map((o) => (
                  <tr key={o}>
                    <td className="text-[11px] font-bold text-savia-forest pr-3 text-right whitespace-nowrap">
                      {o}
                    </td>
                    {matriz.regiones.map((d) => {
                      const v = celda(o, d);
                      const t = v / maxCelda;
                      return (
                        <td
                          key={d}
                          title={`${o} → ${d}: ${fmtEntero(v)}`}
                          className="h-11 rounded-md text-center text-[11px] font-bold transition-transform hover:scale-105"
                          style={{
                            background: v === 0 ? "#f4f7f5" : escalaVerde(0.15 + t * 0.85),
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
          </div>
        ) : (
          <p className="text-sm text-brand-muted">Sin datos de matriz.</p>
        )}
      </ChartCard>

      {/* Top conexiones sede a sede */}
      <ChartCard
        titulo="Conexiones sede a sede más intensas"
        subtitulo="Top 20 pares prestador de origen → destino (matriz OD)"
        accion={
          <span className="badge-green">
            <Network size={13} /> Red RAS
          </span>
        }
      >
        <div className="space-y-2.5">
          {conexiones.map((c, i) => (
            <div
              key={`${c.origen}-${c.destino}-${i}`}
              className="grid grid-cols-[1fr_auto] items-center gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-savia-forest truncate">
                  <span className="truncate">{c.origen}</span>
                  <ArrowRight
                    size={13}
                    className="text-brand-gray1 shrink-0"
                  />
                  <span className="truncate text-brand-muted">{c.destino}</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-brand-low rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(c.flujo / maxFlujo) * 100}%`,
                      background:
                        c.origen === c.destino ? PALETA.aqua : PALETA.green,
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-black text-savia-forest tabular-nums">
                {fmtEntero(c.flujo)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-brand-gray1">
          Las barras en tono agua corresponden a remisiones internas (misma sede
          de origen y destino).
        </p>
      </ChartCard>

      <PanelInsights
        items={[
          {
            tono: "teal",
            icon: <Grid3x3 size={20} />,
            titulo: "Cómo leer la matriz",
            texto: (
              <>
                Cada celda es el número de remisiones de la subregión de la{" "}
                <b>fila</b> hacia la de la <b>columna</b>. La diagonal (celdas más
                oscuras) es la atención que se resuelve dentro de la misma
                subregión; todo lo de fuera de la diagonal es derivación hacia
                otro territorio, casi siempre el Valle de Aburrá.
              </>
            ),
          },
          {
            tono: "green",
            icon: <MoveRight size={20} />,
            titulo: "Gravedad hacia el Área Metropolitana",
            texto: (
              <>
                {regOrigen[0] && regDestino[0] && (
                  <>
                    <b>{regOrigen[0].region}</b> lidera como origen y{" "}
                    <b>{regDestino[0].region}</b> como destino. Las subregiones
                    periféricas (Urabá, Bajo Cauca, Nordeste) aparecen sobre todo
                    como emisoras: dependen de la capacidad instalada del centro
                    del departamento.
                  </>
                )}
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Repeat size={20} />,
            titulo: "Autobucles en las conexiones",
            texto: (
              <>
                Varias de las conexiones sede→sede más intensas tienen el mismo
                prestador en origen y destino (barras en tono agua): son
                remisiones entre servicios o niveles dentro de la misma
                institución, útiles para dimensionar la gestión interna.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
