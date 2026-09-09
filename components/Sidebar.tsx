"use client";

import clsx from "clsx";
import {
  LayoutDashboard,
  Map,
  MapPinned,
  Stethoscope,
  CalendarClock,
  ArrowUpNarrowWide,
  Boxes,
  Share2,
  Layers,
  FileText,
} from "lucide-react";
import type { View } from "@/app/page";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "resumen", label: "Resumen Ejecutivo", icon: <LayoutDashboard size={18} /> },
  { id: "mapa", label: "Mapa de Red", icon: <Map size={18} /> },
  { id: "geografico", label: "Análisis Geográfico", icon: <MapPinned size={18} /> },
  { id: "diagnosticos", label: "Flujo por Diagnóstico", icon: <Stethoscope size={18} /> },
  { id: "temporal", label: "Evolución Temporal", icon: <CalendarClock size={18} /> },
  { id: "niveles", label: "Flujo entre Niveles", icon: <ArrowUpNarrowWide size={18} /> },
  { id: "clustering", label: "Clustering · RAD", icon: <Boxes size={18} /> },
  { id: "redes", label: "Redes · RAS", icon: <Share2 size={18} /> },
  { id: "zaid", label: "Zonas · ZAID", icon: <Layers size={18} /> },
  { id: "informe", label: "Informe Final", icon: <FileText size={18} /> },
];

export default function Sidebar({
  activeView,
  setActiveView,
}: {
  activeView: View;
  setActiveView: (v: View) => void;
}) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-brand-low border-r border-brand-gray3 flex flex-col z-20">
      {/* Marca */}
      <div className="px-6 py-6 border-b border-brand-gray3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo1.png"
          alt="Savia Salud EPS"
          width={150}
          height={85}
          className="h-12 w-auto"
        />
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-brand-gray1">
          Análisis Geoespacial
        </p>
        <p className="text-[11px] text-brand-muted leading-tight">
          Referencias y contrarreferencias
        </p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="kicker px-4 mb-2">Vistas</p>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setActiveView(n.id)}
            className={clsx("nav-item w-full text-left", {
              active: activeView === n.id,
            })}
          >
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Pie */}
      <div className="px-6 py-5 border-t border-brand-gray3">
        <p className="text-xs font-bold text-savia-forest">Sistema RAD · RAS · ZAID</p>
        <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
          Referencias y contrarreferencias
          <br />
          Antioquia · régimen subsidiado y contributivo
        </p>
      </div>
    </aside>
  );
}
