"use client";

import { useEffect, useState } from "react";
import { cargarJson } from "@/lib/datos";

/**
 * Hook de conveniencia: carga /public/data/<nombre>.json una vez.
 * Devuelve `[datos, cargando]`.
 */
export function useDatos<T>(nombre: string, fallback: T): [T, boolean] {
  const [datos, setDatos] = useState<T>(fallback);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    cargarJson<T>(nombre, fallback).then((d) => {
      if (vivo) {
        setDatos(d);
        setCargando(false);
      }
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre]);

  return [datos, cargando];
}
