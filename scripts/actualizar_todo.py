#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Actualización completa del dashboard
====================================
Orquesta, en un solo comando, todo el refresco de datos del dashboard
Next.js. Ejecuta en orden:

1. ``notebooks/actualizar_datos.py``     -> extrae remisiones desde la BD
   corporativa a ``notebooks/resultados_regulaciones.csv`` (requiere VPN y
   la variable de entorno ``SAVIA_DB_PASSWORD``).
2. ``sistema_cluster/ejecutar_analisis.py --sin-reporte`` -> recalcula
   RAD, RAS y ZAID sobre el CSV nuevo -> ``sistema_cluster/output/clusters/*.csv``.
3. ``dashboard/scripts/preparar_datos.py`` -> regenera todos los JSON de
   ``dashboard/public/data/`` (KPIs, series, mapa, clustering, redes, ZAID,
   diagnósticos, hechos, dendrograma, movilidad...).

Si un paso falla, se detiene y devuelve código != 0.

Uso:
    python scripts/actualizar_todo.py                 # todo
    python scripts/actualizar_todo.py --saltar-extraccion   # ya tengo el CSV
    python scripts/actualizar_todo.py --saltar-clustering   # no recalcular RAD/RAS/ZAID

Autor: Área de Analítica y Ciencias del Dato — Savia Salud EPS
Proyecto: proyectos_bi/33_Georeferenciacion — Análisis Geoespacial
"""

# --- Imports ---
import argparse
import subprocess
import sys
import time
from pathlib import Path

# --- Rutas ---
DIR_SCRIPT = Path(__file__).resolve().parent
DIR_DASHBOARD = DIR_SCRIPT.parent
DIR_PROYECTO = DIR_DASHBOARD.parent  # Analisis_geoespacial/
DIR_NOTEBOOKS = DIR_PROYECTO / "notebooks"
DIR_CLUSTER = DIR_PROYECTO / "sistema_cluster"


def _paso(titulo: str) -> None:
    print("\n" + "=" * 70)
    print(titulo)
    print("=" * 70, flush=True)


def _ejecutar(comando: list[str], cwd: Path, etiqueta: str) -> None:
    """Ejecuta un subproceso mostrando su salida en vivo. Aborta si falla."""
    print(f"$ {' '.join(comando)}   (cwd={cwd})", flush=True)
    inicio = time.time()
    resultado = subprocess.run(comando, cwd=str(cwd))
    dur = time.time() - inicio
    if resultado.returncode != 0:
        print(
            f"\n[ERROR] '{etiqueta}' terminó con código {resultado.returncode} "
            f"tras {dur:.0f}s. Se detiene la actualización.",
            file=sys.stderr,
        )
        sys.exit(resultado.returncode)
    print(f"[OK] {etiqueta} ({dur:.0f}s)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Refresco completo de datos del dashboard geoespacial."
    )
    parser.add_argument(
        "--saltar-extraccion",
        action="store_true",
        help="No re-extraer el CSV desde la BD (usa el resultados_regulaciones.csv existente).",
    )
    parser.add_argument(
        "--saltar-clustering",
        action="store_true",
        help="No recalcular RAD / RAS / ZAID (mantiene los CSV de sistema_cluster/output/clusters).",
    )
    args = parser.parse_args()

    t0 = time.time()
    py = sys.executable

    # --- 1. Extracción desde la BD ---
    if args.saltar_extraccion:
        print("[SKIP] Extracción desde la BD (--saltar-extraccion).")
    else:
        _paso("PASO 1/3 · Extracción de remisiones desde la base de datos")
        _ejecutar([py, "actualizar_datos.py"], DIR_NOTEBOOKS, "extracción BD")

    # --- 2. Clustering RAD / RAS / ZAID ---
    if args.saltar_clustering:
        print("[SKIP] Clustering RAD/RAS/ZAID (--saltar-clustering).")
    else:
        _paso("PASO 2/3 · Recalcular RAD / RAS / ZAID (sistema_cluster)")
        _ejecutar(
            [py, "ejecutar_analisis.py", "--sin-reporte"],
            DIR_CLUSTER,
            "clustering RAD/RAS/ZAID",
        )

    # --- 3. JSON del dashboard ---
    _paso("PASO 3/3 · Regenerar los JSON del dashboard (public/data)")
    _ejecutar(
        [py, "scripts/preparar_datos.py"], DIR_DASHBOARD, "preparar_datos"
    )

    total = time.time() - t0
    print("\n" + "=" * 70)
    print(f"ACTUALIZACIÓN COMPLETA en {total / 60:.1f} min")
    print("=" * 70)
    print(
        "\nSiguiente paso: revisar y publicar\n"
        "  cd "
        + str(DIR_DASHBOARD)
        + "\n  git add -A && git commit -m \"data: refrescar hasta <mes>\" && git push\n"
        "Vercel redespliega solo.\n"
    )


if __name__ == "__main__":
    main()
