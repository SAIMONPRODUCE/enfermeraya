// Ejecuta src/store/*.test.ts con node:test. Usa el transformador de Vite (ya es dependencia)
// para resolver imports TS sin extensión; no añade dependencias nuevas.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
})

try {
  await server.ssrLoadModule('/src/store/sim.test.ts')
} finally {
  await server.close()
}
