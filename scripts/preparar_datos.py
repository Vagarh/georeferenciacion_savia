#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Preparación de datos para el dashboard Next.js
==============================================
Agrega los CSV del proyecto de Análisis Geoespacial y genera archivos JSON
ligeros y ANONIMIZADOS en ``dashboard/public/data/``.

El dashboard web solo consume estos JSON: nunca se publica el CSV original
``resultados_regulaciones.csv`` porque contiene datos personales de afiliados
(nombre, documento, dirección, ficha Sisbén). Aquí solo se calculan conteos
y promedios agregados — sin identificadores personales.

Autor: Área de Analítica y Ciencias del Dato — Savia Salud EPS
Fecha: 2026-09-09
Proyecto: proyectos_bi/33_Georeferenciacion — Análisis Geoespacial
"""

# --- Imports ---
import json
import logging
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# --- Configuración de logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("preparar_datos")

# --- Rutas ---
DIR_SCRIPT = Path(__file__).resolve().parent
DIR_DASHBOARD = DIR_SCRIPT.parent
DIR_PROYECTO = DIR_DASHBOARD.parent  # Analisis_geoespacial/
DIR_SALIDA = DIR_DASHBOARD / "public" / "data"

RUTA_REMISIONES = DIR_PROYECTO / "notebooks" / "resultados_regulaciones.csv"
RUTA_MATRIZ_OD = DIR_PROYECTO / "datos" / "procesados" / "matriz_flujo_od.csv"
RUTA_GEO_MERGE = DIR_PROYECTO / "datos" / "procesados" / "geo_merge.csv"
DIR_CLUSTERS = DIR_PROYECTO / "sistema_cluster" / "output" / "clusters"

# --- Constantes de agregación ---
TOP_SEDES = 15
TOP_CONEXIONES = 20
TOP_DIAGNOSTICOS = 12
TOP_SERVICIOS = 10

MESES_ES = [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]


# --- Utilidades ---
def _limpiar_texto(serie: pd.Series) -> pd.Series:
    """Quita espacios sobrantes y normaliza mayúsculas en una columna de texto."""
    return (
        serie.astype("string")
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
    )


def _titulo(texto: str) -> str:
    """Convierte 'ESE HOSPITAL SAN JUAN' -> 'Ese Hospital San Juan' de forma segura."""
    if not isinstance(texto, str):
        return ""
    return texto.title().replace("Ese ", "ESE ").replace("Ips ", "IPS ")


def _sin_tildes(texto: str) -> str:
    """Normaliza para comparar regiones sin importar tildes."""
    if not isinstance(texto, str):
        return ""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    ).upper().strip()


def _num(valor) -> float | int | None:
    """Convierte numpy/pandas a tipo nativo JSON-serializable."""
    if valor is None or (isinstance(valor, float) and np.isnan(valor)):
        return None
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating,)):
        return round(float(valor), 2)
    return valor


def escribir_json(nombre: str, contenido, compacto: bool = False) -> None:
    """Guarda un objeto como JSON en public/data/<nombre>.json.

    `compacto=True` omite la indentación (para archivos grandes como hechos.json).
    """
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)
    ruta = DIR_SALIDA / f"{nombre}.json"
    with open(ruta, "w", encoding="utf-8") as fh:
        if compacto:
            json.dump(contenido, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(contenido, fh, ensure_ascii=False, indent=2)
    log.info("  -> %s (%d bytes)", ruta.name, ruta.stat().st_size)


# --- Carga de datos ---
def cargar_remisiones() -> pd.DataFrame:
    """Carga el CSV de remisiones seleccionando solo columnas no sensibles."""
    if not RUTA_REMISIONES.exists():
        log.error("No se encontró %s", RUTA_REMISIONES)
        sys.exit(1)

    # Solo se leen columnas necesarias para agregación (se excluye toda PII:
    # Nombre_Completo, Documento_Afiliado, Direccion_Afiliado, Ficha_Sisben...).
    columnas = [
        "tipo_solicitud",
        "Fecha_Diligenciamiento_Solicitud",
        "Tiempo_Dias_Cierre",
        "Desc_Sede_Prestador",
        "Departamento_Prestador",
        "Municipio_Prestador",
        "Codigo_Dane_Prestador",
        "Region_Prestador",
        "Desc_Sede_Destino",
        "Departamento_Destino",
        "Municipio_Destino",
        "Codigo_Dane_Destino",
        "Region_Destino",
        "Edad",
        "Nombre_Diagnostico_Principal",
        "Servicio_Solicita",
        "Estado_Evento",
        "Motivo_Gestion",
        "Regimen",
        "Nivel_Complejidad_Prestador",
        "Nivel_Complejidad_Destino",
        "triage",
    ]
    log.info("Leyendo %s ...", RUTA_REMISIONES.name)
    df = pd.read_csv(
        RUTA_REMISIONES,
        encoding="utf-8-sig",
        usecols=lambda c: c in columnas,
        low_memory=False,
    )
    log.info("  %s filas x %s columnas", f"{len(df):,}", df.shape[1])

    # Limpieza de texto
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = _limpiar_texto(df[col])

    df["Fecha_Diligenciamiento_Solicitud"] = pd.to_datetime(
        df["Fecha_Diligenciamiento_Solicitud"], errors="coerce"
    )
    df["Tiempo_Dias_Cierre"] = pd.to_numeric(
        df["Tiempo_Dias_Cierre"], errors="coerce"
    )
    return df


# --- Bloques de agregación ---
def generar_resumen(df: pd.DataFrame) -> None:
    """KPIs generales del período."""
    total = len(df)
    estado = df["Estado_Evento"].str.lower()
    cerradas = int((estado == "cerrada").sum())
    canceladas = int((estado == "cancelada").sum())
    anuladas = int((estado == "anulada").sum())
    # Tasa de resolución: de las remisiones que llegaron a un desenlace real
    # (cerrada o cancelada, se excluyen las anuladas por error/duplicado),
    # cuántas cerraron efectivamente el ciclo de referencia.
    con_desenlace = cerradas + canceladas
    tasa_resolucion = cerradas / con_desenlace * 100 if con_desenlace else 0
    fechas = df["Fecha_Diligenciamiento_Solicitud"].dropna()
    fecha_min, fecha_max = fechas.min(), fechas.max()

    if pd.notna(fecha_min) and pd.notna(fecha_max):
        if fecha_min.year == fecha_max.year:
            periodo = (
                f"{MESES_ES[fecha_min.month]}–{MESES_ES[fecha_max.month]} "
                f"{fecha_min.year}"
            )
        else:
            periodo = (
                f"{MESES_ES[fecha_min.month]} {fecha_min.year} – "
                f"{MESES_ES[fecha_max.month]} {fecha_max.year}"
            )
    else:
        periodo = "Sin fecha"

    tipos = df["tipo_solicitud"].value_counts()
    # El valor real en la fuente para las contrarreferencias es "Contra-referencia".
    referencias = int(
        sum(v for k, v in tipos.items() if _sin_tildes(k).startswith("REFERENCIA"))
    )
    contrarref = int(
        sum(v for k, v in tipos.items() if "CONTRA" in _sin_tildes(k))
    )

    resumen = {
        "total_remisiones": _num(total),
        "sedes_origen": _num(df["Desc_Sede_Prestador"].nunique()),
        "sedes_destino": _num(df["Desc_Sede_Destino"].nunique()),
        "municipios_origen": _num(df["Departamento_Prestador"].nunique()),
        "tiempo_promedio_cierre": _num(df["Tiempo_Dias_Cierre"].mean()),
        "tiempo_mediana_cierre": _num(df["Tiempo_Dias_Cierre"].median()),
        "tasa_efectividad": _num(cerradas / total * 100 if total else 0),
        "tasa_resolucion": _num(tasa_resolucion),
        "cerradas": cerradas,
        "canceladas": canceladas,
        "anuladas": anuladas,
        "referencias": referencias,
        "contrarreferencias": contrarref,
        "pct_referencias": _num(referencias / total * 100 if total else 0),
        "edad_promedio": _num(pd.to_numeric(df["Edad"], errors="coerce").mean()),
        "periodo": periodo,
        "actualizado": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    escribir_json("resumen", resumen)


def generar_series_temporales(df: pd.DataFrame) -> None:
    """Serie mensual de remisiones, desglosada por tipo y por régimen."""
    tmp = df.dropna(subset=["Fecha_Diligenciamiento_Solicitud"]).copy()
    tmp["mes"] = tmp["Fecha_Diligenciamiento_Solicitud"].dt.strftime("%Y-%m")
    tmp["mes_label"] = tmp["Fecha_Diligenciamiento_Solicitud"].dt.month.map(
        lambda m: MESES_ES[m][:3]
    )

    # Serie general + tipos
    base = (
        tmp.groupby("mes")
        .agg(
            remisiones=("mes", "size"),
            mes_label=("mes_label", "first"),
        )
        .reset_index()
    )
    piv_tipo = (
        tmp.groupby(["mes", "tipo_solicitud"]).size().unstack(fill_value=0)
    )
    # Normaliza los nombres de columna a claves JS-friendly.
    for tipo in piv_tipo.columns:
        norm = _sin_tildes(tipo)
        if "CONTRA" in norm:
            clave = "contrarreferencias"
        elif norm.startswith("REFERENCIA"):
            clave = "referencias"
        else:
            clave = norm.lower().replace(" ", "_").replace("-", "_")
        base[clave] = base.get(clave, 0) + base["mes"].map(piv_tipo[tipo])

    serie = base.sort_values("mes").to_dict("records")
    serie = [{k: _num(v) for k, v in fila.items()} for fila in serie]
    escribir_json("serie_temporal", serie)

    # Serie por régimen
    piv_reg = (
        tmp.groupby(["mes", "Regimen"]).size().unstack(fill_value=0).reset_index()
    )
    piv_reg["mes_label"] = piv_reg["mes"].map(
        base.set_index("mes")["mes_label"]
    )
    registros = [
        {k: _num(v) for k, v in fila.items()}
        for fila in piv_reg.sort_values("mes").to_dict("records")
    ]
    escribir_json("serie_regimen", registros)


def generar_distribuciones(df: pd.DataFrame) -> None:
    """Distribuciones categóricas para gráficos de dona / barras."""

    def _dist(col: str) -> list[dict]:
        vc = df[col].value_counts()
        return [
            {"name": str(k), "value": _num(v)}
            for k, v in vc.items()
            if str(k) not in ("nan", "<NA>", "")
        ]

    escribir_json("distribucion_tipo", _dist("tipo_solicitud"))
    escribir_json("distribucion_regimen", _dist("Regimen"))
    escribir_json("distribucion_estado", _dist("Estado_Evento"))

    # Triage: la fuente trae 1.0 .. 5.0 como texto; se etiqueta legible.
    triage = pd.to_numeric(df["triage"], errors="coerce").dropna().astype(int)
    vc_triage = triage.value_counts().sort_index()
    escribir_json(
        "distribucion_triage",
        [
            {"name": f"Triage {k}", "value": _num(v)}
            for k, v in vc_triage.items()
            if 1 <= k <= 5
        ],
    )

    nivel = (
        pd.to_numeric(df["Nivel_Complejidad_Prestador"], errors="coerce")
        .dropna()
        .astype(int)
        .value_counts()
        .sort_index()
    )
    escribir_json(
        "distribucion_complejidad",
        [{"nivel": f"Nivel {k}", "value": _num(v)} for k, v in nivel.items()],
    )

    # Grupos de edad
    edades = pd.to_numeric(df["Edad"], errors="coerce").dropna()
    cortes = [0, 1, 5, 12, 18, 30, 45, 60, 75, 200]
    etiquetas = [
        "<1",
        "1–4",
        "5–11",
        "12–17",
        "18–29",
        "30–44",
        "45–59",
        "60–74",
        "75+",
    ]
    grupos = pd.cut(edades, bins=cortes, labels=etiquetas, right=False)
    vc_edad = grupos.value_counts().reindex(etiquetas, fill_value=0)
    escribir_json(
        "distribucion_edad",
        [{"grupo": str(k), "value": _num(v)} for k, v in vc_edad.items()],
    )


def generar_geografico(df: pd.DataFrame) -> None:
    """Rankings de sedes, regiones y matriz de flujo entre regiones."""
    top_origen = df["Desc_Sede_Prestador"].value_counts().head(TOP_SEDES)
    escribir_json(
        "top_sedes_origen",
        [
            {"sede": _titulo(k), "remisiones": _num(v)}
            for k, v in top_origen.items()
        ],
    )

    top_destino = df["Desc_Sede_Destino"].value_counts().head(TOP_SEDES)
    escribir_json(
        "top_sedes_destino",
        [
            {"sede": _titulo(k), "remisiones": _num(v)}
            for k, v in top_destino.items()
        ],
    )

    reg_origen = df["Region_Prestador"].value_counts()
    escribir_json(
        "regiones_origen",
        [
            {"region": _titulo(k), "remisiones": _num(v)}
            for k, v in reg_origen.items()
            if str(k) not in ("nan", "<NA>", "")
        ],
    )
    reg_destino = df["Region_Destino"].value_counts()
    escribir_json(
        "regiones_destino",
        [
            {"region": _titulo(k), "remisiones": _num(v)}
            for k, v in reg_destino.items()
            if str(k) not in ("nan", "<NA>", "")
        ],
    )

    # Matriz origen -> destino (regiones con más volumen)
    top_regiones = (
        df["Region_Prestador"].value_counts().head(10).index.tolist()
    )
    sub = df[
        df["Region_Prestador"].isin(top_regiones)
        & df["Region_Destino"].isin(top_regiones)
    ]
    matriz = pd.crosstab(sub["Region_Prestador"], sub["Region_Destino"])
    filas = []
    for origen in matriz.index:
        for destino in matriz.columns:
            filas.append(
                {
                    "origen": _titulo(origen),
                    "destino": _titulo(destino),
                    "value": _num(matriz.loc[origen, destino]),
                }
            )
    escribir_json(
        "matriz_flujo_regiones",
        {"regiones": [_titulo(r) for r in top_regiones], "celdas": filas},
    )


def generar_diagnosticos_servicios(df: pd.DataFrame) -> None:
    """Top diagnósticos principales y servicios solicitados."""
    diag = df["Nombre_Diagnostico_Principal"].value_counts().head(TOP_DIAGNOSTICOS)
    escribir_json(
        "top_diagnosticos",
        [
            {"nombre": _titulo(str(k)), "count": _num(v)}
            for k, v in diag.items()
            if str(k) not in ("nan", "<NA>", "")
        ],
    )

    serv = df["Servicio_Solicita"].value_counts().head(TOP_SERVICIOS)
    escribir_json(
        "top_servicios",
        [
            {"nombre": _titulo(str(k)), "count": _num(v)}
            for k, v in serv.items()
            if str(k) not in ("nan", "<NA>", "")
        ],
    )


def generar_tiempos_cierre(df: pd.DataFrame) -> None:
    """Histograma y estadísticos del tiempo de cierre en días."""
    dias = df["Tiempo_Dias_Cierre"].dropna()
    dias = dias[(dias >= 0) & (dias <= 60)]  # recorta outliers para el histograma
    cortes = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30, 61]
    etiquetas = [
        "<1 día",
        "1 día",
        "2 días",
        "3–4",
        "5–6",
        "7–9",
        "10–14",
        "15–19",
        "20–29",
        "30+",
    ]
    binned = pd.cut(dias, bins=cortes, labels=etiquetas, right=False)
    vc = binned.value_counts().reindex(etiquetas, fill_value=0)
    hist = [{"rango": str(k), "value": _num(v)} for k, v in vc.items()]

    todos = df["Tiempo_Dias_Cierre"].dropna()
    stats = {
        "media": _num(todos.mean()),
        "mediana": _num(todos.median()),
        "p25": _num(todos.quantile(0.25)),
        "p75": _num(todos.quantile(0.75)),
        "p90": _num(todos.quantile(0.90)),
        "max": _num(todos.max()),
    }
    escribir_json("tiempos_cierre", {"histograma": hist, "estadisticos": stats})


def generar_movilidad_niveles(df: pd.DataFrame) -> None:
    """Movilidad del paciente entre niveles de complejidad y tasa de resolución.

    Para cada tipo de solicitud (referencia / contrarreferencia) se cruza el
    nivel de complejidad del prestador de origen con el del destino y se
    clasifica el movimiento:

    - ``sube``  : el paciente se deriva a un nivel de MAYOR complejidad
                  (escalada asistencial — el caso típico de una referencia).
    - ``igual`` : se resuelve en el mismo nivel (interconsulta u apoyo lateral).
    - ``baja``  : retorna a un nivel de MENOR complejidad para seguimiento
                  (el caso típico de una contrarreferencia).

    Todo agregado: solo conteos, promedios y tasas — sin PII.
    """
    d = df.copy()
    d["o"] = pd.to_numeric(d["Nivel_Complejidad_Prestador"], errors="coerce")
    d["dd"] = pd.to_numeric(d["Nivel_Complejidad_Destino"], errors="coerce")
    d["dias"] = pd.to_numeric(d["Tiempo_Dias_Cierre"], errors="coerce")
    d["cerrada"] = (d["Estado_Evento"].str.lower() == "cerrada").astype(int)
    d["desenlace"] = d["Estado_Evento"].str.lower().isin(["cerrada", "cancelada"])
    d["tipo"] = d["tipo_solicitud"].map(
        lambda t: "contrarreferencia" if "CONTRA" in _sin_tildes(t) else "referencia"
    )

    def _bloque(sub: pd.DataFrame) -> dict:
        total = int(len(sub))
        con_nivel = sub.dropna(subset=["o", "dd"])
        sube = int((con_nivel["dd"] > con_nivel["o"]).sum())
        igual = int((con_nivel["dd"] == con_nivel["o"]).sum())
        baja = int((con_nivel["dd"] < con_nivel["o"]).sum())
        sin_dato = total - len(con_nivel)
        base = len(con_nivel) or 1
        desen = int(sub["desenlace"].sum())
        # Matriz nivel origen (1-3) -> nivel destino (1-4)
        celdas = []
        for no in (1, 2, 3):
            for nd in (1, 2, 3, 4):
                v = int(((con_nivel["o"] == no) & (con_nivel["dd"] == nd)).sum())
                if v:
                    celdas.append({"o": no, "d": nd, "value": v})
        return {
            "total": total,
            "sube": sube,
            "igual": igual,
            "baja": baja,
            "sin_dato": int(sin_dato),
            "pct_sube": _num(sube / base * 100),
            "pct_igual": _num(igual / base * 100),
            "pct_baja": _num(baja / base * 100),
            "dias_promedio": _num(sub["dias"].mean()),
            "tasa_resolucion": _num(
                sub["cerrada"].sum() / desen * 100 if desen else 0
            ),
            "celdas": celdas,
        }

    salida = {
        "referencia": _bloque(d[d["tipo"] == "referencia"]),
        "contrarreferencia": _bloque(d[d["tipo"] == "contrarreferencia"]),
        "niveles_origen": [1, 2, 3],
        "niveles_destino": [1, 2, 3, 4],
        "nota": (
            "El nivel de complejidad del destino no siempre queda registrado; "
            "esas remisiones se cuentan en 'sin_dato' y no entran en los "
            "porcentajes de movilidad."
        ),
    }
    escribir_json("movilidad_niveles", salida)


def generar_conexiones() -> None:
    """Top conexiones sede -> sede desde la matriz OD ya agregada (sin PII)."""
    if not RUTA_MATRIZ_OD.exists():
        log.warning("No se encontró %s — se omite", RUTA_MATRIZ_OD.name)
        return
    df = pd.read_csv(RUTA_MATRIZ_OD, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    for col in ["Desc_Sede_Prestador", "Desc_Sede_Destino"]:
        df[col] = _limpiar_texto(df[col])
    df = df.sort_values("num_remisiones", ascending=False).head(TOP_CONEXIONES)
    escribir_json(
        "top_conexiones",
        [
            {
                "origen": _titulo(r["Desc_Sede_Prestador"]),
                "destino": _titulo(r["Desc_Sede_Destino"]),
                "flujo": _num(r["num_remisiones"]),
            }
            for _, r in df.iterrows()
        ],
    )


def generar_clustering() -> None:
    """Métricas de comparación de clustering (RAD) y redes (RAS) + comunidades."""
    ruta_cmp = DIR_CLUSTERS / "comparacion_metodos.csv"
    if ruta_cmp.exists():
        df = pd.read_csv(ruta_cmp)
        escribir_json(
            "clustering_comparacion",
            [
                {
                    "metodo": str(r["Método"]),
                    "silhouette": _num(r["Silhouette"]),
                    "calinski_harabasz": _num(r["Calinski-Harabasz"]),
                    "davies_bouldin": _num(r["Davies-Bouldin"]),
                }
                for _, r in df.iterrows()
            ],
        )

    ruta_ras = DIR_CLUSTERS / "comparacion_algoritmos_ras.csv"
    if ruta_ras.exists():
        df = pd.read_csv(ruta_ras)
        escribir_json(
            "ras_comparacion",
            [
                {
                    "algoritmo": str(r["Algoritmo"]),
                    "num_comunidades": _num(r["Num Comunidades"]),
                    "modularidad": _num(r["Modularidad"]),
                    "tam_promedio": _num(r["Tamaño Promedio"]),
                    "tam_min": _num(r["Tamaño Min"]),
                    "tam_max": _num(r["Tamaño Max"]),
                }
                for _, r in df.iterrows()
            ],
        )

    # Distribución de tamaños de comunidad (Louvain, el de mejor modularidad
    # con número de comunidades manejable)
    ruta_louvain = DIR_CLUSTERS / "comunidades_louvain.csv"
    if ruta_louvain.exists():
        df = pd.read_csv(ruta_louvain)
        tam = df.groupby("comunidad").size().sort_values(ascending=False)
        escribir_json(
            "comunidades_louvain",
            [
                {"comunidad": f"C{int(k)}", "sedes": _num(v)}
                for k, v in tam.items()
            ],
        )

    # Caracterización ZAID (zonas integradas RAD + RAS)
    ruta_zaid = DIR_CLUSTERS / "zaid_voting_caracterizacion.csv"
    if ruta_zaid.exists():
        df = pd.read_csv(ruta_zaid)
        df = df.sort_values("Num_Sedes", ascending=False)
        escribir_json(
            "zaid_caracterizacion",
            [
                {
                    "zaid": f"ZAID {int(r['ZAID'])}",
                    "num_sedes": _num(r["Num_Sedes"]),
                    "cluster_principal": _num(r["Cluster_Principal"]),
                    "comunidad_principal": _num(r["Comunidad_Principal"]),
                }
                for _, r in df.iterrows()
            ],
        )

        ruta_coh = DIR_CLUSTERS / "zaid_voting_coherencia.csv"
        coherencia = {}
        if ruta_coh.exists():
            coh = pd.read_csv(ruta_coh)
            coherencia = {
                c: _num(coh.iloc[0][c]) for c in coh.columns
            }
        total_sedes = int(df["Num_Sedes"].sum())
        escribir_json(
            "zaid_resumen",
            {
                "num_zaid": int(len(df)),
                "total_sedes": total_sedes,
                "sedes_zona_mayor": _num(df["Num_Sedes"].max()),
                "promedio_sedes": _num(df["Num_Sedes"].mean()),
                "coherencia": coherencia,
            },
        )


def generar_clustering_perfil() -> None:
    """Perfil operativo de cada clúster RAD (para explicar qué representan).

    Usa ``clusters_kmeans_reduced.csv`` — el método con mejor Silhouette — que
    ya trae, por sede, las variables de comportamiento en la red (volumen,
    complejidad, cobertura, oportunidad, centralidad...). Se promedian por
    clúster y se deriva una etiqueta de arquetipo legible.
    """
    ruta = DIR_CLUSTERS / "clusters_kmeans_reduced.csv"
    if not ruta.exists():
        log.warning("No se encontró %s — se omite el perfil de clústeres", ruta.name)
        return
    df = pd.read_csv(ruta)
    if "cluster" not in df.columns:
        return

    n_total = len(df)
    filas = []
    for cid, g in df.groupby("cluster"):
        origen = float(g["total_remisiones_origen"].mean())
        destino = float(g["total_remisiones_destino"].mean())
        nivel = float(g["nivel_complejidad_promedio"].mean())
        dias = float(g["tiempo_promedio_cierre"].mean())
        efect = float(g["tasa_remisiones_efectivas"].mean()) * 100
        cobertura = float(g["cobertura_municipal"].mean())
        pagerank = float(g["pagerank"].mean())
        intermediacion = float(g["centralidad_intermediacion"].mean())
        subsidiado = float(g["proporcion_regimen_subsidiado"].mean()) * 100
        urgencias = float(g["tasa_urgencias"].mean()) * 100
        filas.append(
            {
                "cluster": int(cid),
                "sedes": int(len(g)),
                "pct_sedes": _num(len(g) / n_total * 100),
                "remisiones_origen_prom": _num(origen),
                "remisiones_destino_prom": _num(destino),
                "nivel_complejidad_prom": _num(nivel),
                "dias_cierre_prom": _num(dias),
                "tasa_efectivas_prom": _num(efect),
                "cobertura_municipal_prom": _num(cobertura),
                "pagerank_prom": _num(round(pagerank, 4)),
                "intermediacion_prom": _num(round(intermediacion, 4)),
                "pct_subsidiado_prom": _num(subsidiado),
                "tasa_urgencias_prom": _num(urgencias),
            }
        )

    # --- Etiquetas de arquetipo (reglas sobre los promedios del clúster) ---
    max_dest = max(f["remisiones_destino_prom"] or 0 for f in filas) or 1
    max_inter = max(f["intermediacion_prom"] or 0 for f in filas) or 1
    for f in filas:
        orig = f["remisiones_origen_prom"] or 0
        dest = f["remisiones_destino_prom"] or 0
        nivel = f["nivel_complejidad_prom"] or 0
        efect = f["tasa_efectivas_prom"] or 0
        dest_norm = dest / max_dest
        inter_norm = (f["intermediacion_prom"] or 0) / max_inter
        if dest_norm > 0.6 and nivel >= 1.8:
            etiqueta = "Hubs receptores de alta complejidad"
            rasgo = (
                "Reciben mucho más de lo que emiten y concentran la mayor "
                "complejidad y centralidad de la red: su saturación se "
                "propaga a todo el circuito."
            )
        elif inter_norm > 0.5:
            etiqueta = "Sedes puente"
            rasgo = (
                "Alta intermediación: enlazan subredes que de otro modo "
                "quedarían separadas; su caída fragmentaría el circuito."
            )
        elif (orig + dest) < 8:
            etiqueta = "Sedes periféricas / actividad puntual"
            rasgo = (
                "Muy pocas remisiones en el período: vínculos débiles con el "
                "resto de la red y baja dependencia mutua."
            )
        elif dest / (orig + 1) > 2.5 and efect < 35:
            etiqueta = "Receptores con baja tasa de cierre"
            rasgo = (
                "Reciben pacientes pero cierran una fracción baja de los "
                "eventos: foco de revisión de registro y de resolución."
            )
        elif (orig + dest) > 200 and orig > dest:
            etiqueta = "Nodos emisores de alto volumen"
            rasgo = (
                "Emiten muchísimas más remisiones de las que reciben y cubren "
                "varios municipios: son los grandes puntos de entrada a la red."
            )
        elif (orig + dest) > 60:
            etiqueta = "Nodos de alto tráfico bidireccional"
            rasgo = (
                "Emiten y reciben en volúmenes altos: sostienen buena parte "
                "del intercambio de la red con complejidad media."
            )
        elif orig / (dest + 1) > 1.5 and nivel < 1.7:
            etiqueta = "Emisores de baja complejidad"
            rasgo = (
                "Sobre todo derivan pacientes hacia niveles superiores; poca "
                "capacidad resolutiva local — típicas de zonas rurales."
            )
        else:
            etiqueta = "Sedes de mediana complejidad"
            rasgo = (
                "Perfil mixto: resuelven parte de la demanda y derivan el "
                "resto; oportunidad de cierre intermedia."
            )
        f["etiqueta"] = etiqueta
        f["rasgo"] = rasgo

    filas.sort(key=lambda x: x["sedes"], reverse=True)
    escribir_json(
        "clustering_perfil",
        {
            "metodo": "K-Means + PCA (kmeans_reduced)",
            "num_sedes": n_total,
            "num_clusters": len(filas),
            "clusters": filas,
        },
    )


def generar_zonas_caracterizacion(df: pd.DataFrame) -> None:
    """Detalle de cada ZAID y de cada comunidad RAS: qué sedes la componen,
    en qué municipios / subregiones están y cuál es su perfil operativo
    promedio. Sirve para responder «¿qué sedes hay aquí y qué las
    caracteriza?» en las vistas Zonas·ZAID y Redes·RAS.

    Cruza por nombre de sede (normalizado):
      - ``zaid_voting.csv``            -> sede -> zaid / cluster / comunidad
      - ``clusters_kmeans_reduced.csv`` -> sede -> variables de comportamiento
      - ``comunidades_louvain.csv``    -> sede -> comunidad RAS
      - remisiones                     -> sede -> municipio / subregión
    Sobrescribe ``zaid_caracterizacion.json`` y ``comunidades_louvain.json``
    con una versión enriquecida (mantiene las claves que ya consumían las
    vistas).
    """
    ruta_zv = DIR_CLUSTERS / "zaid_voting.csv"
    ruta_km = DIR_CLUSTERS / "clusters_kmeans_reduced.csv"
    ruta_lou = DIR_CLUSTERS / "comunidades_louvain.csv"
    if not (ruta_zv.exists() and ruta_km.exists()):
        log.warning(
            "Falta zaid_voting/clusters_kmeans_reduced — se omite la "
            "caracterización de zonas"
        )
        return

    km = pd.read_csv(ruta_km)
    km["k"] = km["sede"].map(_sin_tildes)

    # --- sede (normalizada) -> municipio / subregión / nombre legible ---
    izq = df[
        ["Desc_Sede_Prestador", "Municipio_Prestador", "Region_Prestador"]
    ].rename(
        columns={
            "Desc_Sede_Prestador": "sede",
            "Municipio_Prestador": "muni",
            "Region_Prestador": "region",
        }
    )
    der = df[
        ["Desc_Sede_Destino", "Municipio_Destino", "Region_Destino"]
    ].rename(
        columns={
            "Desc_Sede_Destino": "sede",
            "Municipio_Destino": "muni",
            "Region_Destino": "region",
        }
    )
    sm = pd.concat([izq, der]).dropna(subset=["sede"])
    sm["k"] = sm["sede"].map(_sin_tildes)

    def _moda(serie: pd.Series):
        vc = serie.dropna()
        return vc.value_counts().index[0] if len(vc) else None

    modo_muni = sm.groupby("k")["muni"].agg(lambda s: _titulo(_moda(s) or ""))
    modo_reg = sm.groupby("k")["region"].agg(lambda s: _titulo(_moda(s) or ""))
    nombre_sede = sm.groupby("k")["sede"].agg(lambda s: _titulo(_moda(s) or ""))

    perfil = km.set_index("k").copy()
    kser = perfil.index.to_series()
    perfil["municipio"] = kser.map(modo_muni).replace("", np.nan)
    perfil["region"] = kser.map(modo_reg).replace("", np.nan)
    perfil["sede_bonito"] = (
        kser.map(nombre_sede).replace("", np.nan).fillna(perfil["sede"].map(_titulo))
    )
    perfil = perfil.reset_index()
    # Para cruzar sin chocar columnas con zaid_voting / louvain (que traen sus
    # propias 'cluster' / 'comunidad' / 'metodo' / 'sede').
    perfil_m = perfil.drop(columns=["sede", "cluster", "metodo"], errors="ignore")

    def _agg_perfil(g: pd.DataFrame) -> dict:
        regs = g["region"].dropna()
        munis = g["municipio"].dropna()
        return {
            "num_sedes": int(len(g)),
            "sedes_ubicadas": int(munis.shape[0]),
            "num_municipios": int(munis.nunique()),
            "municipios": [m for m, _ in munis.value_counts().head(6).items()],
            "regiones": [r for r, _ in regs.value_counts().head(5).items()],
            "region_dominante": (
                regs.value_counts().index[0]
                if len(regs)
                else (munis.value_counts().index[0] if len(munis) else "—")
            ),
            "origen_prom": _num(g["total_remisiones_origen"].mean()),
            "destino_prom": _num(g["total_remisiones_destino"].mean()),
            "total_origen": _num(g["total_remisiones_origen"].sum()),
            "nivel_prom": _num(g["nivel_complejidad_promedio"].mean()),
            "dias_prom": _num(g["tiempo_promedio_cierre"].mean()),
            "efect_prom": _num(g["tasa_remisiones_efectivas"].mean() * 100),
            "pct_subsidiado": _num(g["proporcion_regimen_subsidiado"].mean() * 100),
        }

    N_SEDES_LISTA = 14

    # --- ZAID ---
    zv = pd.read_csv(ruta_zv)
    zv["k"] = zv["sede"].map(_sin_tildes)
    jz = zv.merge(perfil_m, on="k", how="left")
    zaids_out = []
    for zid, g in jz.groupby("zaid"):
        gs = g.sort_values("total_remisiones_origen", ascending=False)
        info = _agg_perfil(g)
        zaids_out.append(
            {
                "zaid": f"ZAID {int(zid)}",
                "cluster_principal": int(g["cluster"].value_counts().index[0]),
                "comunidad_principal": int(g["comunidad"].value_counts().index[0]),
                "sedes_lista": gs["sede_bonito"].head(N_SEDES_LISTA).tolist(),
                "sedes_restantes": max(0, int(len(g)) - N_SEDES_LISTA),
                **info,
            }
        )
    zaids_out.sort(key=lambda z: z["num_sedes"], reverse=True)
    escribir_json("zaid_caracterizacion", zaids_out)

    # --- Comunidades RAS (Louvain) ---
    if ruta_lou.exists():
        lou = pd.read_csv(ruta_lou)
        lou["k"] = lou["sede"].map(_sin_tildes)
        jl = lou.merge(perfil_m, on="k", how="left")
        com_out = []
        for cid, g in jl.groupby("comunidad"):
            gs = g.sort_values("total_remisiones_origen", ascending=False)
            info = _agg_perfil(g)
            com_out.append(
                {
                    "comunidad": f"C{int(cid)}",
                    "id": int(cid),
                    "sedes": info["num_sedes"],
                    "sedes_lista": gs["sede_bonito"].head(N_SEDES_LISTA).tolist(),
                    "sedes_restantes": max(0, info["num_sedes"] - N_SEDES_LISTA),
                    **info,
                }
            )
        com_out.sort(key=lambda c: c["sedes"], reverse=True)
        escribir_json("comunidades_louvain", com_out)


def _centroides_municipios() -> pd.DataFrame:
    """Centroide (lon/lat) por código DANE de municipio a partir de geo_merge.

    Se usan las coordenadas ya geolocalizadas de las direcciones de afiliados
    (columnas ``latitud_x`` / ``longitud_x``), promediadas por municipio. El
    resultado es un punto representativo por municipio — NO contiene ninguna
    dirección ni dato individual.
    """
    if not RUTA_GEO_MERGE.exists():
        log.warning("No se encontró %s — mapa sin coordenadas", RUTA_GEO_MERGE.name)
        return pd.DataFrame(columns=["cod", "lon", "lat"])

    g = pd.read_csv(
        RUTA_GEO_MERGE,
        usecols=["cod_munic", "latitud_x", "longitud_x"],
        low_memory=False,
    ).dropna(subset=["latitud_x", "longitud_x"])
    cent = (
        g.groupby("cod_munic")
        .agg(lon=("longitud_x", "median"), lat=("latitud_x", "median"))
        .reset_index()
        .rename(columns={"cod_munic": "cod"})
    )
    # Filtra puntos fuera del rango de Antioquia (limpieza defensiva)
    cent = cent[
        cent["lon"].between(-77.5, -73.5) & cent["lat"].between(5.0, 9.0)
    ]
    return cent


def _comunidad_por_municipio(df: pd.DataFrame) -> tuple[dict, list]:
    """Comunidad RAS (Louvain) dominante en cada municipio.

    ``comunidades_louvain.csv`` asigna una comunidad a cada SEDE. Aquí se ubica
    cada sede en su municipio (moda del municipio prestador/destino con ese
    nombre de sede) y se toma la comunidad más frecuente por municipio, para
    poder colorear el mapa por circuito de remisión y no solo por subregión.

    Devuelve ``({municipio_normalizado: comunidad_id}, [info_por_comunidad])``.
    """
    ruta = DIR_CLUSTERS / "comunidades_louvain.csv"
    if not ruta.exists():
        return {}, []
    lou = pd.read_csv(ruta)
    lou["k"] = lou["sede"].map(_sin_tildes)

    izq = df[["Desc_Sede_Prestador", "Municipio_Prestador", "Region_Prestador"]].rename(
        columns={
            "Desc_Sede_Prestador": "sede",
            "Municipio_Prestador": "muni",
            "Region_Prestador": "region",
        }
    )
    der = df[["Desc_Sede_Destino", "Municipio_Destino", "Region_Destino"]].rename(
        columns={
            "Desc_Sede_Destino": "sede",
            "Municipio_Destino": "muni",
            "Region_Destino": "region",
        }
    )
    sm = pd.concat([izq, der]).dropna(subset=["sede", "muni"])
    sm["k"] = sm["sede"].map(_sin_tildes)
    sm["mk"] = sm["muni"].map(_sin_tildes)
    modo_muni = sm.groupby("k")["mk"].agg(
        lambda s: s.value_counts().index[0] if len(s) else None
    )
    lou["mk"] = lou["k"].map(modo_muni)
    lou = lou.dropna(subset=["mk"])

    dom = lou.groupby("mk")["comunidad"].agg(
        lambda s: int(s.value_counts().index[0])
    )
    muni_comunidad = {k: int(v) for k, v in dom.items()}

    # Info por comunidad: nº de sedes y municipios que abarca
    reg_por_mk = (
        sm.dropna(subset=["region"])
        .groupby("mk")["region"]
        .agg(lambda s: _titulo(s.value_counts().index[0]) if len(s) else "—")
    )
    info = []
    for cid, grp in lou.groupby("comunidad"):
        munis = sorted(set(grp["mk"]))
        regiones = sorted({reg_por_mk.get(m, "—") for m in munis} - {"—"})
        info.append(
            {
                "id": int(cid),
                "sedes": int(len(grp)),
                "municipios": int(len(munis)),
                "regiones": regiones[:4],
            }
        )
    info.sort(key=lambda x: x["sedes"], reverse=True)
    return muni_comunidad, info


def _resolver_centroides(df: pd.DataFrame) -> tuple[dict, dict]:
    """Devuelve ``(cent_por_nombre, info_por_nombre)`` para el cruce del mapa.

    Cruza el código DANE del prestador (que sí viene limpio) con los centroides
    de ``geo_merge`` y produce:
      - ``cent_por_nombre[clave] = (lon, lat)``
      - ``info_por_nombre[clave] = (nombre_bonito, region)``
    donde ``clave`` es el nombre del municipio normalizado sin tildes.
    """
    cent = _centroides_municipios()
    if cent.empty:
        return {}, {}

    meta = df[
        ["Codigo_Dane_Prestador", "Municipio_Prestador", "Region_Prestador"]
    ].dropna(subset=["Codigo_Dane_Prestador"]).copy()
    meta["Codigo_Dane_Prestador"] = pd.to_numeric(
        meta["Codigo_Dane_Prestador"], errors="coerce"
    )
    meta = meta.dropna(subset=["Codigo_Dane_Prestador"])
    meta["Codigo_Dane_Prestador"] = meta["Codigo_Dane_Prestador"].astype(int)
    dane_nombre, dane_region = {}, {}
    for _, r in meta.drop_duplicates(subset=["Codigo_Dane_Prestador"]).iterrows():
        dane_nombre[int(r["Codigo_Dane_Prestador"])] = str(
            r["Municipio_Prestador"]
        ).strip()
        dane_region[int(r["Codigo_Dane_Prestador"])] = _titulo(
            str(r["Region_Prestador"])
        )

    cent_por_nombre, info_por_nombre = {}, {}
    for _, r in cent.iterrows():
        cod = int(r["cod"])
        nom = dane_nombre.get(cod)
        if not nom:
            continue
        clave = _sin_tildes(nom)
        cent_por_nombre[clave] = (float(r["lon"]), float(r["lat"]))
        info_por_nombre[clave] = (_titulo(nom), dane_region.get(cod, "—"))
    return cent_por_nombre, info_por_nombre


# Coordenadas aproximadas (lon, lat) de lugares fuera de Antioquia que aparecen
# como origen o destino de remisiones. Sirven solo para situar un marcador en el
# borde del mapa; no son un dato clínico.
LUGARES_EXT = {
    "MONTERIA": (-75.88, 8.75),
    "CORDOBA": (-75.88, 8.75),
    "MONTELIBANO": (-75.42, 7.98),
    "LA DORADA": (-74.66, 5.45),
    "CALDAS(DPTO)": (-75.51, 5.24),
    "MANIZALES": (-75.51, 5.07),
    "BARRANCABERMEJA": (-73.85, 7.06),
    "BUCARAMANGA": (-73.12, 7.12),
    "PIEDECUESTA": (-73.05, 6.99),
    "SANTANDER": (-73.30, 6.90),
    "BOGOTA": (-74.08, 4.65),
    "BOGOTA D.C.": (-74.08, 4.65),
    "CUNDINAMARCA": (-74.20, 4.90),
    "PUERTO BOYACA": (-74.59, 5.98),
    "BOYACA": (-73.40, 5.60),
    "CUCUTA": (-72.51, 7.90),
    "NORTE DE SANTANDER": (-72.70, 8.00),
    "QUIBDO": (-76.65, 5.69),
    "CHOCO": (-76.90, 5.90),
    "CALI": (-76.53, 3.44),
    "VALLE DEL CAUCA": (-76.30, 3.80),
    "PEREIRA": (-75.69, 4.81),
    "RISARALDA": (-75.85, 5.10),
    "IBAGUE": (-75.23, 4.44),
    "TOLIMA": (-75.10, 4.20),
    "CARTAGENA": (-75.51, 10.42),
    "BOLIVAR": (-74.50, 9.20),
    "BARRANQUILLA": (-74.80, 10.98),
    "ATLANTICO": (-74.90, 10.70),
    "SINCELEJO": (-75.40, 9.30),
    "SUCRE": (-75.10, 9.20),
    "VALLEDUPAR": (-73.25, 10.46),
    "CESAR": (-73.60, 9.50),
    "RIOHACHA": (-72.91, 11.54),
    "LA GUAJIRA": (-72.60, 11.20),
    "VILLAVICENCIO": (-73.63, 4.14),
    "META": (-73.20, 3.80),
    "NEIVA": (-75.28, 2.93),
    "HUILA": (-75.60, 2.50),
    "SANTA MARTA": (-74.20, 11.24),
    "MAGDALENA": (-74.40, 10.20),
}


def _lugar_ext(nombre: str) -> tuple[float, float] | None:
    """Coordenada aproximada para un municipio/departamento fuera de Antioquia."""
    return LUGARES_EXT.get(_sin_tildes(nombre))


def _calcular_externos(
    df: pd.DataFrame, cent_por_nombre: dict, info_por_nombre: dict
) -> dict:
    """Remisiones que cruzan la frontera del departamento (origen o destino).

    ``Departamento_Destino`` viene 100 % vacío en la fuente, así que el destino
    fuera de Antioquia se detecta porque su ``Municipio_Destino`` no figura entre
    los municipios prestadores del departamento. El origen fuera se toma de
    ``Departamento_Prestador``.
    """
    total = len(df)
    ant_muni = set(cent_por_nombre.keys())

    def _bonito(clave):
        if not clave:
            return None
        return info_por_nombre.get(clave, (str(clave).title(), None))[0]

    dd_norm = df["Municipio_Destino"].map(_sin_tildes)
    mask_dest_ext = (dd_norm != "") & (~dd_norm.isin(ant_muni))
    sal = df[mask_dest_ext]
    destinos = []
    for nom, sub in sal.groupby("Municipio_Destino"):
        coord = _lugar_ext(str(nom))
        if not coord:
            continue
        # principal municipio de Antioquia que alimenta esa salida
        oa = sub["Municipio_Prestador"].map(_sin_tildes)
        oa = oa[oa.isin(ant_muni)]
        origen_ant = oa.value_counts().index[0] if len(oa) else None
        destinos.append(
            {
                "nombre": _titulo(str(nom)),
                "lon": coord[0],
                "lat": coord[1],
                "valor": int(len(sub)),
                "ancla": _bonito(origen_ant),
            }
        )
    destinos.sort(key=lambda x: x["valor"], reverse=True)

    dep_o = df["Departamento_Prestador"].fillna("").map(
        lambda s: _sin_tildes(s)
    )
    mask_orig_ext = (dep_o != "") & (dep_o != "ANTIOQUIA")
    ent = df[mask_orig_ext]
    origenes = []
    for dep, sub in ent.groupby("Departamento_Prestador"):
        coord = _lugar_ext(str(dep))
        if not coord:
            continue
        da = sub["Municipio_Destino"].map(_sin_tildes)
        da = da[da.isin(ant_muni)]
        destino_ant = da.value_counts().index[0] if len(da) else None
        origenes.append(
            {
                "nombre": _titulo(str(dep)),
                "lon": coord[0],
                "lat": coord[1],
                "valor": int(len(sub)),
                "ancla": _bonito(destino_ant),
            }
        )
    origenes.sort(key=lambda x: x["valor"], reverse=True)

    return {
        "total_salidas": int(mask_dest_ext.sum()),
        "total_entradas": int(mask_orig_ext.sum()),
        "pct_salidas": _num(int(mask_dest_ext.sum()) / total * 100 if total else 0),
        "pct_entradas": _num(int(mask_orig_ext.sum()) / total * 100 if total else 0),
        "destinos": destinos[:9],
        "origenes": origenes[:9],
    }


def generar_mapa(df: pd.DataFrame) -> None:
    """Mapa de red: municipios como nodos y flujos de remisión como arcos.

    El código DANE de destino viene vacío en la fuente, así que el cruce con las
    coordenadas se hace por NOMBRE de municipio (normalizado sin tildes). Además
    de los totales, cada nodo y cada flujo llevan una serie mensual ``serie``
    para que el dashboard pueda filtrar por período sin recargar datos, y cada
    nodo lleva la comunidad RAS (``comunidad``) a la que pertenece su municipio.
    """
    cent_por_nombre, info_por_nombre = _resolver_centroides(df)
    if not cent_por_nombre:
        return

    muni_comunidad, comunidades_info = _comunidad_por_municipio(df)

    d = df.dropna(subset=["Municipio_Prestador", "Municipio_Destino"]).copy()
    d["o"] = d["Municipio_Prestador"].map(_sin_tildes)
    d["dd"] = d["Municipio_Destino"].map(_sin_tildes)
    d = d[(d["o"] != "") & (d["dd"] != "")]
    d["mes"] = d["Fecha_Diligenciamiento_Solicitud"].dt.strftime("%Y-%m")

    meses = sorted(m for m in d["mes"].dropna().unique().tolist())
    mes_idx = {m: i for i, m in enumerate(meses)}

    # --- Nodos: volumen de origen y destino por municipio ---
    vol_o = d.groupby("o").size()
    vol_d = d.groupby("dd").size()
    serie_o = d.dropna(subset=["mes"]).groupby(["o", "mes"]).size()
    serie_d = d.dropna(subset=["mes"]).groupby(["dd", "mes"]).size()
    claves = sorted(set(vol_o.index) | set(vol_d.index))
    nodos = []
    for c in claves:
        if c not in cent_por_nombre:
            continue
        lon, lat = cent_por_nombre[c]
        nombre, region = info_por_nombre.get(c, (c.title(), "—"))
        # serie mensual [idxMes, origen, destino] solo con meses con actividad
        s_o = serie_o[c].to_dict() if c in serie_o.index.get_level_values(0) else {}
        s_d = serie_d[c].to_dict() if c in serie_d.index.get_level_values(0) else {}
        serie = [
            [mes_idx[m], int(s_o.get(m, 0)), int(s_d.get(m, 0))]
            for m in meses
            if s_o.get(m, 0) or s_d.get(m, 0)
        ]
        nodos.append(
            {
                "nombre": nombre,
                "region": region,
                "comunidad": muni_comunidad.get(c),
                "lon": round(lon, 5),
                "lat": round(lat, 5),
                "origen": int(vol_o.get(c, 0)),
                "destino": int(vol_d.get(c, 0)),
                "serie": serie,
            }
        )

    # --- Flujos entre municipios distintos ---
    inter = d[d["o"] != d["dd"]]
    flujos_g = (
        inter.groupby(["o", "dd"]).size().reset_index(name="valor")
        .sort_values("valor", ascending=False)
    )
    serie_f = inter.dropna(subset=["mes"]).groupby(["o", "dd", "mes"]).size()
    flujos = []
    for _, r in flujos_g.iterrows():
        o, dd = r["o"], r["dd"]
        if o not in cent_por_nombre or dd not in cent_por_nombre:
            continue
        if r["valor"] < 12:  # descarta ruido
            continue
        olon, olat = cent_por_nombre[o]
        dlon, dlat = cent_por_nombre[dd]
        try:
            s_f = serie_f[(o, dd)].to_dict()
        except KeyError:
            s_f = {}
        serie = [
            [mes_idx[m], int(v)] for m, v in sorted(s_f.items()) if m in mes_idx
        ]
        flujos.append(
            {
                "o": info_por_nombre[o][0],
                "d": info_por_nombre[dd][0],
                "region_o": info_por_nombre[o][1],
                "olon": round(olon, 5),
                "olat": round(olat, 5),
                "dlon": round(dlon, 5),
                "dlat": round(dlat, 5),
                "valor": int(r["valor"]),
                "serie": serie,
            }
        )
        if len(flujos) >= 180:
            break

    if not nodos:
        log.warning("Mapa: sin nodos con coordenadas — se omite")
        return

    lons = [n["lon"] for n in nodos]
    lats = [n["lat"] for n in nodos]
    bbox = {
        "minLon": min(lons),
        "maxLon": max(lons),
        "minLat": min(lats),
        "maxLat": max(lats),
    }
    intra = int((d["o"] == d["dd"]).sum())
    escribir_json(
        "mapa_red",
        {
            "meses": meses,
            "nodos": nodos,
            "flujos": flujos,
            "comunidades": comunidades_info,
            "externos": _calcular_externos(df, cent_por_nombre, info_por_nombre),
            "bbox": bbox,
            "resumen": {
                "municipios": len(nodos),
                "flujos_intermunicipales": int(len(inter)),
                "remisiones_mismo_municipio": intra,
                "pct_intermunicipal": _num(len(inter) / len(d) * 100 if len(d) else 0),
                "num_comunidades": len(comunidades_info),
            },
        },
        compacto=True,
    )


def generar_flujo_diagnosticos(df: pd.DataFrame) -> None:
    """Ruta y flujo de remisión de los principales diagnósticos.

    Para cada diagnóstico principal más frecuente se calculan:
      - los flujos de remisión entre municipios (dibujan la ruta en el mapa),
      - las rutas sede -> sede más intensas (tabla),
      - la matriz entre subregiones,
      - indicadores (edad, días de cierre, % que sale de su subregión, mezcla
        referencia / contrarreferencia).
    Todo agregado — sin PII.
    """
    cent_por_nombre, info_por_nombre = _resolver_centroides(df)
    if not cent_por_nombre:
        return

    d = df.dropna(
        subset=[
            "Municipio_Prestador",
            "Municipio_Destino",
            "Nombre_Diagnostico_Principal",
        ]
    ).copy()
    d["diag"] = d["Nombre_Diagnostico_Principal"].map(lambda s: _titulo(str(s)))
    d = d[~d["diag"].isin(["", "Nan", "<Na>", "None"])]
    d["o"] = d["Municipio_Prestador"].map(_sin_tildes)
    d["dd"] = d["Municipio_Destino"].map(_sin_tildes)
    d = d[(d["o"] != "") & (d["dd"] != "")]
    d["dias"] = pd.to_numeric(d["Tiempo_Dias_Cierre"], errors="coerce")
    d["edad"] = pd.to_numeric(d["Edad"], errors="coerce")
    d["es_contra"] = d["tipo_solicitud"].map(
        lambda t: "CONTRA" in _sin_tildes(t)
    )
    d["cerrada"] = d["Estado_Evento"].str.lower() == "cerrada"

    TOP_DIAG = 12
    top = d["diag"].value_counts().head(TOP_DIAG).index.tolist()
    sub_all = d[d["diag"].isin(top)]

    # Lista compartida de municipios con coordenadas (para el mini-mapa)
    usados = {
        c
        for c in set(sub_all["o"]) | set(sub_all["dd"])
        if c in cent_por_nombre
    }
    municipios, m_idx = [], {}
    for c in sorted(usados):
        lon, lat = cent_por_nombre[c]
        nombre, region = info_por_nombre.get(c, (c.title(), "—"))
        m_idx[c] = len(municipios)
        municipios.append(
            {
                "nombre": nombre,
                "region": region,
                "lon": round(lon, 5),
                "lat": round(lat, 5),
            }
        )

    por_diag, diag_meta = {}, []
    for dg in top:
        sub = d[d["diag"] == dg]
        total = int(len(sub))
        inter = sub[sub["o"] != sub["dd"]]

        fg = (
            inter.groupby(["o", "dd"])
            .size()
            .reset_index(name="v")
            .sort_values("v", ascending=False)
        )
        flujos = []
        for _, r in fg.iterrows():
            o, dd = r["o"], r["dd"]
            if o not in m_idx or dd not in m_idx or r["v"] < 2:
                continue
            flujos.append([m_idx[o], m_idx[dd], int(r["v"])])
            if len(flujos) >= 60:
                break

        rg = (
            sub.groupby(["Desc_Sede_Prestador", "Desc_Sede_Destino"])
            .size()
            .reset_index(name="v")
            .sort_values("v", ascending=False)
            .head(10)
        )
        rutas = [
            {
                "origen": _titulo(str(r["Desc_Sede_Prestador"])),
                "destino": _titulo(str(r["Desc_Sede_Destino"])),
                "valor": int(r["v"]),
            }
            for _, r in rg.iterrows()
        ]

        rr = sub.dropna(subset=["Region_Prestador", "Region_Destino"])
        rr_o = rr["Region_Prestador"].map(_titulo)
        rr_d = rr["Region_Destino"].map(_titulo)
        mat = pd.crosstab(rr_o, rr_d)
        celdas_region = [
            {"o": oo, "d": ddd, "v": int(mat.loc[oo, ddd])}
            for oo in mat.index
            for ddd in mat.columns
            if int(mat.loc[oo, ddd])
        ]
        pct_fuera = _num(
            (rr_o.values != rr_d.values).mean() * 100 if len(rr) else 0
        )

        por_diag[dg] = {
            "total": total,
            "intermunicipal": int(len(inter)),
            "pct_intermunicipal": _num(
                len(inter) / total * 100 if total else 0
            ),
            "pct_fuera_subregion": pct_fuera,
            "edad_promedio": _num(sub["edad"].mean()),
            "dias_promedio": _num(sub["dias"].mean()),
            "tasa_cierre": _num(sub["cerrada"].mean() * 100),
            "pct_contrarreferencia": _num(sub["es_contra"].mean() * 100),
            "flujos": flujos,
            "rutas": rutas,
            "celdas_region": celdas_region,
        }
        diag_meta.append({"nombre": dg, "total": total})

    diag_meta.sort(key=lambda x: x["total"], reverse=True)
    escribir_json(
        "flujo_diagnosticos",
        {
            "municipios": municipios,
            "diagnosticos": diag_meta,
            "por_diagnostico": por_diag,
        },
        compacto=True,
    )


def generar_dendrograma(df: pd.DataFrame) -> None:
    """Dendrograma jerárquico (Ward) de las principales sedes por su perfil de flujo.

    Cada sede se describe por su vector de remisiones enviadas y recibidas frente
    al resto de sedes del top. Se agrupa con enlace de Ward y se exporta el árbol
    como JSON anidado para renderizarlo en el dashboard.
    """
    try:
        from scipy.cluster.hierarchy import linkage, to_tree
        from scipy.spatial.distance import pdist
    except ImportError:
        log.warning("scipy no disponible — se omite el dendrograma")
        return

    d = df[["Desc_Sede_Prestador", "Desc_Sede_Destino"]].dropna().copy()
    top = (
        pd.concat([d["Desc_Sede_Prestador"], d["Desc_Sede_Destino"]])
        .value_counts()
        .head(45)
        .index.tolist()
    )
    d = d[
        d["Desc_Sede_Prestador"].isin(top) & d["Desc_Sede_Destino"].isin(top)
    ]
    envia = pd.crosstab(d["Desc_Sede_Prestador"], d["Desc_Sede_Destino"]).reindex(
        index=top, columns=top, fill_value=0
    )
    recibe = envia.T
    feat = pd.concat([envia, recibe], axis=1).fillna(0)
    # Normaliza por fila para comparar perfiles, no volúmenes absolutos
    feat = feat.div(feat.sum(axis=1).replace(0, 1), axis=0)

    X = feat.values
    Z = linkage(pdist(X, metric="euclidean"), method="ward")
    etiquetas = [_titulo(s) for s in feat.index.tolist()]

    from scipy.cluster.hierarchy import fcluster

    k = 6
    asign = fcluster(Z, t=k, criterion="maxclust")
    cluster_por_hoja = {i: int(asign[i]) for i in range(len(etiquetas))}

    arbol = to_tree(Z)
    altura_max = float(arbol.dist) or 1.0

    def _nodo(n):
        if n.is_leaf():
            return {
                "nombre": etiquetas[n.id],
                "altura": 0.0,
                "cluster": cluster_por_hoja[n.id],
            }
        hijos = [_nodo(n.left), _nodo(n.right)]
        clusters_hijos = {c for h in hijos for c in _clusters_de(h)}
        return {
            "nombre": "",
            "altura": round(float(n.dist) / altura_max, 4),
            "cluster": clusters_hijos.pop() if len(clusters_hijos) == 1 else 0,
            "children": hijos,
        }

    def _clusters_de(nodo):
        if "children" not in nodo:
            return {nodo["cluster"]}
        return {c for h in nodo["children"] for c in _clusters_de(h)}

    escribir_json(
        "dendrograma",
        {
            "arbol": _nodo(arbol),
            "num_hojas": len(etiquetas),
            "k": k,
            "metodo": "ward · distancia euclídea sobre perfil de flujo normalizado",
        },
    )


def _columnar(g: pd.DataFrame, dims_cols: list[str]) -> tuple[list[str], list[list]]:
    """Convierte un groupby agregado en {campos, filas} columnar y compacto."""
    campos = dims_cols + ["n", "cerradas", "dias_sum", "dias_cnt"]
    filas = [
        [r[c] for c in dims_cols]
        + [
            int(r["n"]),
            int(r["cerradas"]),
            int(round(float(r["dias_sum"]))),
            int(r["dias_cnt"]),
        ]
        for _, r in g.iterrows()
    ]
    return campos, filas


def generar_hechos(df: pd.DataFrame) -> None:
    """Dos tablas de hechos agregadas para los filtros del dashboard (sin PII).

    - ``hechos.json``      : mes × subregión × régimen × tipo × nivel.
    - ``hechos_muni.json`` : mes × municipio (para el filtro de municipio; al
      usarlo, el desglose por régimen, tipo y complejidad no aplica — solo
      volumen y oportunidad de cierre).

    Se separan para que ambos archivos queden pequeños. El cliente elige uno u
    otro según si hay municipios seleccionados.
    """
    d = df.dropna(subset=["Fecha_Diligenciamiento_Solicitud"]).copy()
    d["mes"] = d["Fecha_Diligenciamiento_Solicitud"].dt.strftime("%Y-%m")
    d["region"] = (
        d["Region_Prestador"].map(_titulo).replace("", pd.NA).fillna("Sin región")
    )
    d["municipio"] = (
        d["Municipio_Prestador"]
        .map(lambda x: _titulo(str(x)))
        .replace("", pd.NA)
        .fillna("Sin dato")
    )
    d["regimen"] = d["Regimen"].fillna("—")
    d["tipo"] = d["tipo_solicitud"].map(
        lambda t: "Contrarreferencia" if "CONTRA" in _sin_tildes(t) else "Referencia"
    )
    d["nivel"] = (
        pd.to_numeric(d["Nivel_Complejidad_Prestador"], errors="coerce")
        .fillna(0)
        .astype(int)
        .clip(0, 4)
    )
    d["cerrada"] = (d["Estado_Evento"].str.lower() == "cerrada").astype(int)
    d["dias"] = pd.to_numeric(d["Tiempo_Dias_Cierre"], errors="coerce")

    agg_kw = dict(
        n=("mes", "size"),
        cerradas=("cerrada", "sum"),
        dias_sum=("dias", "sum"),
        dias_cnt=("dias", "count"),
    )

    # Municipios por subregión (para el filtro en cascada del dashboard)
    muni_por_region: dict[str, list[str]] = {}
    for reg, sub in d.groupby("region"):
        muni_por_region[reg] = sorted(
            m for m in sub["municipio"].unique().tolist() if m != "Sin dato"
        )

    dims = {
        "meses": sorted(d["mes"].unique().tolist()),
        "regiones": sorted(d["region"].unique().tolist()),
        "municipios": sorted(
            m for m in d["municipio"].unique().tolist() if m != "Sin dato"
        ),
        "municipios_por_region": muni_por_region,
        "regimenes": sorted(d["regimen"].unique().tolist()),
        "tipos": sorted(d["tipo"].unique().tolist()),
        "niveles": sorted(int(x) for x in d["nivel"].unique().tolist()),
    }

    # Tabla principal (sin municipio)
    g1 = (
        d.groupby(["mes", "region", "regimen", "tipo", "nivel"])
        .agg(**agg_kw)
        .reset_index()
    )
    campos1, filas1 = _columnar(g1, ["mes", "region", "regimen", "tipo", "nivel"])
    escribir_json(
        "hechos", {"dims": dims, "campos": campos1, "filas": filas1}, compacto=True
    )

    # Tabla por municipio (grano mínimo para que el archivo sea pequeño)
    g2 = (
        d[d["municipio"] != "Sin dato"]
        .groupby(["mes", "municipio"])
        .agg(**agg_kw)
        .reset_index()
    )
    campos2, filas2 = _columnar(g2, ["mes", "municipio"])
    # La región de cada municipio se repone en el cliente a partir de
    # dims.municipios_por_region (ya viene en hechos.json).
    escribir_json(
        "hechos_muni", {"campos": campos2, "filas": filas2}, compacto=True
    )


# --- Orquestación ---
def main() -> None:
    log.info("=" * 60)
    log.info("Preparando datos del dashboard (salida: %s)", DIR_SALIDA)
    log.info("=" * 60)

    df = cargar_remisiones()

    log.info("Generando resumen / KPIs ...")
    generar_resumen(df)

    log.info("Generando series temporales ...")
    generar_series_temporales(df)

    log.info("Generando distribuciones ...")
    generar_distribuciones(df)

    log.info("Generando análisis geográfico ...")
    generar_geografico(df)

    log.info("Generando diagnósticos y servicios ...")
    generar_diagnosticos_servicios(df)

    log.info("Generando tiempos de cierre ...")
    generar_tiempos_cierre(df)

    log.info("Generando movilidad entre niveles de atención ...")
    generar_movilidad_niveles(df)

    log.info("Generando top de conexiones (matriz OD) ...")
    generar_conexiones()

    log.info("Generando clustering / redes / ZAID ...")
    generar_clustering()

    log.info("Generando perfil de clústeres RAD ...")
    generar_clustering_perfil()

    log.info("Generando caracterización de zonas ZAID y comunidades RAS ...")
    generar_zonas_caracterizacion(df)

    log.info("Generando mapa de red (municipios + flujos) ...")
    generar_mapa(df)

    log.info("Generando flujo de remisión por diagnóstico ...")
    generar_flujo_diagnosticos(df)

    log.info("Generando dendrograma jerárquico ...")
    generar_dendrograma(df)

    log.info("Generando tabla de hechos para filtros ...")
    generar_hechos(df)

    # Índice de archivos generados
    archivos = sorted(p.name for p in DIR_SALIDA.glob("*.json") if p.name != "_index.json")
    escribir_json(
        "_index",
        {
            "generado": datetime.now().isoformat(timespec="seconds"),
            "archivos": archivos,
            "nota": "Datos agregados y anonimizados. No contienen PII de afiliados.",
        },
    )

    log.info("=" * 60)
    log.info("Listo. %d archivos JSON en %s", len(archivos) + 1, DIR_SALIDA)
    log.info("=" * 60)


if __name__ == "__main__":
    main()
