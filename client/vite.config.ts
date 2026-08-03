import http from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Override with GO_SERVER=http://localhost:8081 to point the dev proxy at a
// second backend instance without editing this file.
const GO_SERVER = process.env.GO_SERVER ?? 'http://localhost:8080'

/**
 * DEV SHIM — remove once the server is fixed. Same class of bug as the /getBMI
 * hop below, one step worse: ServeDocxHandler rejects anything that isn't GET
 * *and* decodes the plan text out of the request body. A browser can't satisfy
 * both at once, because XHR and fetch strip bodies from GET per spec.
 *
 * So the client POSTs /api/docgeneration, and this middleware — running in
 * Node, which has no such restriction — replays it upstream as a GET carrying
 * the same body, then pipes the .docx (headers included) straight back.
 *
 * It is registered ahead of Vite's proxy so the POST never reaches it.
 *
 * The real fix is server-side: switch the route to POST, then delete this and
 * flip DOC_METHOD in src/api/docs.ts.
 */
function docGenerationShim(): Plugin {
  return {
    name: 'achiles:docgeneration-get-body-shim',
    configureServer(server) {
      server.middlewares.use('/api/docgeneration', (req, res, next) => {
        if (req.method !== 'POST') return next()

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          const upstream = http.request(
            new URL('/docgeneration', GO_SERVER),
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': String(body.byteLength),
              },
            },
            (proxied) => {
              res.statusCode = proxied.statusCode ?? 502
              for (const [name, value] of Object.entries(proxied.headers)) {
                if (value !== undefined) res.setHeader(name, value)
              }
              proxied.pipe(res)
            },
          )

          upstream.on('error', (err) => {
            res.statusCode = 502
            res.end(`Cannot reach the Achiles server: ${err.message}`)
          })
          upstream.end(body)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), docGenerationShim()],
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
