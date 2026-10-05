/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F2C59',
          'navy-dark': '#081830',
          'navy-light': '#1B3C73',
          green: '#10B981',
          'green-dark': '#059669',
          'green-light': '#34D399',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
        }
      }
    },
  },
  plugins: [],
}
