# Dashboard Geoespacial (Next.js) — Savia Salud EPS

Dashboard analítico web del sistema de **referencias y contrarreferencias** de
Savia Salud EPS. Reescritura en Next.js del tablero exploratorio de Streamlit
(`../dashboard_streamlit/`), con foco en calidad visual y despliegue en Vercel.

## 🎯 Objetivo

Ofrecer una vista ejecutiva e interactiva de los flujos de remisión entre sedes
prestadoras de Antioquia, integrando:

| Vista | Contenido |
|---|---|
| **Resumen Ejecutivo** | KPIs, evolución mensual, régimen, top diagnósticos · **con filtros** |
| **Mapa de Red** | Mapa geográfico de Antioquia: municipios como nodos y remisiones como arcos; **zoom y desplazamiento** (rueda + arrastre); **flujo animado** (partículas sobre los arcos); **filtros de subregión / municipio / período** que dejan visibles solo la selección y su vecindario (el resto se oculta) y **auto-encuadran** la vista; **color por subregión o por comunidad RAS**; corredores más intensos |
| **Análisis Geográfico** | Remisiones por región, matriz de flujo interregional, top conexiones sede→sede |
| **Flujo por Diagnóstico** | Para los 12 diagnósticos principales más frecuentes: ruta de remisión origen→destino sobre el mapa, pares de sedes que concentran el diagnóstico, matriz entre subregiones e indicadores (edad, días de cierre, % que sale de su subregión) |
| **Evolución Temporal** | Serie mensual, distribución territorial, oportunidad de cierre · **con filtros** |
| **Flujo entre Niveles** | Movilidad del paciente entre niveles de complejidad (escalada / lateral / retorno) para referencia y contrarreferencia, diagrama de bandas, **tasa de resolución** y desenlace de la gestión |
| **Clustering · RAD** | Explicación del método + comparación de 6 técnicas (Silhouette, Calinski-Harabasz, Davies-Bouldin) + **tarjetas de arquetipo por clúster** (perfil operativo) + **dendrograma jerárquico** (Ward) con línea de corte |
| **Redes · RAS** | **Comunidades de remisión proyectadas sobre el mapa** (con filtros geográficos) + comparación de 4 algoritmos de detección de comunidades (modularidad, tamaños) |
| **Zonas · ZAID** | Zonas de consenso RAD + RAS y coherencia entre particiones |
| **Informe Final** | Resumen narrativo que se **reescribe con los filtros** (período, subregión, municipio, régimen, tipo, complejidad): volumen, distribución territorial, referencia/contrarreferencia, oportunidad, movilidad de niveles, frontera departamental, estructura de la red y focos de gestión derivados de las cifras |

### Filtros

Las vistas *Resumen* y *Evolución Temporal* incluyen una barra de filtros
(período, **subregión** de Antioquia, **municipio** del prestador con buscador y
cascada desde la subregión, régimen, tipo, complejidad) que recalcula KPIs y
series en el navegador. El *Mapa de Red* y *Redes · RAS* usan la misma barra en
modo `soloGeo` (solo período + subregión + municipio). Los datos vienen de dos
tablas de hechos columnares y compactas: `hechos.json`
(`mes × subregión × régimen × tipo × nivel`) y `hechos_muni.json`
(`mes × municipio`); el cliente elige una u otra según si hay municipios
seleccionados. Solo conteos y sumas, sin PII. La agregación cliente vive en
`lib/filtros.tsx`.

### Lectura e insights

Cada vista termina con un panel `PanelInsights` (3 tarjetas) que explica qué
significa lo que se muestra y resalta los hallazgos —parte curados, parte
calculados a partir de los datos cargados—. Los gráficos con lectura menos
obvia llevan además una nota breve «cómo leer esto».

### Mapa de red

`scripts/preparar_datos.py` genera `mapa_red.json` con el centroide de cada
municipio (mediana de las direcciones geolocalizadas de afiliados en
`geo_merge.csv`) y los flujos de remisión entre municipios. Cada nodo y cada
flujo llevan una **serie mensual** para recalcular los volúmenes al filtrar por
período sin recargar datos, y cada nodo lleva la **comunidad RAS** (Louvain) de
su municipio para el modo de color por circuito de remisión. El mapa es SVG puro
con una proyección equirectangular — sin dependencias de mapas ni servidores de
teselas, por lo que funciona igual en local y en Vercel.

El fondo del mapa es la **silueta del departamento de Antioquia**
(`public/data/antioquia.json`, ~7 KB): el contorno departamental de los
*Departamentos de Colombia* (gist `john-guerra/43c7656821069d00dcbc`)
simplificado con `shapely` a ~400 puntos. Es un archivo estático — no lo
regenera `preparar_datos.py` — y la proyección usa su bounding box para que los
municipios caigan en su posición geográfica real dentro del departamento.

Al elegir una subregión o un municipio en la barra de filtros, el mapa deja
visibles solo esos nodos y los municipios conectados a ellos por remisión
(el resto se oculta) y acerca automáticamente la vista a esa zona. También se
puede hacer zoom con la rueda y desplazar arrastrando; el botón de encuadre
restablece la vista.

El selector **«Corredores mostrados»** (arriba del mapa) limita el dibujo a los
_Top 10 / 25 / 50_ corredores más cargados —o a los 20 más livianos— y oculta el
resto de arcos y los municipios que no tocan. El **filtro de período** de la
barra reagrega la serie mensual de cada nodo y flujo (`useMapaPeriodo`), de modo
que acortar el rango de meses recalcula de verdad los volúmenes del mapa, los
KPIs, las listas de corredores y los insights de la vista; el rango activo se
muestra como una etiqueta sobre el mapa.

`flujo_diagnosticos.json` recoge, para los 12 diagnósticos principales más
frecuentes, los flujos de remisión entre municipios, las rutas sede→sede más
intensas y la matriz entre subregiones. La vista *Flujo por Diagnóstico*
reconstruye en el navegador un mapa de red por diagnóstico y lo dibuja con el
mismo componente `MapaRed`.

### Movilidad entre niveles y perfil de clústeres

`movilidad_niveles.json` cruza el nivel de complejidad del prestador de origen
con el del destino (`Nivel_Complejidad_Prestador` × `Nivel_Complejidad_Destino`)
por tipo de solicitud, y calcula la **tasa de resolución** (cerradas sobre las
que llegan a desenlace). `clustering_perfil.json` promedia las ~20 variables de
`clusters_kmeans_reduced.csv` por clúster y deriva una etiqueta de arquetipo
(hubs receptores, emisores de baja complejidad, nodos de alto tráfico, etc.).

## 📁 Estructura

```
dashboard/
├── app/                  # App Router de Next.js (layout, page, estilos globales)
│   ├── globals.css       # Sistema de diseño (Tailwind + tokens Savia Salud)
│   ├── layout.tsx
│   └── page.tsx          # Shell: sidebar + topbar + conmutación de vistas (#hash)
├── components/
│   ├── Sidebar.tsx  TopBar.tsx  Hero.tsx
│   ├── KPICard.tsx  ChartCard.tsx  ChartTooltip.tsx
│   └── views/            # Una vista por archivo (ver tabla anterior)
├── lib/
│   ├── datos.ts          # Tipos, formateadores es-CO, paleta, carga de JSON
│   └── useDatos.ts       # Hook de carga de /public/data/*.json
├── public/data/*.json    # Datos agregados y ANONIMIZADOS (se versionan)
├── scripts/
│   └── preparar_datos.py # Genera public/data/*.json desde los CSV del proyecto
├── tailwind.config.js  next.config.js  tsconfig.json  vercel.json
└── package.json
```

## 🔄 Actualizar los datos y volver a desplegar (runbook)

Procedimiento completo, desde traer meses nuevos de la base de datos hasta que
Vercel publique el dashboard actualizado. Un solo comando (`npm run actualizar`)
recalcula **todo**: extracción → clustering RAD/RAS/ZAID → todos los JSON.

### Paso 0 · Requisitos (una sola vez)

```powershell
# 1. Guardar la contraseña de la BD como variable de entorno (NO va al repo)
setx SAVIA_DB_PASSWORD "tu_contraseña"     # cierra y abre una terminal nueva

# 2. Instalar dependencias de Node y de Python del proyecto padre
cd Analisis_geoespacial\dashboard
npm install
```

### Paso 1 · (Opcional) Ajustar el rango de fechas

El rango de la extracción vive en `..\notebooks\regulaciones.sql`:

```sql
WHERE CAST(AN9.fecha_hora_crea AS DATE) BETWEEN '2025-01-01' AND curdate()
```

`curdate()` trae siempre hasta hoy. Para congelar un corte fijo, cámbialo por una
fecha, p. ej. `'2026-08-31'`.

### Paso 2 · Conectarse a la VPN corporativa

La extracción se conecta a la BD `system_savia`. Sin VPN, el paso 3 falla en la
conexión.

### Paso 3 · Recalcular todo

```powershell
cd Analisis_geoespacial\dashboard
npm run actualizar
```

Equivale a `python scripts\actualizar_todo.py`, que ejecuta en orden y se detiene
si algún paso falla:

| # | Comando | Qué hace | Salida |
|---|---|---|---|
| 1 | `..\notebooks\actualizar_datos.py` | extrae remisiones desde la BD (VPN + `SAVIA_DB_PASSWORD`) | `..\notebooks\resultados_regulaciones.csv` |
| 2 | `..\sistema_cluster\ejecutar_analisis.py --sin-reporte` | recalcula **RAD · RAS · ZAID** sobre el CSV nuevo | `..\sistema_cluster\output\clusters\*.csv` |
| 3 | `scripts\preparar_datos.py` | regenera todos los JSON del dashboard | `public\data\*.json` |

Variantes:

```powershell
npm run actualizar:local          # ya tengo el CSV: salta el paso 1 (no necesita VPN)
python scripts\actualizar_todo.py --saltar-clustering   # no recalcular RAD/RAS/ZAID
python scripts\actualizar_todo.py --saltar-extraccion --saltar-clustering  # solo JSON
```

### Paso 4 · Verificar el build

```powershell
npm run build          # debe terminar en "✓ Compiled successfully"
```

### Paso 5 · Publicar (dispara el despliegue en Vercel)

```powershell
git add -A
git commit -m "data: refrescar hasta <mes>"
git push
```

El `git push` a `master` en `Vagarh/georeferenciacion_savia` dispara
automáticamente el build y el despliegue a producción en Vercel. No hay que
ejecutar nada más; en ~1–2 min la web queda actualizada.

> **Despliegue manual** (sin git): `npm run deploy` (`npx vercel --prod`) tras
> `npx vercel login` la primera vez.

## 🔗 Fuentes de datos

El dashboard **solo** consume los JSON de `public/data/`. Esos JSON se generan
localmente con `scripts/preparar_datos.py` a partir de:

| Fuente | Ruta | Uso |
|---|---|---|
| Remisiones | `../notebooks/resultados_regulaciones.csv` | KPIs, series, distribuciones, geografía, diagnósticos, hechos, dendrograma, movilidad entre niveles |
| Matriz origen-destino | `../datos/procesados/matriz_flujo_od.csv` | Top conexiones sede→sede |
| Geolocalización | `../datos/procesados/geo_merge.csv` | Centroides municipales del mapa de red (solo se leen `cod_munic`, `latitud_x`, `longitud_x`) |
| Clustering / redes / ZAID | `../sistema_cluster/output/clusters/*.csv` | Vistas RAD, RAS y ZAID; `comunidades_louvain.csv` alimenta el color por comunidad del mapa; `clusters_kmeans_reduced.csv` alimenta el perfil de arquetipos |

El logotipo corporativo (`public/logo1.png`, copia de `../logo1.png`) se usa en
la barra lateral y la superior.

> ⚠️ **Cumplimiento (Ley 1581/2012).** `resultados_regulaciones.csv` contiene
> datos personales de afiliados (nombre, documento, dirección, ficha Sisbén).
> **Nunca** se copia a este directorio ni se sube a Vercel. `preparar_datos.py`
> lee solo columnas no sensibles y escribe únicamente conteos y promedios
> agregados. Los JSON de `public/data/` no contienen PII.

## 🧩 Dependencias

- **Node.js** ≥ 18 (probado con 24.x) · **npm** ≥ 9
- Next.js 14 · React 18 · TypeScript 5
- Tailwind CSS 3 · Recharts 2 · lucide-react
- Para regenerar datos: **Python** ≥ 3.9 con `pandas` (usa el entorno del proyecto)

## 🚀 Ejecución local

```bash
cd Analisis_geoespacial/dashboard

# 1. (Opcional) Regenerar los datos agregados desde los CSV del proyecto
python scripts/preparar_datos.py      # o:  npm run datos

# 2. Instalar dependencias (solo la primera vez)
npm install

# 3. Servidor de desarrollo
npm run dev                           # http://localhost:3000

# 4. Verificar el build de producción antes de desplegar
npm run build && npm run start
```

Navegación por vista con hash: `http://localhost:3000/#geografico`,
`#diagnosticos`, `#temporal`, `#niveles`, `#clustering`, `#redes`, `#zaid`.

## ☁️ Despliegue en Vercel

El dashboard vive en un repositorio de GitHub propio
(`Vagarh/georeferenciacion_savia`) — copia de esta carpeta, sin el CSV con PII.
El proyecto de Vercel está **conectado a ese repo por Git**: cada `git push` a
`master` dispara un build (`next build`) y un despliegue a producción. No usa
`output: "export"`; `vercel.json` fija `"framework": "nextjs"` y Vercel sirve la
app de forma nativa (páginas estáticas SSG, sin funciones serverless porque todo
es client-side).

```bash
cd Analisis_geoespacial/dashboard

npm run datos     # regenera public/data/*.json si cambiaron los CSV del proyecto
git add -A && git commit -m "data: actualizar agregados"
git push          # Vercel redespliega solo
```

- **Despliegue manual** (sin pasar por git): `npm run deploy` (`npx vercel --prod`)
  tras `npx vercel login` la primera vez.
- Los `data/*.json` son agregados y anónimos; el CSV con PII nunca entra al repo.
- `vercel.json` solo debe fijar `framework`. **No** añadir `cleanUrls` ni
  `outputDirectory` — rompen el routing de `/`.
- Para regenerar los datos hace falta el proyecto padre (`../notebooks`,
  `../datos/procesados`, `../sistema_cluster`); el repo de GitHub trae los JSON
  ya generados, así que el dashboard corre sin ese paso.

## 🎨 Diseño

Sistema de diseño propio de Savia Salud (verde/teal) definido en
`tailwind.config.js` y `app/globals.css`. La estructura de componentes
(sidebar fijo + topbar + tarjetas + animaciones) se inspira en el tablero de
referencia `Vagarh/Arl_Test/dashboard`; la identidad de marca y todas las
visualizaciones son específicas de este proyecto.

## 👤 Autor y Estado

Autor: **Juan Felipe Cardona Arango** — Analista de Negocio Empresarial,
Coordinación de Analítica y Gestión del Dato, Savia Salud EPS
Creado: 2026-09-09 · Última actualización: 2026-09-10
Estado: **En producción** (desplegado en Vercel · `Vagarh/georeferenciacion_savia`)
