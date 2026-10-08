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
      // same-origin so CORS never enters the picture during development —
      // the same job client/vercel.json's rewrite does in production.
      //
      // The /getBMI and /docgeneration shims that used to live here are gone:
      // both handlers now accept what a browser can actually send.
      '/api': {
        target: GO_SERVER,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
