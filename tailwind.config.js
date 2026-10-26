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
          50: '#fdfbf7',
          100: '#f9f6ef',
          200: '#f2ede0',
          300: '#e5dcbe',
          400: '#d5c498',
          500: '#c2ab72',
          600: '#aa9258',
          700: '#8c7644',
          800: '#725f3a',
          900: '#5e4e32',
        },
        nocturne: {
          950: '#090b0d',
          900: '#0f1216',
          850: '#15191f',
          800: '#1b2129',
          750: '#232b35',
          700: '#2d3744',
          600: '#3f4c5e',
          500: '#586980',
        },
        sacred: {
          gold: '#cba358',
          'gold-light': '#dfc384',
          'gold-dark': '#a47c34',
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
