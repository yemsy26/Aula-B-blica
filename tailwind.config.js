/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#ffffff',
          100: '#0f172a',
          200: '#1e293b',
          300: '#334155',
          400: '#64748b',
          500: '#b47b19',
          600: '#92610d',
          700: '#784e08',
          800: '#5e3c05',
          900: '#432a02',
        },
        nocturne: {
          950: '#f8fafc', // Fondo principal celestial claro (Alabastro)
          900: '#ffffff', // Tarjetas, paneles y modales blanco puro
          850: '#f1f5f9', // Contenedores secundarios y hover suaves
          800: '#e2e8f0', // Bordes sutiles claros y divisores
          750: '#cbd5e1', // Bordes medios
          700: '#94a3b8', // Bordes oscuros
          600: '#64748b',
          500: '#475569',
        },
        zinc: {
          50: '#ffffff',
          100: '#0f172a', // Títulos en obsidiana / negro legible
          200: '#1e293b', // Texto principal oscuro de alta legibilidad
          300: '#334155', // Texto secundario
          400: '#64748b', // Texto atenuado / subtítulos
          500: '#94a3b8', // Placeholder
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a', // Negro carbón / máxima legibilidad
          950: '#020617', // Obsidiana profunda
        },
        sacred: {
          gold: '#b47b19',
          'gold-light': '#cf9e38',
          'gold-dark': '#92610d',
          crimson: '#8a2432',
          'crimson-light': '#ab3545',
          bronze: '#9d6736',
          lapis: '#22446a',
          olive: '#475d4b',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
