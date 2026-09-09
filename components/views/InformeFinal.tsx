"use client";

import { useMemo } from "react";
import {
  FileText,
  Target,
  MapPinned,
  ArrowLeftRight,
  Timer,
  ArrowUpNarrowWide,
  Globe2,
  Share2,
  Lightbulb,
} from "lucide-react";
import Hero from "@/components/Hero";
import FiltroBar from "@/components/FiltroBar";
import { useDatos } from "@/lib/useDatos";
import { useFiltros, agregar } from "@/lib/filtros";
import {
  fmtEntero,
  fmtDecimal,
  fmtPct,
  expandirHechos,
  mapaMunicipioRegion,
  HECHOS_RAW_VACIO,
  DIMS_VACIAS,
  type HechosRaw,
  type Resumen,
  type MovilidadNiveles,
  type MapaRed as TMapaRed,
  type TiemposCierre,
  type ClusteringPerfil,
} from "@/lib/datos";

const MESES_ABR = [
  "",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const mesLabel = (m: string | null | undefined) => {
  if (!m) return null;
  const [y, mm] = m.split("-");
  return `${MESES_ABR[Number(mm)]} ${y}`;
};

function Seccion({
  icon,
  titulo,
  contexto,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  contexto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card animate-fade-up">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-9 h-9 rounded-lg bg-savia-mint text-savia-deep flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h4 className="text-base font-bold text-savia-forest">{titulo}</h4>
        {contexto && (
          <span className="inline-flex items-center rounded-full border border-brand-gray3 bg-brand-low px-2 py-0.5 text-[10px] font-bold text-brand-gray1">
            contexto · período completo
          </span>
        )}
      </div>
      <div className="text-sm text-brand-muted leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function InformeFinal() {
  const [resumen] = useDatos<Resumen | null>("resumen", null);
  const [rawH] = useDatos<HechosRaw>("hechos", HECHOS_RAW_VACIO);
  const [rawM] = useDatos<HechosRaw>("hechos_muni", HECHOS_RAW_VACIO);
  const [movil] = useDatos<MovilidadNiveles | null>("movilidad_niveles", null);
  const [tiempos] = useDatos<TiemposCierre | null>("tiempos_cierre", null);
  const [perfil] = useDatos<ClusteringPerfil | null>("clustering_perfil", null);
  const [mapa] = useDatos<TMapaRed | null>("mapa_red", null);
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

  const globalTotal = resumen?.total_remisiones ?? 0;
  const pctGlobal = globalTotal ? (agg.total / globalTotal) * 100 : 0;
  const promMes =
    agg.porMes.length > 0
      ? agg.porMes.reduce((a, b) => a + b.remisiones, 0) / agg.porMes.length
      : 0;
  const mesPico =
    agg.porMes.length > 0
      ? agg.porMes.reduce((a, b) => (b.remisiones > a.remisiones ? b : a))
      : null;

  const terr = usaMuni ? agg.porMunicipio : agg.porRegion;
  const terrLabel = usaMuni ? "municipio" : "subregión";
  const terrTop = terr.slice(0, 3);
  const pctLider = agg.total ? ((terr[0]?.value ?? 0) / agg.total) * 100 : 0;

  const ref = movil?.referencia;
  const externos = mapa?.externos;
  const medellin = mapa?.nodos.find((n) => n.nombre.startsWith("Medell"));
  const pctMedellin =
    medellin && mapa
      ? ((medellin.origen + medellin.destino) /
          mapa.nodos.reduce((s, n) => s + n.origen + n.destino, 0)) *
        100
      : 0;
  const arquetipoMayor = perfil?.clusters?.[0];

  // --- Alcance del informe en prosa ---
  const alcance: string[] = [];
  const d1 = mesLabel(filtros.mesDesde ?? dims.meses[0]);
  const d2 = mesLabel(filtros.mesHasta ?? dims.meses[dims.meses.length - 1]);
  alcance.push(d1 && d2 ? (d1 === d2 ? d1 : `${d1} – ${d2}`) : "período completo");
  alcance.push(
    filtros.regiones.length
      ? `subregión${filtros.regiones.length > 1 ? "es" : ""}: ${filtros.regiones.join(", ")}`
      : "todas las subregiones"
  );
  if (filtros.municipios.length)
    alcance.push(`municipio${filtros.municipios.length > 1 ? "s" : ""}: ${filtros.municipios.join(", ")}`);
  if (filtros.regimenes.length) alcance.push(`régimen: ${filtros.regimenes.join(", ")}`);
  if (filtros.tipos.length) alcance.push(`tipo: ${filtros.tipos.join(", ")}`);
  if (filtros.niveles.length)
    alcance.push(`complejidad: nivel ${filtros.niveles.join(", ")}`);

  // --- Focos derivados de las cifras ---
  const focos: string[] = [];
  if (mapa && mapa.resumen.pct_intermunicipal > 45)
    focos.push(
      `El ${fmtPct(mapa.resumen.pct_intermunicipal, 0)} de las remisiones cruza de municipio: reforzar la capacidad resolutiva local en los corredores hacia el Valle de Aburrá reduciría traslados.`
    );
  if (agg.tasaEfectividad < 60)
    focos.push(
      `La tasa de efectividad en el alcance actual es ${fmtPct(agg.tasaEfectividad, 1)} (eventos cerrados). Revisar el cierre y el registro de la gestión eleva la trazabilidad.`
    );
  if (!usaMuni && agg.pctReferencias > 90)
    focos.push(
      `Las contrarreferencias son solo el ${fmtPct(100 - agg.pctReferencias, 1)} del flujo. Sin el registro del retorno del paciente, el ciclo de referencia queda incompleto.`
    );
  if (ref && ref.pct_igual > 45)
    focos.push(
      `El ${fmtPct(ref.pct_igual, 0)} de las referencias se mueve entre sedes del mismo nivel de complejidad: conviene auditar la pertinencia de esas derivaciones.`
    );
  if (pctMedellin > 30)
    focos.push(
      `La red es fuertemente hub-and-spoke: Medellín concentra cerca del ${fmtPct(pctMedellin, 0)} de la actividad. Su saturación se propaga a todo el sistema.`
    );
  if (externos && externos.destinos[0])
    focos.push(
      `${fmtEntero(externos.destinos[0].valor)} remisiones salen del departamento hacia ${externos.destinos[0].nombre}; formalizar esa ruta con la red contratada mejora la oportunidad para Urabá y el Bajo Cauca.`
    );

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-10">
      <Hero
        kicker="Síntesis"
        titulo="Informe"
        resaltado="Final"
        descripcion="Resumen narrativo del sistema de referencia y contrarreferencia que se recalcula con los filtros. Ajusta período, subregión, municipio, régimen, tipo o complejidad y el informe se reescribe para ese alcance."
      />

      {hayHechos && <FiltroBar dims={dims} />}

      {/* Alcance */}
      <div className="card border-l-4 border-l-savia-green bg-savia-ice/40 animate-fade-up">
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} className="text-savia-deep" />
          <h4 className="text-sm font-black uppercase tracking-widest text-brand-gray1">
            Alcance del informe
          </h4>
        </div>
        <p className="text-sm text-savia-forest leading-relaxed">
          {alcance.map((a, i) => (
            <span key={i}>
              {i > 0 && <span className="text-brand-gray2"> · </span>}
              <b>{a}</b>
            </span>
          ))}
        </p>
        <p className="text-sm text-brand-muted mt-2">
          <b>{fmtEntero(agg.total)}</b> remisiones en este alcance
          {activos > 0 && globalTotal > 0 && (
            <> — {fmtPct(pctGlobal, 1)} del total del período</>
          )}
          .
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Seccion icon={<FileText size={18} />} titulo="Volumen y ritmo">
          <p>
            En el alcance seleccionado se registran{" "}
            <b>{fmtEntero(agg.total)}</b> remisiones a lo largo de{" "}
            <b>{agg.porMes.length}</b> mes(es), con un promedio de{" "}
            <b>{fmtEntero(promMes)}</b> por mes.
            {mesPico && (
              <>
                {" "}
                El mes de mayor volumen es <b>{mesPico.mes_label}</b> (
                {fmtEntero(mesPico.remisiones)}).
              </>
            )}
          </p>
          <p>
            La demanda se mueve en una banda estrecha alrededor del promedio: la
            planificación de capacidad puede asumir una carga casi constante mes
            a mes.
          </p>
        </Seccion>

        <Seccion icon={<MapPinned size={18} />} titulo="Distribución territorial">
          {terrTop.length > 0 ? (
            <>
              <p>
                Por {terrLabel} del prestador, la actividad se concentra en{" "}
                {terrTop.map((t, i) => (
                  <span key={t.name}>
                    {i > 0 && (i === terrTop.length - 1 ? " y " : ", ")}
                    <b>{t.name}</b> ({fmtEntero(t.value)})
                  </span>
                ))}
                .
              </p>
              <p>
                El {terrLabel} líder reúne el <b>{fmtPct(pctLider, 0)}</b> de las
                remisiones del alcance; las zonas periféricas aparecen sobre todo
                como emisoras hacia el centro del departamento.
              </p>
            </>
          ) : (
            <p>Sin datos territoriales para este alcance.</p>
          )}
        </Seccion>

        <Seccion
          icon={<ArrowLeftRight size={18} />}
          titulo="Referencia y contrarreferencia"
        >
          {usaMuni ? (
            <p>
              Al filtrar por municipio no hay desglose por tipo de solicitud. El
              total del alcance es <b>{fmtEntero(agg.total)}</b> remisiones.
            </p>
          ) : (
            <>
              <p>
                El <b>{fmtPct(agg.pctReferencias, 1)}</b> del flujo son
                referencias y <b>{fmtEntero(agg.contrarreferencias)}</b> son
                contrarreferencias ({fmtPct(100 - agg.pctReferencias, 1)}).
              </p>
              <p>
                El fuerte predominio de la referencia y el bajo registro de la
                contrarreferencia limitan la trazabilidad del retorno del
                paciente a su nivel de origen.
              </p>
            </>
          )}
        </Seccion>

        <Seccion icon={<Timer size={18} />} titulo="Oportunidad y resolución">
          <p>
            El tiempo medio de cierre en el alcance es de{" "}
            <b>{fmtDecimal(agg.tiempoPromedio)} día(s)</b> y la tasa de
            efectividad (eventos cerrados) es del{" "}
            <b>{fmtPct(agg.tasaEfectividad, 1)}</b> sobre{" "}
            {fmtEntero(agg.total)} remisiones.
          </p>
          {tiempos?.estadisticos && (
            <p>
              Como referencia del proceso completo, la mediana de cierre es{" "}
              <b>{fmtDecimal(tiempos.estadisticos.mediana)}</b> día(s) y el P90
              sube a <b>{fmtDecimal(tiempos.estadisticos.p90)}</b>: el foco está
              en esa cola de casos que se demoran.
            </p>
          )}
        </Seccion>

        {ref && (
          <Seccion
            icon={<ArrowUpNarrowWide size={18} />}
            titulo="Movilidad entre niveles"
            contexto
          >
            <p>
              De las referencias con nivel de origen y destino registrado,{" "}
              <b>{fmtPct(ref.pct_sube, 0)}</b> escala a mayor complejidad,{" "}
              <b>{fmtPct(ref.pct_igual, 0)}</b> se resuelve en el mismo nivel y{" "}
              <b>{fmtPct(ref.pct_baja, 0)}</b> regresa a un nivel inferior.
            </p>
            <p>
              La tasa de resolución (cerradas sobre las que llegan a desenlace)
              es del <b>{fmtPct(ref.tasa_resolucion, 1)}</b> para la referencia y{" "}
              <b>{fmtPct(movil.contrarreferencia.tasa_resolucion, 1)}</b> para la
              contrarreferencia.
            </p>
          </Seccion>
        )}

        {externos && (
          <Seccion icon={<Globe2 size={18} />} titulo="Frontera departamental" contexto>
            <p>
              <b>{fmtEntero(externos.total_salidas)}</b> remisiones (
              {fmtPct(externos.pct_salidas, 1)}) salen de Antioquia —
              principalmente hacia <b>{externos.destinos[0]?.nombre}</b> — y{" "}
              <b>{fmtEntero(externos.total_entradas)}</b> (
              {fmtPct(externos.pct_entradas, 1)}) llegan desde otros
              departamentos, sobre todo de <b>{externos.origenes[0]?.nombre}</b>.
            </p>
          </Seccion>
        )}

        {perfil && mapa && (
          <Seccion icon={<Share2 size={18} />} titulo="Estructura de la red" contexto>
            <p>
              La red es de tipo <i>hub-and-spoke</i>: Medellín concentra cerca
              del <b>{fmtPct(pctMedellin, 0)}</b> de la actividad y se detectan{" "}
              <b>{fmtEntero(mapa.resumen.num_comunidades)}</b> comunidades de
              remisión (circuitos que se derivan sobre todo entre sí).
            </p>
            {arquetipoMayor && (
              <p>
                Las <b>{fmtEntero(perfil.num_sedes)}</b> sedes se agrupan en{" "}
                <b>{perfil.num_clusters}</b> arquetipos; el más numeroso es
                «{arquetipoMayor.etiqueta}» ({arquetipoMayor.sedes} sedes).
              </p>
            )}
          </Seccion>
        )}
      </div>

      {/* Focos */}
      <div className="card border-l-4 border-l-savia-gold bg-amber-50/30 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={16} className="text-savia-gold" />
          <h4 className="text-sm font-black uppercase tracking-widest text-brand-gray1">
            Focos de gestión
          </h4>
        </div>
        <ul className="space-y-2 text-sm text-brand-muted leading-relaxed">
          {focos.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-savia-gold font-black shrink-0">›</span>
              <span>{f}</span>
            </li>
          ))}
          {focos.length === 0 && (
            <li>No se detectan focos automáticos para este alcance.</li>
          )}
        </ul>
        <p className="mt-4 text-[11px] text-brand-gray1">
          Las secciones marcadas <b>contexto</b> usan el período completo (no
          dependen de la tabla de hechos filtrable). El resto se recalcula con
          los filtros de arriba.
        </p>
      </div>
    </div>
  );
}
