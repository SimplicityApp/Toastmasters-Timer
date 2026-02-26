import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const base = process.env.VITE_BASE_PATH ?? '/'

// In dev, serve /zoom/* files from zoom-app/public so video etc. work without
// running the zoom-app dev server. In production combine:dist handles this.
function serveZoomPublic() {
  const zoomPublic = path.resolve(__dirname, '../zoom-app/public')
  return {
    name: 'serve-zoom-public',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/zoom/')) return next()
        const filePath = path.join(zoomPublic, req.url.replace('/zoom/', ''))
        if (fs.existsSync(filePath)) {
          return res.writeHead(200).end(fs.readFileSync(filePath))
        }
        next()
      })
    }
  }
}

export default defineConfig({
  base,
  plugins: [react(), serveZoomPublic()],
  server: {
    port: 3001,
    open: true
  }
})
