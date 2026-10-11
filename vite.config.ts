import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages sirve el repo en /enfermeraya/; en local sigue en /
declare const process: { env: Record<string, string | undefined> }
const base = process.env.GITHUB_ACTIONS ? '/enfermeraya/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
