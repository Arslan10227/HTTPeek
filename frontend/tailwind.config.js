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
        background: {
          DEFAULT: '#0f172a', // Slate 900
          darker: '#090d16',
          card: '#1e293b',   // Slate 800
          hover: '#334155',  // Slate 700
          border: '#334155',
        },
        brand: {
          50: '#ecfdf5',
          500: '#10b981', // Emerald
          600: '#059669',
        },
        method: {
          get: '#38bdf8',    // Sky blue
          post: '#4ade80',   // Emerald green
          put: '#fbbf24',    // Amber
          delete: '#f87171', // Red
          patch: '#c084fc',  // Purple
          head: '#94a3b8',   // Slate
          options: '#a78bfa',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
