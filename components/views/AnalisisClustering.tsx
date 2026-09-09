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
  Boxes,
  Award,
  Target,
  Sparkles,
  GitCommitVertical,
  HelpCircle,
  Ruler,
  Layers3,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  CheckCircle2,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import Dendrograma from "@/components/Dendrograma";
import PanelInsights, { ComoLeer } from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtNum,
  fmtEntero,
  fmtDecimal,
  fmtPct,
  PALETA,
  SERIE_CATEGORICA,
  type ClusterMetodo,
  type ClusteringPerfil,
  type Dendrograma as TDendro,
} from "@/lib/datos";

const NOMBRE_METODO: Record<string, string> = {
  kmeans: "K-Means",
  kmeans_reduced: "K-Means + PCA",
  kmedians: "K-Medians",
  kmedians_reduced: "K-Medians + PCA",
  hierarchical: "Jerárquico",
  hierarchical_reduced: "Jerárquico + PCA",
};

export default function AnalisisClustering() {
  const [metodos] = useDatos<ClusterMetodo[]>("clustering_comparacion", []);
  const [perfil] = useDatos<ClusteringPerfil | null>("clustering_perfil", null);
  const [dendro] = useDatos<TDendro | null>("dendrograma", null);

  const ordenados = [...metodos].sort((a, b) => b.silhouette - a.silhouette);
  const mejor = ordenados[0];
  const maxSil = Math.max(0.01, ...metodos.map((m) => m.silhouette));

  const datosSil = ordenados.map((m) => ({
    metodo: NOMBRE_METODO[m.metodo] ?? m.metodo,
    silhouette: m.silhouette,
  }));

  const datosScatter = metodos.map((m) => ({
    x: m.calinski_harabasz,
    y: m.davies_bouldin,
    z: m.silhouette * 1000,
    nombre: NOMBRE_METODO[m.metodo] ?? m.metodo,
  }));

  const clusters = perfil?.clusters ?? [];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Regiones de Acción Diferencial"
        titulo="Clustering"
        resaltado="RAD"
        descripcion="Agrupamiento de las sedes de la red según cómo se comportan en la referencia y contrarreferencia. El objetivo es pasar de gestionar sede por sede a gestionar por arquetipo de sede."
      />

      {/* Explicación: qué es y para qué sirve */}
      <div className="card border-l-4 border-l-savia-green bg-savia-ice/40 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={18} className="text-savia-deep" />
          <h4 className="text-base font-bold text-savia-forest">
            ¿Qué es este análisis y para qué sirve?
          </h4>
        </div>
        <div className="text-sm text-brand-muted leading-relaxed space-y-2">
          <p>
            Cada una de las{" "}
            <b>{fmtEntero(perfil?.num_sedes)} sedes</b> se describe con ~20
            variables de su operación en la red: cuántas remisiones emite y
            recibe, su nivel de complejidad, cuántos municipios cubre, su
            oportunidad de cierre, su centralidad en el grafo, la mezcla de
            servicios y diagnósticos, etc. Un algoritmo de <i>clustering</i> las
            reparte en <b>{fmtEntero(perfil?.num_clusters)} grupos</b> de sedes
            que se parecen entre sí — las <b>RAD</b> (Regiones de Acción
            Diferencial).
          </p>
          <p>
            <b>Para qué sirve:</b> permite diseñar intervenciones por grupo
            (capacidad instalada, contratación, metas de oportunidad, auditoría
            de pertinencia) en lugar de una por una. Abajo, primero se elige el
            método de agrupamiento más sólido y luego se describe qué representa
            cada grupo.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Sedes agrupadas"
          value={fmtEntero(perfil?.num_sedes)}
          subtitle={`En ${fmtEntero(perfil?.num_clusters)} arquetipos (RAD)`}
          icon={<Boxes size={18} />}
          delay={0}
        />
        <KPICard
          title="Método recomendado"
          value={mejor ? NOMBRE_METODO[mejor.metodo] ?? mejor.metodo : "—"}
          subtitle="Mejor Silhouette global"
          icon={<Award size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={75}
        />
        <KPICard
          title="Silhouette máx."
          value={fmtNum(mejor?.silhouette, 3)}
          subtitle="Rango −1 a 1 · señal moderada"
          trend="up"
          trendLabel="separación"
          icon={<Sparkles size={18} />}
          delay={150}
        />
        <KPICard
          title="Davies-Bouldin"
          value={fmtNum(mejor?.davies_bouldin, 3)}
          subtitle="Menor es mejor"
          trend="down"
          trendLabel="compacto"
          trendPositive={false}
          icon={<Target size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={225}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Silhouette Score por método"
          subtitulo="Cohesión y separación de los grupos"
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datosSil}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2ece7"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, Math.ceil(maxSil * 20) / 20]}
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="metodo"
                  width={120}
                  tick={{ fill: "#4a5a52", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,149,76,0.06)" }}
                  content={<ChartTooltip formato={(n) => n.toFixed(3)} />}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="silhouette"
                  name="Silhouette"
                  radius={[0, 5, 5, 0]}
                >
                  {datosSil.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? PALETA.green : "rgba(0,149,76,0.5)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ComoLeer>
            El <b>Silhouette</b> va de −1 a 1: cerca de 1, cada sede se parece
            mucho a su grupo y poco a los demás; cerca de 0, los grupos se
            solapan. Aquí el máximo ronda <b>{fmtNum(mejor?.silhouette, 2)}</b>:
            hay estructura real, pero con sedes «puente» entre grupos.
          </ComoLeer>
        </ChartCard>

        <ChartCard
          titulo="Calinski-Harabasz vs Davies-Bouldin"
          subtitulo="Tamaño de burbuja = Silhouette · ideal: abajo a la derecha"
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: -6, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece7" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Calinski-Harabasz"
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Calinski-Harabasz →",
                    position: "insideBottom",
                    offset: -6,
                    fill: "#6b7d74",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Davies-Bouldin"
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[80, 520]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-brand-gray3 rounded-xl p-3 shadow-card-lg text-xs">
                        <p className="font-bold text-savia-forest mb-1">
                          {payload[0].payload.nombre}
                        </p>
                        <p className="text-brand-muted">
                          CH: {payload[0].payload.x.toFixed(1)}
                        </p>
                        <p className="text-brand-muted">
                          DB: {payload[0].payload.y.toFixed(3)}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Scatter
                  isAnimationActive={false}
                  data={datosScatter}
                  fill={PALETA.teal}
                >
                  {datosScatter.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.nombre === (NOMBRE_METODO[mejor?.metodo] ?? "")
                          ? PALETA.green
                          : PALETA.aqua
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* Tabla comparativa */}
      <ChartCard
        titulo="Tabla comparativa de métricas"
        subtitulo="Fila resaltada = método recomendado"
        className="overflow-x-auto"
      >
        <table className="w-full text-left min-w-[560px]">
          <thead>
            <tr className="bg-brand-low border-y border-brand-gray3 table-header">
              <th className="px-6 py-3">Método</th>
              <th className="px-6 py-3 text-right">Silhouette ↑</th>
              <th className="px-6 py-3 text-right">Calinski-Harabasz ↑</th>
              <th className="px-6 py-3 text-right">Davies-Bouldin ↓</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gray3">
            {ordenados.map((m, i) => (
              <tr
                key={m.metodo}
                className={
                  i === 0
                    ? "bg-savia-ice/60 font-semibold"
                    : "hover:bg-brand-low/40 transition-colors"
                }
              >
                <td className="px-6 py-3 text-sm text-savia-forest">
                  {NOMBRE_METODO[m.metodo] ?? m.metodo}
                  {i === 0 && (
                    <span className="ml-2 badge-green">recomendado</span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">
                  {m.silhouette.toFixed(4)}
                </td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">
                  {m.calinski_harabasz.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">
                  {m.davies_bouldin.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      {/* Arquetipos de sede */}
      {clusters.length > 0 && (
        <section className="space-y-4 animate-fade-up">
          <div>
            <h4 className="text-xl font-bold text-savia-forest">
              Los {clusters.length} arquetipos de sede
            </h4>
            <p className="text-sm text-brand-muted">
              Perfil promedio de cada grupo con el método recomendado (
              {perfil?.metodo}). Ordenados por número de sedes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clusters.map((c, i) => {
              const color =
                SERIE_CATEGORICA[c.cluster % SERIE_CATEGORICA.length];
              return (
                <div key={c.cluster} className="card space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0"
                        style={{ background: color }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-savia-forest leading-tight">
                          {c.etiqueta}
                        </p>
                        <p className="text-[11px] text-brand-gray1">
                          {fmtEntero(c.sedes)} sedes ·{" "}
                          {fmtPct(c.pct_sedes, 0)} de la red
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-brand-muted leading-relaxed">
                    {c.rasgo}
                  </p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1 border-t border-brand-gray3">
                    <Metrica
                      icon={<ArrowUpRight size={13} />}
                      label="Emite (prom.)"
                      value={fmtDecimal(c.remisiones_origen_prom)}
                    />
                    <Metrica
                      icon={<ArrowDownRight size={13} />}
                      label="Recibe (prom.)"
                      value={fmtDecimal(c.remisiones_destino_prom)}
                    />
                    <Metrica
                      icon={<Building2 size={13} />}
                      label="Nivel complej."
                      value={fmtNum(c.nivel_complejidad_prom, 2)}
                    />
                    <Metrica
                      icon={<Timer size={13} />}
                      label="Cierre (días)"
                      value={fmtDecimal(c.dias_cierre_prom)}
                    />
                    <Metrica
                      icon={<CheckCircle2 size={13} />}
                      label="Efectivas"
                      value={fmtPct(c.tasa_efectivas_prom, 0)}
                    />
                    <Metrica
                      icon={<Sparkles size={13} />}
                      label="Cobertura mun."
                      value={fmtDecimal(c.cobertura_municipal_prom)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dendrograma jerárquico */}
      {dendro && (
        <ChartCard
          titulo="Dendrograma: qué sedes se parecen más entre sí"
          subtitulo={`${dendro.num_hojas} sedes con más flujo, agrupadas por su perfil de remisión · lectura de derecha a izquierda`}
          accion={
            <span className="badge-green">
              <GitCommitVertical size={13} /> Ward
            </span>
          }
        >
          <Dendrograma data={dendro} />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {Array.from({ length: dendro.k }, (_, i) => i + 1).map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background:
                      SERIE_CATEGORICA[(c - 1) % SERIE_CATEGORICA.length],
                  }}
                />
                Grupo {c}
              </span>
            ))}
          </div>
          <ComoLeer>
            Cada sede es una hoja a la <b>derecha</b>. Al recorrer hacia la{" "}
            <b>izquierda</b>, las sedes se van uniendo con la que más se les
            parece; cuanto más a la izquierda ocurre la unión, más <i>distintas</i>{" "}
            eran las ramas al fusionarse. La línea punteada marca el{" "}
            <b>corte en {dendro.k} grupos</b>: todo lo que queda a su derecha
            dentro de la misma rama pertenece al mismo grupo. Es una vista
            complementaria al clustering de arriba (usa solo las sedes de mayor
            tráfico y otro algoritmo), no la misma partición.
          </ComoLeer>
        </ChartCard>
      )}

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <HelpCircle size={20} />,
            titulo: "De sede a arquetipo",
            texto: (
              <>
                Los <b>{fmtEntero(perfil?.num_clusters)} grupos RAD</b> resumen{" "}
                {fmtEntero(perfil?.num_sedes)} sedes en unos pocos perfiles
                accionables: hubs receptores, emisores de baja complejidad,
                nodos de alto tráfico, sedes periféricas… Cada uno pide una
                estrategia distinta de capacidad y contratación.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Ruler size={20} />,
            titulo: "Cómo se eligió el método",
            texto: (
              <>
                <b>Silhouette</b> (↑) mide si cada sede encaja en su grupo;{" "}
                <b>Calinski-Harabasz</b> (↑) premia grupos densos y separados;{" "}
                <b>Davies-Bouldin</b> (↓) penaliza el solape. Los tres coinciden
                en{" "}
                <b>
                  {mejor ? NOMBRE_METODO[mejor.metodo] ?? mejor.metodo : "—"}
                </b>
                : la partición más limpia de las seis probadas.
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Layers3 size={20} />,
            titulo: "Señal moderada, no tajante",
            texto: (
              <>
                Un Silhouette de <b>{fmtNum(mejor?.silhouette, 2)}</b> dice que
                los arquetipos son reales pero con fronteras difusas: hay sedes
                que podrían caer en dos grupos. Úsalos como guía de gestión, no
                como una etiqueta rígida por sede.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function Metrica({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-brand-gray1 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-brand-gray1 leading-none">
          {label}
        </p>
        <p className="text-sm font-bold text-savia-forest tabular-nums leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
