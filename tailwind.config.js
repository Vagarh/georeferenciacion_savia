/** @type {import('tailwindcss').Config} */
// Sistema de diseño del dashboard — paleta corporativa Savia Salud EPS
// (verde / teal). Inspirado en la estructura del dashboard de referencia
// (Vagarh/Arl_Test) pero con identidad de marca propia.
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Marca Savia Salud */
        savia: {
          green: '#00954C', // primario
          deep: '#00693B', // botones / hover
          forest: '#0B3D2C', // títulos
          teal: '#009CA6', // secundario
          aqua: '#4FC3C7',
          lime: '#8CC63F', // acento
          gold: '#F2A900', // alertas suaves
          mint: '#DBF3E4',
          ice: '#eef9f2',
        },
        brand: {
          dark: '#14201b',
          charcoal: '#26332c',
          muted: '#4a5a52',
          gray1: '#6b7d74',
          gray2: '#c2cec8',
          gray3: '#e2ece7',
          gray4: '#edf4f0',
          surface: '#f7faf8',
          low: '#eef5f1',
          mid: '#e4efe9',
          hi: '#dcece3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      boxShadow: {
        card: '0 20px 40px rgba(11,61,44,0.05)',
        'card-md': '0 8px 24px rgba(11,61,44,0.09)',
        'card-lg': '0 16px 48px rgba(0,105,59,0.14)',
        nav: '0 1px 3px rgba(11,61,44,0.08)',
      },
    },
  },
  plugins: [],
};
