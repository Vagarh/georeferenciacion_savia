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
import { useState } from "react";
import {
  Layers,
  Building2,
  Crown,
  Combine,
  Vote,
  HelpCircle,
  Split,
  MapPin,
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

function MetricaZ({
  label,
  valor,
  sufijo = "",
}: {
  label: string;
  valor: number | null | undefined;
  sufijo?: string;
}) {
  return (
    <div className="bg-brand-low rounded-lg px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-gray1">
        {label}
      </p>
      <p className="text-lg font-black text-savia-forest leading-tight">
        {valor == null
          ? "—"
          : Math.abs(valor) >= 100
          ? fmtEntero(valor)
          : fmtDecimal(valor)}
        {valor == null ? "" : sufijo}
      </p>
    </div>
  );
}

function ZonaDetalle({ z }: { z: ZaidFila | null }) {
  if (!z) {
    return (
      <div className="rounded-xl border border-brand-gray3 bg-white p-6 text-sm text-brand-gray1">
        Selecciona una zona de la lista.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-brand-gray3 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-bold text-savia-forest">{z.zaid}</h4>
        <span className="text-xs font-bold text-brand-gray1">
          {fmtEntero(z.num_sedes)} sedes · {fmtEntero(z.num_municipios)} municipio(s)
          {" · "}Cluster RAD {z.cluster_principal} · Comunidad RAS{" "}
          {z.comunidad_principal}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricaZ label="Emite (prom/sede)" valor={z.origen_prom} />
        <MetricaZ label="Recibe (prom/sede)" valor={z.destino_prom} />
        <MetricaZ label="Nivel complej." valor={z.nivel_prom} />
        <MetricaZ label="Días de cierre" valor={z.dias_prom} />
        <MetricaZ label="Tasa efectivas" valor={z.efect_prom} sufijo="%" />
        <MetricaZ label="Subsidiado" valor={z.pct_subsidiado} sufijo="%" />
      </div>

      {z.regiones?.length > 0 || z.municipios?.length > 0 ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand-gray1">
            <MapPin size={13} /> Ubicación
            {z.sedes_ubicadas < z.num_sedes && (
              <span className="font-medium text-brand-gray1">
                (de {fmtEntero(z.sedes_ubicadas)} de {fmtEntero(z.num_sedes)} sedes)
              </span>
            )}
          </p>
          {z.regiones?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {z.regiones.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-savia-ice text-savia-deep text-[11px] font-semibold px-2 py-0.5 border border-savia-mint"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {z.municipios?.length > 0 && (
            <p className="text-xs text-brand-muted">
              <span className="font-bold text-brand-gray1">
                Municipios principales:
              </span>{" "}
              {z.municipios.join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-brand-gray1">
          Sin ubicación geográfica: sus sedes son prestadores fuera de Antioquia
          o con nombre no cruzable con el maestro de municipios.
        </p>
      )}

      {z.sedes_lista?.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand-gray1 mb-1.5">
            <Building2 size={13} /> Sedes (por volumen emitido)
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-brand-muted">
            {z.sedes_lista.map((s, i) => (
              <li key={i} className="truncate">
                • {s}
              </li>
            ))}
          </ul>
          {z.sedes_restantes > 0 && (
            <p className="text-[11px] text-brand-gray1 mt-1">
              + {fmtEntero(z.sedes_restantes)} sedes más
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ZonasZAID() {
  const [resumen] = useDatos<ZaidResumen | null>("zaid_resumen", null);
  const [zaids] = useDatos<ZaidFila[]>("zaid_caracterizacion", []);
  const [zaidSel, setZaidSel] = useState<string | null>(null);
  const zaidsOrden = [...zaids].sort((a, b) => b.num_sedes - a.num_sedes);
  const zonaActiva =
    zaidsOrden.find((z) => z.zaid === zaidSel) ?? zaidsOrden[0] ?? null;

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

      {/* Detalle: sedes y características de cada ZAID */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-savia-forest">
            Detalle por zona
          </h3>
          <p className="text-sm text-brand-muted">
            Qué sedes componen cada ZAID, en qué subregiones están y cuál es su
            perfil operativo promedio (volumen, complejidad, oportunidad).
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,15rem)_1fr] gap-4">
          <div className="rounded-xl border border-brand-gray3 bg-white overflow-hidden max-h-[520px] overflow-y-auto">
            {zaidsOrden.map((z) => (
              <button
                key={z.zaid}
                onClick={() =>
                  setZaidSel(zaidSel === z.zaid ? null : z.zaid)
                }
                className={
                  "w-full text-left px-4 py-2.5 border-b border-brand-gray3 last:border-0 transition-colors " +
                  (zonaActiva?.zaid === z.zaid
                    ? "bg-savia-ice"
                    : "hover:bg-brand-low")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-savia-forest">
                    {z.zaid}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-brand-charcoal">
                    {fmtEntero(z.num_sedes)} sedes
                  </span>
                </div>
                <p className="text-[11px] text-brand-gray1 truncate">
                  {z.region_dominante && z.region_dominante !== "—"
                    ? z.region_dominante
                    : "Ubicación mixta"}{" "}
                  · {fmtEntero(z.num_municipios)} municipio(s)
                </p>
              </button>
            ))}
          </div>

          <ZonaDetalle z={zonaActiva} />
        </div>
      </section>

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
