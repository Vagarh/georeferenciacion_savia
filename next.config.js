/** @type {import('next').NextConfig} */
// Configuración de Next.js para el dashboard geoespacial de Savia Salud.
// `output: "export"` genera un sitio 100 % estático en `out/`: todo el
// contenido es client-side y los datos se leen de /public/data, así que no hay
// funciones serverless. Esto además evita el fallo de symlinks de `vc build`
// en Windows y hace el despliegue a Vercel un simple subir de archivos.
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
