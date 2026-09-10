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
import { useState } from "react";
import {
  Share2,
  Award,
  Users,
  GitBranch,
  HelpCircle,
  Scale,
  Waypoints,
  MapPin,
  Building2,
  Filter,
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

function Metrica({
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

function ComunidadDetalle({ com }: { com: ComunidadTam | null }) {
  if (!com) {
    return (
      <div className="rounded-xl border border-brand-gray3 bg-white p-6 text-sm text-brand-gray1">
        Selecciona una comunidad de la lista.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-brand-gray3 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-bold text-savia-forest">
          Comunidad {com.comunidad}
        </h4>
        <span className="text-xs font-bold text-brand-gray1">
          {fmtEntero(com.sedes)} sedes · {fmtEntero(com.num_municipios)} municipio(s)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Emite (prom/sede)" valor={com.origen_prom} />
        <Metrica label="Recibe (prom/sede)" valor={com.destino_prom} />
        <Metrica label="Nivel complej." valor={com.nivel_prom} />
        <Metrica label="Días de cierre" valor={com.dias_prom} />
        <Metrica label="Tasa efectivas" valor={com.efect_prom} sufijo="%" />
        <Metrica label="Subsidiado" valor={com.pct_subsidiado} sufijo="%" />
        <Metrica label="Remis. emitidas" valor={com.total_origen} />
      </div>

      {com.regiones?.length > 0 || com.municipios?.length > 0 ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand-gray1">
            <MapPin size={13} /> Ubicación
            {com.sedes_ubicadas < com.sedes && (
              <span className="font-medium text-brand-gray1">
                (de {fmtEntero(com.sedes_ubicadas)} de {fmtEntero(com.sedes)} sedes)
              </span>
            )}
          </p>
          {com.regiones?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {com.regiones.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-savia-ice text-savia-deep text-[11px] font-semibold px-2 py-0.5 border border-savia-mint"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {com.municipios?.length > 0 && (
            <p className="text-xs text-brand-muted">
              <span className="font-bold text-brand-gray1">
                Municipios principales:
              </span>{" "}
              {com.municipios.join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-brand-gray1">
          Sin ubicación geográfica: sus sedes son prestadores fuera de Antioquia
          o con nombre no cruzable con el maestro de municipios.
        </p>
      )}

      {com.sedes_lista?.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-brand-gray1 mb-1.5">
            <Building2 size={13} /> Sedes (por volumen emitido)
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-brand-muted">
            {com.sedes_lista.map((s, i) => (
              <li key={i} className="truncate">
                • {s}
              </li>
            ))}
          </ul>
          {com.sedes_restantes > 0 && (
            <p className="text-[11px] text-brand-gray1 mt-1">
              + {fmtEntero(com.sedes_restantes)} sedes más
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalisisRedes() {
  const [algos] = useDatos<RasAlgoritmo[]>("ras_comparacion", []);
  const [comunidades] = useDatos<ComunidadTam[]>("comunidades_louvain", []);
  const [mapa, cargandoMapa] = useDatos<TMapaRed>("mapa_red", MAPA_VACIO);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const dims = rawH.dims ?? DIMS_VACIAS;
  const hayHechos = (rawH.filas?.length ?? 0) > 0;

  // Comunidad RAS seleccionada para aislar en el mapa y ver su perfil
  const [comSel, setComSel] = useState<number | null>(null);
  const comsOrden = [...comunidades].sort((a, b) => b.sedes - a.sedes);
  const comActiva = comsOrden.find((c) => c.id === comSel) ?? null;

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
        accion={
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-brand-gray3 bg-white px-2.5 py-1.5 text-xs font-bold text-brand-muted">
            <Filter size={13} />
            <span className="sr-only">Comunidad a mostrar</span>
            <select
              value={comSel ?? ""}
              onChange={(e) =>
                setComSel(e.target.value === "" ? null : Number(e.target.value))
              }
              className="bg-transparent font-bold focus:outline-none max-w-[15rem]"
            >
              <option value="">Todas las comunidades</option>
              {comsOrden.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.comunidad} · {fmtEntero(c.sedes)} sedes
                  {c.region_dominante && c.region_dominante !== "—"
                    ? ` · ${c.region_dominante}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {cargandoMapa ? (
          <div className="h-[420px] grid place-items-center text-sm text-brand-gray1">
            Cargando mapa…
          </div>
        ) : (
          <MapaRed data={mapa} modoColorInicial="comunidad" comunidadSel={comSel} />
        )}
        {comActiva && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-savia-mint bg-savia-ice px-3 py-2 text-xs text-savia-deep">
            <span>
              Mostrando solo <b>{comActiva.comunidad}</b> —{" "}
              <b>{fmtEntero(comActiva.sedes)}</b> sedes en{" "}
              <b>{fmtEntero(comActiva.num_municipios)}</b> municipio(s)
              {comActiva.region_dominante && comActiva.region_dominante !== "—" && (
                <>
                  , sobre todo <b>{comActiva.region_dominante}</b>
                </>
              )}
              .
            </span>
            <button
              onClick={() => setComSel(null)}
              className="font-bold underline underline-offset-2 hover:text-savia-forest"
            >
              Ver todas
            </button>
          </div>
        )}
        <ComoLeer>
          Es la misma detección de comunidades (Louvain) que compara la tabla de
          abajo, proyectada sobre la geografía. Usa el selector de arriba a la
          derecha para aislar una comunidad en el mapa y leer su perfil en la
          sección siguiente. Los circuitos de remisión suelen cruzar las
          subregiones administrativas, porque todo gravita hacia el Valle de
          Aburrá.
        </ComoLeer>
      </ChartCard>

      {/* Perfil de cada comunidad */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-savia-forest">
            Perfil de cada comunidad
          </h3>
          <p className="text-sm text-brand-muted">
            Qué sedes la componen, dónde están y cómo se comportan en la red.
            Elige una comunidad para verla en el mapa de arriba.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,17rem)_1fr] gap-4">
          <div className="rounded-xl border border-brand-gray3 bg-white overflow-hidden max-h-[520px] overflow-y-auto">
            {comsOrden.map((c) => (
              <button
                key={c.id}
                onClick={() => setComSel(comSel === c.id ? null : c.id)}
                className={
                  "w-full text-left px-4 py-2.5 border-b border-brand-gray3 last:border-0 transition-colors " +
                  (comSel === c.id
                    ? "bg-savia-ice"
                    : "hover:bg-brand-low")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-savia-forest">
                    {c.comunidad}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-brand-charcoal">
                    {fmtEntero(c.sedes)} sedes
                  </span>
                </div>
                <p className="text-[11px] text-brand-gray1 truncate">
                  {c.region_dominante && c.region_dominante !== "—"
                    ? c.region_dominante
                    : "Ubicación mixta"}{" "}
                  · {fmtEntero(c.num_municipios)} municipio(s)
                </p>
              </button>
            ))}
          </div>

          <ComunidadDetalle com={comActiva ?? comsOrden[0] ?? null} />
        </div>
      </section>

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
