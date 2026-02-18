import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH ?? '/landing/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3001,
    open: true
  }
})
