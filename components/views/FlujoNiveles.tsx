"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ArrowUpNarrowWide,
  CheckCircle2,
  MoveUpRight,
  Equal,
  MoveDownRight,
  HelpCircle,
  Stethoscope,
  Undo2,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import Hero from "@/components/Hero";
import ChartCard from "@/components/ChartCard";
import DiagramaNiveles from "@/components/DiagramaNiveles";
import PanelInsights, { ComoLeer } from "@/components/PanelInsights";
import { useDatos } from "@/lib/useDatos";
import {
  fmtEntero,
  fmtPct,
  fmtDecimal,
  type MovilidadNiveles,
  type Resumen,
} from "@/lib/datos";

type Tipo = "referencia" | "contrarreferencia";

const VACIO_BLOQUE = {
  total: 0,
  sube: 0,
  igual: 0,
  baja: 0,
  sin_dato: 0,
  pct_sube: 0,
  pct_igual: 0,
  pct_baja: 0,
  dias_promedio: 0,
  tasa_resolucion: 0,
  celdas: [],
};

const VACIO: MovilidadNiveles = {
  referencia: { ...VACIO_BLOQUE },
  contrarreferencia: { ...VACIO_BLOQUE },
  niveles_origen: [1, 2, 3],
  niveles_destino: [1, 2, 3, 4],
  nota: "",
};

export default function FlujoNiveles() {
  const [data] = useDatos<MovilidadNiveles>("movilidad_niveles", VACIO);
  const [resumen] = useDatos<Resumen | null>("resumen", null);
  const [tipo, setTipo] = useState<Tipo>("referencia");

  const b = data[tipo];
  const conNivel = b.sube + b.igual + b.baja || 1;

  const estados = resumen
    ? [
        { name: "Cerrada", value: resumen.cerradas, color: "#00954c" },
        { name: "Cancelada", value: resumen.canceladas, color: "#f2a900" },
        { name: "Anulada", value: resumen.anuladas, color: "#c2cec8" },
      ]
    : [];
  const totalEstados = estados.reduce((s, e) => s + e.value, 0) || 1;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12">
      <Hero
        kicker="Movilidad asistencial"
        titulo="Flujo entre"
        resaltado="Niveles"
        descripcion="Cómo se mueve el paciente entre niveles de complejidad al ser remitido y qué proporción de las remisiones cierra efectivamente su ciclo. Una referencia bien indicada escala de nivel; una contrarreferencia devuelve al paciente a su nivel de origen para seguimiento."
      />

      {/* Selector de tipo */}
      <div className="inline-flex rounded-lg border border-brand-gray3 overflow-hidden text-sm font-bold">
        {(
          [
            ["referencia", "Referencia"],
            ["contrarreferencia", "Contrarreferencia"],
          ] as [Tipo, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={clsx(
              "px-5 py-2 transition-colors",
              tipo === t
                ? "bg-savia-green text-white"
                : "bg-white text-brand-muted hover:bg-brand-low"
            )}
          >
            {label}
            <span
              className={clsx(
                "ml-2 text-xs font-semibold",
                tipo === t ? "text-white/70" : "text-brand-gray1"
              )}
            >
              {fmtEntero(data[t].total)}
            </span>
          </button>
        ))}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Tasa de resolución"
          value={fmtPct(b.tasa_resolucion, 1)}
          subtitle="Cerradas de las que llegan a desenlace (cerrada + cancelada)"
          trend="up"
          trendLabel="cierre"
          icon={<CheckCircle2 size={18} />}
          delay={0}
        />
        <KPICard
          title="Escala de nivel"
          value={fmtPct(b.pct_sube, 1)}
          subtitle={`${fmtEntero(b.sube)} pasan a mayor complejidad`}
          trend="up"
          trendLabel="escalada"
          trendPositive
          icon={<MoveUpRight size={18} />}
          iconBg="#e0f2f3"
          iconColor="#009ca6"
          delay={75}
        />
        <KPICard
          title="Mismo nivel"
          value={fmtPct(b.pct_igual, 1)}
          subtitle={`${fmtEntero(b.igual)} se resuelven en el nivel de origen`}
          trend="neutral"
          trendLabel="lateral"
          icon={<Equal size={18} />}
          iconBg="#eef2f6"
          iconColor="#64748b"
          delay={150}
        />
        <KPICard
          title="Retorno a menor nivel"
          value={fmtPct(b.pct_baja, 1)}
          subtitle={`${fmtEntero(b.baja)} vuelven a menor complejidad`}
          trend="neutral"
          trendLabel="contrarref."
          icon={<MoveDownRight size={18} />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          delay={225}
        />
      </section>

      <ChartCard
        titulo={`Movimiento entre niveles de complejidad · ${
          tipo === "referencia" ? "Referencias" : "Contrarreferencias"
        }`}
        subtitulo={`${fmtEntero(
          conNivel
        )} remisiones con nivel de origen y destino registrado · tiempo medio de cierre ${fmtDecimal(
          b.dias_promedio
        )} días`}
        accion={
          <span className="badge-green">
            <ArrowUpNarrowWide size={13} /> Nivel 1 → 4
          </span>
        }
      >
        <DiagramaNiveles
          celdas={b.celdas}
          nivelesO={data.niveles_origen}
          nivelesD={data.niveles_destino}
        />
        <ComoLeer>
          Cada banda es un grupo de remisiones que salió del <b>nivel de origen</b>{" "}
          (izquierda) y llegó al <b>nivel de destino</b> (derecha). Verde = el
          paciente sube de complejidad (escalada); gris = se queda en el mismo
          nivel; ámbar = regresa a un nivel inferior. {data.nota}
        </ComoLeer>
      </ChartCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          titulo="Desenlace de la gestión"
          subtitulo="Estado final del evento de remisión · período completo"
        >
          <div className="space-y-4">
            {estados.map((e) => {
              const pct = (e.value / totalEstados) * 100;
              return (
                <div key={e.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-savia-forest">
                    <span>{e.name}</span>
                    <span className="tabular-nums">
                      {fmtPct(pct, 1)}
                      <span className="ml-2 text-brand-gray1 font-medium">
                        {fmtEntero(e.value)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-brand-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: e.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <ComoLeer>
            La <b>tasa de resolución</b> mira solo las remisiones que llegaron a
            un desenlace real: deja fuera las <i>anuladas</i> (registro duplicado
            o error de digitación) y calcula qué fracción de las restantes
            terminó <i>cerrada</i>. Es más exigente que la efectividad sobre el
            total.
          </ComoLeer>
        </ChartCard>

        <ChartCard
          titulo="Resolución por tipo de remisión"
          subtitulo="Cierre efectivo del ciclo, referencia vs contrarreferencia"
        >
          <div className="space-y-6 pt-2">
            {(["referencia", "contrarreferencia"] as Tipo[]).map((t) => {
              const bl = data[t];
              return (
                <div key={t} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold text-savia-forest capitalize">
                    <span>{t}</span>
                    <span className="tabular-nums">
                      {fmtPct(bl.tasa_resolucion, 1)}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-brand-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-savia-green"
                      style={{ width: `${bl.tasa_resolucion}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-brand-gray1">
                    {fmtEntero(bl.total)} remisiones · retorno a menor nivel{" "}
                    {fmtPct(bl.pct_baja, 0)}
                  </p>
                </div>
              );
            })}
          </div>
          <ComoLeer>
            La contrarreferencia devuelve al paciente a su nivel de origen: por
            eso su proporción de «retorno a menor complejidad» es mucho más alta
            que la de la referencia.
          </ComoLeer>
        </ChartCard>
      </section>

      <PanelInsights
        items={[
          {
            tono: "green",
            icon: <HelpCircle size={20} />,
            titulo: "Qué mide la movilidad de nivel",
            texto: (
              <>
                Compara la <b>complejidad del prestador que remite</b> con la del
                que recibe. En una <i>referencia</i> lo esperable es escalar
                (Nivel 1 → 2/3); en una <i>contrarreferencia</i>, descender para
                que el nivel primario siga el caso. Un exceso de movimientos{" "}
                <i>laterales</i> (mismo nivel) puede señalar derivaciones
                evitables o falta de resolución en el punto de origen.
              </>
            ),
          },
          {
            tono: "teal",
            icon: <Stethoscope size={20} />,
            titulo: "La referencia escala poco",
            texto: (
              <>
                Solo <b>{fmtPct(data.referencia.pct_sube, 0)}</b> de las
                referencias sube de nivel y{" "}
                <b>{fmtPct(data.referencia.pct_igual, 0)}</b> se mantiene en el
                mismo. Buena parte del volumen se mueve entre sedes de Nivel 1:
                conviene revisar la capacidad resolutiva de la baja complejidad y
                la pertinencia de esas remisiones.
              </>
            ),
          },
          {
            tono: "gold",
            icon: <Undo2 size={20} />,
            titulo: "Contrarreferencia subregistrada",
            texto: (
              <>
                Se registran <b>{fmtEntero(data.contrarreferencia.total)}</b>{" "}
                contrarreferencias frente a{" "}
                <b>{fmtEntero(data.referencia.total)}</b> referencias (
                {fmtPct(
                  (data.contrarreferencia.total /
                    (data.referencia.total + data.contrarreferencia.total)) *
                    100,
                  1
                )}
                ). El retorno del paciente al nivel de origen apenas queda
                documentado; sin ese cierre, la trazabilidad del episodio queda
                incompleta.
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
