import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const base = process.env.VITE_BASE_PATH ?? '/'

// In dev, rewrite clean URLs to .html files (mirrors Vercel rewrites).
function serveContentPages() {
  const webPublic = path.resolve(__dirname, 'public')
  const zoomPublic = path.resolve(__dirname, '../zoom-app/public')
  // Mirror the rewrites from vercel.json
  const rewriteMap = {
    '/privacy': path.join(zoomPublic, 'privacy.html'),
    '/support': path.join(zoomPublic, 'support.html'),
    '/terms-of-use': path.join(zoomPublic, 'terms-of-use.html'),
    '/documentation': path.join(zoomPublic, 'documentation.html'),
  }
  return {
    name: 'serve-content-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0]
        if (url.includes('.') || url === '/') return next()
        // Check explicit rewrite map first (legal pages from zoom-app)
        const mapped = rewriteMap[url]
        if (mapped && fs.existsSync(mapped)) {
          res.setHeader('Content-Type', 'text/html')
          return res.writeHead(200).end(fs.readFileSync(mapped))
        }
        // Then check web public dir for content pages
        const htmlPath = path.join(webPublic, url + '.html')
        if (fs.existsSync(htmlPath)) {
          res.setHeader('Content-Type', 'text/html')
          return res.writeHead(200).end(fs.readFileSync(htmlPath))
        }
        next()
      })
    }
  }
}

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

export default defineConfig(async () => {
  const plugins = [
    react(),
    serveContentPages(),
    serveZoomPublic(),
  ]

  if (process.env.ANALYZE) {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(visualizer({ open: true, filename: 'stats.html', gzipSize: true }))
  }

  return {
    base,
    plugins,
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3001,
      open: true
    }
  }
})
