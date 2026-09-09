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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Layers,
  Building2,
  Crown,
  Combine,
  Vote,
  HelpCircle,
  Split,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import PanelInsights from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtEntero,
  fmtDecimal,
  fmtNum,
  PALETA,
  type ZaidResumen,
  type ZaidFila,
} from "@/lib/datos";

export default function ZonasZAID() {
  const [resumen] = useDatos<ZaidResumen | null>("zaid_resumen", null);
  const [zaids] = useDatos<ZaidFila[]>("zaid_caracterizacion", []);

  const top = [...zaids]
    .sort((a, b) => b.num_sedes - a.num_sedes)
    .slice(0, 20);
  const maxSedes = Math.max(1, ...top.map((z) => z.num_sedes));

  const scatter = zaids.map((z) => ({
    x: z.cluster_principal,
    y: z.comunidad_principal,
    z: z.num_sedes,
    nombre: z.zaid,
  }));

  const coherencia = resumen?.coherencia ?? {};
  const etiquetasCoh: Record<string, string> = {
    adjusted_rand_index: "Adjusted Rand Index",
    normalized_mutual_info: "NMI",
    coherencia_promedio: "Coherencia promedio",
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Zonas de Atención Integral y Diferencial"
        titulo="Zonas"
        resaltado="ZAID"
        descripcion="Síntesis por consenso (voting) entre la partición de clustering (RAD) y la de comunidades (RAS). Cada ZAID agrupa sedes que coinciden en ambos enfoques, definiendo territorios operativos para la gestión de la red."
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Zonas ZAID"
          value={fmtEntero(resumen?.num_zaid)}
          subtitle="Territorios definidos por consenso"
          icon={<Layers size={18} />}
          delay={0}
        />
        <KPICard
          title="Sedes caracterizadas"
          value={fmtEntero(resumen?.total_sedes)}
          subtitle="Con ZAID asignada"
          icon={<Building2 size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Zona más grande"
          value={fmtEntero(resumen?.sedes_zona_mayor)}
          subtitle={`Promedio: ${fmtDecimal(resumen?.promedio_sedes)} sedes/zona`}
          icon={<Crown size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={150}
        />
        <KPICard
          title="Coherencia RAD·RAS"
          value={fmtNum(coherencia["coherencia_promedio"], 2)}
          subtitle="Acuerdo entre ambas particiones"
          trend="neutral"
          trendLabel="baja"
          icon={<Combine size={18} />}
          delay={225}
        />
      </section>

      <ChartCard
        titulo="Sedes por zona ZAID"
        subtitulo="Top 20 zonas por número de sedes"
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top}
              margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2ece7"
                vertical={false}
              />
              <XAxis
                dataKey="zaid"
                tick={{ fill: "#6b7d74", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fill: "#6b7d74", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,149,76,0.05)" }}
                content={<ChartTooltip />}
              />
              <Bar isAnimationActive={false} dataKey="num_sedes" name="Sedes" radius={[4, 4, 0, 0]}>
                {top.map((z, i) => (
                  <Cell
                    key={i}
                    fill={
                      z.num_sedes === maxSedes
                        ? PALETA.green
                        : "rgba(0,149,76,0.5)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          titulo="Composición RAD × RAS de las ZAID"
          subtitulo="Cluster principal vs comunidad principal · burbuja = nº de sedes"
          className="lg:col-span-2"
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: -6, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece7" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Cluster RAD"
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Cluster principal (RAD) →",
                    position: "insideBottom",
                    offset: -6,
                    fill: "#6b7d74",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Comunidad RAS"
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[60, 620]} name="Sedes" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-brand-gray3 rounded-xl p-3 shadow-card-lg text-xs">
                        <p className="font-bold text-savia-forest mb-1">
                          {payload[0].payload.nombre}
                        </p>
                        <p className="text-brand-muted">
                          Cluster RAD: {payload[0].payload.x}
                        </p>
                        <p className="text-brand-muted">
                          Comunidad RAS: {payload[0].payload.y}
                        </p>
                        <p className="text-brand-muted">
                          Sedes: {payload[0].payload.z}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Scatter isAnimationActive={false} data={scatter} fill={PALETA.teal} fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="card animate-fade-up space-y-4">
          <h4 className="text-lg font-bold text-savia-forest">
            Coherencia entre particiones
          </h4>
          <p className="text-sm text-brand-muted">
            Concordancia entre la agrupación por clustering (RAD) y por
            comunidades de red (RAS).
          </p>
          <div className="space-y-3 pt-2">
            {Object.entries(coherencia).map(([k, v]) => (
              <div key={k} className="bg-brand-low rounded-lg p-4">
                <p className="kicker">{etiquetasCoh[k] ?? k}</p>
                <p className="text-2xl font-black text-savia-forest mt-1">
                  {fmtNum(v, 3)}
                </p>
                <div className="mt-2 h-1.5 w-full bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-savia-teal"
                    style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-brand-gray1 leading-relaxed pt-1">
            Valores bajos indican que la geografía de la remisión (RAS) y el
            perfil de las sedes (RAD) capturan dimensiones distintas: las ZAID
            las integran vía consenso.
          </p>
        </div>
      </section>

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <HelpCircle size={20} />,
            titulo: "¿Qué es una ZAID?",
            texto: (
              <>
                Una <b>Zona de Atención Integral y Diferencial</b> reúne sedes
                que quedan juntas <i>tanto</i> por su perfil operativo (RAD)
                <i> como</i> por su circuito de remisión (RAS). Es la unidad
                territorial sobre la que se planifica capacidad y contratación.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Vote size={20} />,
            titulo: "Consenso por votación",
            texto: (
              <>
                Cada sede «vota» con su cluster RAD y su comunidad RAS; las que
                coinciden con la misma combinación forman una ZAID. De ahí salen{" "}
                <b>{fmtEntero(resumen?.num_zaid)}</b> zonas sobre{" "}
                <b>{fmtEntero(resumen?.total_sedes)}</b> sedes, con un promedio
                de <b>{fmtDecimal(resumen?.promedio_sedes)}</b> sedes por zona.
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Split size={20} />,
            titulo: "Baja coherencia = información complementaria",
            texto: (
              <>
                El acuerdo RAD-RAS es bajo (coherencia ≈{" "}
                <b>{fmtNum(coherencia["coherencia_promedio"], 2)}</b>). No es un
                defecto: significa que «cómo opera una sede» y «hacia dónde
                deriva» son ejes distintos. Cruzarlos produce zonas más finas
                que cualquiera de los dos métodos por separado — de ahí que haya
                tantas ZAID pequeñas.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
