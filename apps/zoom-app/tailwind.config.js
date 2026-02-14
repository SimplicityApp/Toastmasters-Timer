/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'timer-green': '#10b981',
        'timer-yellow': '#f59e0b',
        'timer-red': '#ef4444',
      },
    },
  },
  plugins: [],
}
