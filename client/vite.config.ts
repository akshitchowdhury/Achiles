import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Override with GO_SERVER=http://localhost:8081 to point the dev proxy at a
// second backend instance without editing this file.
const GO_SERVER = process.env.GO_SERVER ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Go server (HTTP_PORT in server/go_be_skeleton/.env). Keeps the browser
      // same-origin so CORS never enters the picture during development.
      '/api': {
        target: GO_SERVER,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),

        /**
         * DEV SHIM — remove once the server is fixed.
         *
         * GET /getBMI runs json.Decode on the request body and 400s on EOF, so
         * it only answers when a GET carries a body. Browsers refuse to send
         * one (XHR and fetch both strip bodies from GET/HEAD per spec), which
         * makes the endpoint unreachable from client code.
         *
         * This proxy hop runs in Node, which has no such restriction, so we
         * attach an empty JSON object on the way through. `{}` decodes cleanly
         * and overwrites nothing — the handler keeps the values it already
         * scanned out of Postgres.
         *
         * The real fix is server-side: drop the Decode call from GetBMI_BMR,
         * or make the route a POST.
         */
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const isGetBmi = req.method === 'GET' && (req.url ?? '').includes('/getBMI')
            if (!isGetBmi) return

            const body = '{}'
            proxyReq.setHeader('Content-Type', 'application/json')
            proxyReq.setHeader('Content-Length', Buffer.byteLength(body))
            proxyReq.write(body)
          })
        },
      },
    },
  },
})
