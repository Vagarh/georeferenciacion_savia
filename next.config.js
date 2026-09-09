/** @type {import('next').NextConfig} */
// Configuración de Next.js para el dashboard geoespacial de Savia Salud.
// El despliegue en Vercel es por Git: Vercel construye la app con `next build`
// y la sirve de forma nativa. Todo el contenido es client-side y los datos se
// leen de /public/data, así que las páginas quedan estáticas (SSG) sin
// funciones serverless. En local se usa `next dev` / `next build`.
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
