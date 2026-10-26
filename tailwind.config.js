/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        parchment: {
          50: 'rgb(var(--color-parchment-50) / <alpha-value>)',
          100: 'rgb(var(--color-parchment-100) / <alpha-value>)',
          200: 'rgb(var(--color-parchment-200) / <alpha-value>)',
          300: 'rgb(var(--color-parchment-300) / <alpha-value>)',
          400: 'rgb(var(--color-parchment-400) / <alpha-value>)',
          500: 'rgb(var(--color-parchment-500) / <alpha-value>)',
          600: 'rgb(var(--color-parchment-600) / <alpha-value>)',
          700: 'rgb(var(--color-parchment-700) / <alpha-value>)',
          800: 'rgb(var(--color-parchment-800) / <alpha-value>)',
          900: 'rgb(var(--color-parchment-900) / <alpha-value>)',
        },
        nocturne: {
          950: 'rgb(var(--color-nocturne-950) / <alpha-value>)',
          900: 'rgb(var(--color-nocturne-900) / <alpha-value>)',
          850: 'rgb(var(--color-nocturne-850) / <alpha-value>)',
          800: 'rgb(var(--color-nocturne-800) / <alpha-value>)',
          750: 'rgb(var(--color-nocturne-750) / <alpha-value>)',
          700: 'rgb(var(--color-nocturne-700) / <alpha-value>)',
          600: 'rgb(var(--color-nocturne-600) / <alpha-value>)',
          500: 'rgb(var(--color-nocturne-500) / <alpha-value>)',
        },
        zinc: {
          50: 'rgb(var(--color-zinc-50, 250 250 250) / <alpha-value>)',
          100: 'rgb(var(--color-zinc-100) / <alpha-value>)',
          200: 'rgb(var(--color-zinc-200) / <alpha-value>)',
          300: 'rgb(var(--color-zinc-300) / <alpha-value>)',
          400: 'rgb(var(--color-zinc-400) / <alpha-value>)',
          500: 'rgb(var(--color-zinc-500) / <alpha-value>)',
          600: 'rgb(var(--color-zinc-600) / <alpha-value>)',
          700: 'rgb(var(--color-zinc-700) / <alpha-value>)',
          800: 'rgb(var(--color-zinc-800) / <alpha-value>)',
          900: 'rgb(var(--color-zinc-900) / <alpha-value>)',
          950: 'rgb(var(--color-zinc-950) / <alpha-value>)',
        },
        sacred: {
          gold: 'rgb(var(--color-sacred-gold) / <alpha-value>)',
          'gold-light': 'rgb(var(--color-sacred-gold-light) / <alpha-value>)',
          'gold-dark': 'rgb(var(--color-sacred-gold-dark) / <alpha-value>)',
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
