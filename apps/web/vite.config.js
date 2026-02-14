import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Temporary: base /landing/ so root (/) can serve Zoom app until Zoom prod home URL is approved. See docs/TEMPORARY_ROUTING.md.
const base = process.env.VITE_BASE_PATH ?? '/landing/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3001,
    open: true
  }
})
