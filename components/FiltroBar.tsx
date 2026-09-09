"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { SlidersHorizontal, X, Search, MapPin } from "lucide-react";
import { useFiltros } from "@/lib/filtros";
import type { DimsHechos } from "@/lib/datos";

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
const mesLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${MESES_ABR[Number(mm)]} ${y.slice(2)}`;
};

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
        activo
          ? "bg-savia-green text-white border-savia-green"
          : "bg-white text-brand-muted border-brand-gray3 hover:border-savia-green hover:text-savia-forest"
      )}
    >
      {children}
    </button>
  );
}

export default function FiltroBar({
  dims,
  soloGeo = false,
}: {
  dims: DimsHechos;
  /** Si `true`, solo período + subregión + municipio (para el mapa). */
  soloGeo?: boolean;
}) {
  const { filtros, set, toggle, limpiar, activos } = useFiltros();
  const [busca, setBusca] = useState("");
  // Al filtrar por municipio se usa una tabla que no tiene régimen ni nivel.
  const modoMunicipio = filtros.municipios.length > 0;

  // Municipios disponibles: acotados a las subregiones elegidas, si hay
  const municipiosDisponibles = useMemo(() => {
    if (filtros.regiones.length === 0) return dims.municipios;
    const set = new Set<string>();
    for (const r of filtros.regiones)
      for (const m of dims.municipios_por_region[r] ?? []) set.add(m);
    return [...set].sort();
  }, [filtros.regiones, dims]);

  const municipiosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? municipiosDisponibles.filter((m) => m.toLowerCase().includes(q))
      : municipiosDisponibles;
    return base.slice(0, 60);
  }, [busca, municipiosDisponibles]);

  return (
    <div className="card animate-fade-up !p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-bold text-savia-forest">
          <SlidersHorizontal size={15} />
          Filtros
          {activos > 0 && (
            <span className="badge-green !py-0 !px-2">{activos}</span>
          )}
        </div>
        {activos > 0 && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1 text-xs font-semibold text-brand-gray1 hover:text-savia-forest transition-colors"
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-x-8 gap-y-4">
        {/* Período */}
        <div>
          <p className="kicker mb-1.5">Período</p>
          <div className="flex items-center gap-2">
            <select
              value={filtros.mesDesde ?? dims.meses[0]}
              onChange={(e) => set({ mesDesde: e.target.value })}
              className="text-xs font-semibold border border-brand-gray3 rounded-lg px-2 py-1.5 bg-white text-savia-forest focus:outline-none focus:border-savia-green"
            >
              {dims.meses.map((m) => (
                <option key={m} value={m}>
                  {mesLabel(m)}
                </option>
              ))}
            </select>
            <span className="text-brand-gray1 text-xs">→</span>
            <select
              value={filtros.mesHasta ?? dims.meses[dims.meses.length - 1]}
              onChange={(e) => set({ mesHasta: e.target.value })}
              className="text-xs font-semibold border border-brand-gray3 rounded-lg px-2 py-1.5 bg-white text-savia-forest focus:outline-none focus:border-savia-green"
            >
              {dims.meses.map((m) => (
                <option key={m} value={m}>
                  {mesLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subregión */}
        <div>
          <p className="kicker mb-1.5">Subregión de Antioquia</p>
          <div className="flex flex-wrap gap-1.5">
            {dims.regiones.map((r) => (
              <Chip
                key={r}
                activo={filtros.regiones.includes(r)}
                onClick={() => {
                  // al quitar una subregión, descarta sus municipios seleccionados
                  const quitando = filtros.regiones.includes(r);
                  toggle("regiones", r);
                  if (quitando) {
                    const suyos = new Set(dims.municipios_por_region[r] ?? []);
                    set({
                      municipios: filtros.municipios.filter(
                        (m) => !suyos.has(m)
                      ),
                    });
                  }
                }}
              >
                {r}
              </Chip>
            ))}
          </div>
        </div>

        {/* Municipio */}
        <div className="lg:col-start-2">
          <p className="kicker mb-1.5">
            Municipio del prestador
            {filtros.regiones.length > 0 && (
              <span className="ml-1.5 font-medium normal-case tracking-normal text-brand-gray1">
                · {municipiosDisponibles.length} en la selección
              </span>
            )}
          </p>

          {filtros.municipios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {filtros.municipios.map((m) => (
                <button
                  key={m}
                  onClick={() => toggle("municipios", m)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-savia-green text-white"
                >
                  <MapPin size={11} />
                  {m}
                  <X size={12} className="opacity-80" />
                </button>
              ))}
            </div>
          )}

          <div className="relative max-w-md">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-gray1"
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar municipio…"
              className="w-full text-xs border border-brand-gray3 rounded-lg pl-8 pr-2 py-1.5 bg-white text-savia-forest focus:outline-none focus:border-savia-green"
            />
          </div>

          {busca.trim() && (
            <div className="mt-2 max-h-44 overflow-y-auto border border-brand-gray3 rounded-lg divide-y divide-brand-gray4">
              {municipiosFiltrados.length === 0 && (
                <p className="px-3 py-2 text-xs text-brand-gray1">
                  Sin coincidencias
                </p>
              )}
              {municipiosFiltrados.map((m) => (
                <button
                  key={m}
                  onClick={() => toggle("municipios", m)}
                  className={clsx(
                    "w-full text-left px-3 py-1.5 text-xs transition-colors",
                    filtros.municipios.includes(m)
                      ? "bg-savia-mint text-savia-deep font-semibold"
                      : "hover:bg-brand-low text-brand-muted"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Régimen + Tipo + Nivel */}
        <div
          className={clsx(
            "lg:col-start-2 flex flex-wrap gap-x-8 gap-y-4",
            soloGeo && "hidden"
          )}
        >
          <div className={modoMunicipio ? "opacity-40 pointer-events-none" : ""}>
            <p className="kicker mb-1.5">Régimen</p>
            <div className="flex flex-wrap gap-1.5">
              {dims.regimenes.map((r) => (
                <Chip
                  key={r}
                  activo={filtros.regimenes.includes(r)}
                  onClick={() => toggle("regimenes", r)}
                >
                  {r}
                </Chip>
              ))}
            </div>
          </div>
          <div className={modoMunicipio ? "opacity-40 pointer-events-none" : ""}>
            <p className="kicker mb-1.5">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {dims.tipos.map((t) => (
                <Chip
                  key={t}
                  activo={filtros.tipos.includes(t)}
                  onClick={() => toggle("tipos", t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className={modoMunicipio ? "opacity-40 pointer-events-none" : ""}>
            <p className="kicker mb-1.5">Complejidad</p>
            <div className="flex flex-wrap gap-1.5">
              {dims.niveles.map((n) => (
                <Chip
                  key={n}
                  activo={filtros.niveles.includes(n)}
                  onClick={() => toggle("niveles", n)}
                >
                  Nivel {n}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {modoMunicipio && !soloGeo && (
          <p className="lg:col-span-2 text-[11px] text-brand-gray1">
            Con un municipio seleccionado se usa una tabla más detallada que solo
            tiene volumen y oportunidad de cierre: los filtros de <b>régimen</b>,{" "}
            <b>tipo</b> y <b>complejidad</b> y el desglose referencia /
            contrarreferencia no aplican.
          </p>
        )}
        {soloGeo && (
          <p className="lg:col-span-2 text-[11px] text-brand-gray1">
            Al elegir una <b>subregión</b> o un <b>municipio</b>, el mapa deja
            visibles solo esos nodos y los municipios conectados a ellos por
            remisión; el resto de la red se atenúa. El rango de meses recalcula
            los volúmenes.
          </p>
        )}
      </div>
    </div>
  );
}
