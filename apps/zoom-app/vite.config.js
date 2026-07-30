import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins = [
    react(),
  ]

  if (process.env.ANALYZE) {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(visualizer({ open: true, filename: 'stats.html', gzipSize: true }))
  }

  return {
    base: '/zoom/',
    plugins,
    // The .env files live at the repo root, as in apps/web. Without this the
    // zoom build gets no VITE_* values at all, which silently disables PostHog.
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3000,
      open: true
    }
  }
})
