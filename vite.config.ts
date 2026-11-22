import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages sirve el repo en /enfermeraya/; en local sigue en /
declare const process: { env: Record<string, string | undefined> }
const base = process.env.GITHUB_ACTIONS ? '/enfermeraya/' : '/'

// Tres apps: clientes (index.html), profesionales (profesional/) y administración (admin/).
// En desarrollo, /profesional/<ruta> y /admin/<ruta> sirven el index de su app (en producción lo hace 404.html).
const apps: Plugin = {
  name: 'apps-fallback',
  configureServer(server) {
    server.middlewares.use((req: { url?: string }, _res, next) => {
      const m = req.url?.match(/^\/(profesional|admin)(\/[^.?]*)?(\?.*)?$/)
      if (m) req.url = `/${m[1]}/index.html`
      next()
    })
  },
}

export default defineConfig({
  base,
  plugins: [apps, react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', profesional: 'profesional/index.html', admin: 'admin/index.html' },
    },
  },
})
