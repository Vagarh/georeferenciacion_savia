"use client";

import { CalendarRange, RefreshCw } from "lucide-react";

export default function TopBar({
  label,
  periodo,
  actualizado,
}: {
  label: string;
  periodo?: string;
  actualizado?: string;
}) {
  return (
    <header className="sticky top-0 z-10 bg-brand-surface/80 backdrop-blur-md border-b border-brand-gray3">
      <div className="flex items-center justify-between gap-4 px-8 py-4">
        {/* Migas */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-brand-gray1 font-medium">Dashboard</span>
          <span className="text-brand-gray2">/</span>
          <span className="font-bold text-savia-forest">{label}</span>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3">
          {periodo && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-savia-deep bg-savia-ice border border-savia-mint px-3 py-1.5 rounded-full">
              <CalendarRange size={13} />
              {periodo}
            </span>
          )}
          {actualizado && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] text-brand-gray1">
              <RefreshCw size={12} />
              Datos: {actualizado}
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo1.png"
            alt="Savia Salud EPS"
            width={150}
            height={85}
            className="hidden lg:block h-7 w-auto opacity-90"
          />
        </div>
      </div>
    </header>
  );
}
