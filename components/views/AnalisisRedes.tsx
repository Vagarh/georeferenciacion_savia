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
  ComposedChart,
  Line,
} from "recharts";
import {
  Share2,
  Award,
  Users,
  GitBranch,
  HelpCircle,
  Scale,
  Waypoints,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import ChartTooltip from "@/components/ChartTooltip";
import FiltroBar from "@/components/FiltroBar";
import MapaRed from "@/components/MapaRed";
import PanelInsights, { ComoLeer } from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtDecimal,
  fmtNum,
  fmtEntero,
  PALETA,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type HechosRaw,
  type MapaRed as TMapaRed,
  type RasAlgoritmo,
  type ComunidadTam,
} from "@/lib/datos";

const MAPA_VACIO: TMapaRed = {
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

const NOMBRE_ALGO: Record<string, string> = {
  louvain: "Louvain",
  greedy_modularity: "Greedy Modularity",
  label_propagation: "Label Propagation",
  girvan_newman: "Girvan-Newman",
};

export default function AnalisisRedes() {
  const [algos] = useDatos<RasAlgoritmo[]>("ras_comparacion", []);
  const [comunidades] = useDatos<ComunidadTam[]>("comunidades_louvain", []);
  const [mapa, cargandoMapa] = useDatos<TMapaRed>("mapa_red", MAPA_VACIO);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const dims = rawH.dims ?? DIMS_VACIAS;
  const hayHechos = (rawH.filas?.length ?? 0) > 0;

  // Recomendado: entre los algoritmos con nº de comunidades manejable (2..40),
  // el de mayor modularidad. Cuando Louvain queda a menos de 3 % del máximo se
  // prefiere Louvain: es la partición que se caracteriza aguas abajo (ZAID) y
  // produce menos comunidades unitarias.
  const candidatos = algos.filter(
    (a) => a.num_comunidades >= 2 && a.num_comunidades <= 40
  );
  const pool = candidatos.length ? candidatos : algos;
  const maxMod = Math.max(...pool.map((a) => a.modularidad), 0);
  const louvain = pool.find((a) => a.algoritmo === "louvain");
  const mejor =
    louvain && louvain.modularidad >= maxMod * 0.97
      ? louvain
      : [...pool].sort((a, b) => b.modularidad - a.modularidad)[0] ?? null;

  const nombreMejor = mejor ? NOMBRE_ALGO[mejor.algoritmo] ?? mejor.algoritmo : "";
  const datosMod = [...algos]
    .sort((a, b) => b.modularidad - a.modularidad)
    .map((a) => ({
      algoritmo: NOMBRE_ALGO[a.algoritmo] ?? a.algoritmo,
      modularidad: a.modularidad,
    }));

  const datosComp = algos.map((a) => ({
    algoritmo: NOMBRE_ALGO[a.algoritmo] ?? a.algoritmo,
    comunidades: a.num_comunidades,
    tam_promedio: a.tam_promedio,
    tam_max: a.tam_max,
  }));

  const maxCom = Math.max(1, ...comunidades.map((c) => c.sedes));

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Redes de Atención Sanitaria"
        titulo="Redes"
        resaltado="RAS"
        descripcion="Detección de comunidades sobre el grafo de remisiones entre sedes: grupos de prestadores que se derivan pacientes sobre todo entre sí. Sirven para identificar los circuitos naturales de derivación del territorio y planificar rutas, capacidad y contratación por circuito. Se comparan cuatro algoritmos por modularidad y por el tamaño de las comunidades."
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Algoritmos"
          value={String(algos.length)}
          subtitle="Comparados sobre el mismo grafo"
          icon={<Share2 size={18} />}
          delay={0}
        />
        <KPICard
          title="Algoritmo recomendado"
          value={mejor ? NOMBRE_ALGO[mejor.algoritmo] ?? mejor.algoritmo : "—"}
          subtitle="Mejor modularidad estable"
          icon={<Award size={18} />}
          iconBg="#eaf2df"
          iconColor="#5c8a1f"
          delay={75}
        />
        <KPICard
          title="Modularidad"
          value={fmtNum(mejor?.modularidad, 3)}
          subtitle="Rango 0 a 1 · ↑ mejor"
          trend="up"
          trendLabel="cohesión"
          icon={<GitBranch size={18} />}
          delay={150}
        />
        <KPICard
          title="Comunidades"
          value={fmtEntero(mejor?.num_comunidades)}
          subtitle={`Tamaño promedio: ${fmtDecimal(mejor?.tam_promedio)} sedes`}
          icon={<Users size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={225}
        />
      </section>

      {/* Comunidades sobre el mapa de Antioquia */}
      {hayHechos && <FiltroBar dims={dims} soloGeo />}
      <ChartCard
        titulo="Comunidades de remisión sobre el mapa"
        subtitulo="Cada color agrupa los municipios cuyas sedes se remiten sobre todo entre sí · filtra una subregión o municipio para aislar su circuito"
      >
        {cargandoMapa ? (
          <div className="h-[420px] grid place-items-center text-sm text-brand-gray1">
            Cargando mapa…
          </div>
        ) : (
          <MapaRed data={mapa} modoColorInicial="comunidad" />
        )}
        <ComoLeer>
          Es la misma detección de comunidades (Louvain) que compara la tabla de
          abajo, proyectada sobre la geografía. Sirve para ver si los circuitos
          de remisión coinciden con las subregiones administrativas o las cruzan
          — normalmente las cruzan, porque todo gravita hacia el Valle de Aburrá.
        </ComoLeer>
      </ChartCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Modularidad por algoritmo"
          subtitulo="Qué tan bien separada queda la red"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datosMod}
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
                  domain={[0, 0.7]}
                  tick={{ fill: "#6b7d74", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="algoritmo"
                  width={130}
                  tick={{ fill: "#4a5a52", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,149,76,0.06)" }}
                  content={<ChartTooltip formato={(n) => n.toFixed(3)} />}
                />
                <Bar isAnimationActive={false}
                  dataKey="modularidad"
                  name="Modularidad"
                  radius={[0, 5, 5, 0]}
                >
                  {datosMod.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.algoritmo === nombreMejor
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

        <ChartCard
          titulo="Número y tamaño de comunidades"
          subtitulo="Barras: nº de comunidades · línea: tamaño máximo"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={datosComp}
                margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2ece7"
                  vertical={false}
                />
                <XAxis
                  dataKey="algoritmo"
                  tick={{ fill: "#6b7d74", fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
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
                <Bar isAnimationActive={false}
                  dataKey="comunidades"
                  name="N.º comunidades"
                  fill={PALETA.teal}
                  radius={[4, 4, 0, 0]}
                  barSize={34}
                />
                <Line isAnimationActive={false}
                  type="monotone"
                  dataKey="tam_max"
                  name="Tamaño máx."
                  stroke={PALETA.gold}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: PALETA.gold, strokeWidth: 2, stroke: "#fff" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <ChartCard
        titulo="Distribución de comunidades — Louvain"
        subtitulo="Número de sedes por comunidad detectada"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comunidades}
              margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2ece7"
                vertical={false}
              />
              <XAxis
                dataKey="comunidad"
                tick={{ fill: "#6b7d74", fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={6}
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
              <Bar isAnimationActive={false} dataKey="sedes" name="Sedes" radius={[4, 4, 0, 0]}>
                {comunidades.map((c, i) => (
                  <Cell
                    key={i}
                    fill={
                      c.sedes === maxCom ? PALETA.green : "rgba(0,149,76,0.5)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[11px] text-brand-gray1">
          Louvain produce {comunidades.length} comunidades; las de una sola sede
          corresponden a prestadores con vínculos débiles con el resto de la red.
        </p>
      </ChartCard>

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <HelpCircle size={20} />,
            titulo: "¿Qué son las RAS?",
            texto: (
              <>
                Las <b>Redes de Atención Sanitaria</b> se detectan sobre el grafo
                de remisiones: una <i>comunidad</i> es un conjunto de sedes que
                se remiten mucho entre sí y poco hacia afuera. Marcan los
                circuitos naturales de derivación del territorio.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Scale size={20} />,
            titulo: "Qué mide la modularidad",
            texto: (
              <>
                Va de 0 a 1: cuánto mejor conectada está la red <i>dentro</i> de
                las comunidades frente a lo esperable al azar. Valores{" "}
                <b>&gt; 0,3</b> indican estructura clara.{" "}
                <b>{mejor ? NOMBRE_ALGO[mejor.algoritmo] ?? mejor.algoritmo : "—"}</b>{" "}
                alcanza <b>{fmtDecimal(mejor?.modularidad)}</b>: los circuitos de
                remisión están bien definidos.
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Waypoints size={20} />,
            titulo: "Por qué no Girvan-Newman",
            texto: (
              <>
                Girvan-Newman y Label Propagation colapsan casi toda la red en
                una sola comunidad gigante (modularidad ≈ 0). Louvain y Greedy
                Modularity, con ~15–22 comunidades de tamaño medio, son los
                únicos que producen una partición operativamente útil.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
