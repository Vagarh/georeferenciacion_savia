"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ResumenEjecutivo from "@/components/views/ResumenEjecutivo";
import MapaDeRed from "@/components/views/MapaDeRed";
import AnalisisGeografico from "@/components/views/AnalisisGeografico";
import RutasDiagnostico from "@/components/views/RutasDiagnostico";
import AnalisisTemporal from "@/components/views/AnalisisTemporal";
import FlujoNiveles from "@/components/views/FlujoNiveles";
import AnalisisClustering from "@/components/views/AnalisisClustering";
import AnalisisRedes from "@/components/views/AnalisisRedes";
import ZonasZAID from "@/components/views/ZonasZAID";
import InformeFinal from "@/components/views/InformeFinal";
import { FiltrosProvider } from "@/lib/filtros";
import { cargarJson, type Resumen } from "@/lib/datos";

export type View =
  | "resumen"
  | "mapa"
  | "geografico"
  | "diagnosticos"
  | "temporal"
  | "niveles"
  | "clustering"
  | "redes"
  | "zaid"
  | "informe";

const viewLabels: Record<View, string> = {
  resumen: "Resumen Ejecutivo",
  mapa: "Mapa de Red",
  geografico: "Análisis Geográfico",
  diagnosticos: "Flujo por Diagnóstico",
  temporal: "Evolución Temporal",
  niveles: "Flujo entre Niveles",
  clustering: "Clustering · RAD",
  redes: "Redes · RAS",
  zaid: "Zonas · ZAID",
  informe: "Informe Final",
};

const VIEWS: View[] = [
  "resumen",
  "mapa",
  "geografico",
  "diagnosticos",
  "temporal",
  "niveles",
  "clustering",
  "redes",
  "zaid",
  "informe",
];

export default function Home() {
  const [activeView, setActiveView] = useState<View>("resumen");
  const [resumen, setResumen] = useState<Resumen | null>(null);

  // El resumen se comparte con la barra superior (periodo + fecha de datos).
  useEffect(() => {
    cargarJson<Resumen | null>("resumen", null).then(setResumen);
  }, []);

  // Deep-link por hash (#geografico, #redes, ...): permite recargar o
  // compartir una vista concreta y navegar con el historial del navegador.
  useEffect(() => {
    const aplicarHash = () => {
      const h = window.location.hash.replace("#", "") as View;
      if (VIEWS.includes(h)) setActiveView(h);
    };
    aplicarHash();
    window.addEventListener("hashchange", aplicarHash);
    return () => window.removeEventListener("hashchange", aplicarHash);
  }, []);

  const cambiarVista = (v: View) => {
    setActiveView(v);
    if (typeof window !== "undefined") window.location.hash = v;
  };

  const renderView = () => {
    switch (activeView) {
      case "resumen":
        return <ResumenEjecutivo />;
      case "mapa":
        return <MapaDeRed />;
      case "geografico":
        return <AnalisisGeografico />;
      case "diagnosticos":
        return <RutasDiagnostico />;
      case "temporal":
        return <AnalisisTemporal />;
      case "niveles":
        return <FlujoNiveles />;
      case "clustering":
        return <AnalisisClustering />;
      case "redes":
        return <AnalisisRedes />;
      case "zaid":
        return <ZonasZAID />;
      case "informe":
        return <InformeFinal />;
      default:
        return <ResumenEjecutivo />;
    }
  };

  return (
    <FiltrosProvider>
      <div className="flex h-screen overflow-hidden bg-brand-surface">
        <Sidebar activeView={activeView} setActiveView={cambiarVista} />

        <div className="flex-1 flex flex-col ml-64 overflow-hidden">
          <TopBar
            label={viewLabels[activeView]}
            periodo={resumen?.periodo}
            actualizado={resumen?.actualizado}
          />
          <main
            key={activeView}
            className="flex-1 overflow-y-auto animate-page-in"
          >
            {renderView()}
          </main>
        </div>
      </div>
    </FiltrosProvider>
  );
}
