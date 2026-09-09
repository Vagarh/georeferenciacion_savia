import type { Metadata } from "next";
import "./globals.css";

// Metadatos globales del dashboard.
export const metadata: Metadata = {
  title: "Análisis Geoespacial · Savia Salud EPS",
  description:
    "Dashboard analítico de referencias y contrarreferencias: flujos, clustering RAD, redes RAS y zonas ZAID.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
