import type { Role } from '../types'

// Tres apps en el mismo sitio, cada una en su ruta: clientes en la raíz, profesionales en /profesional/
// y administración en /admin/. Cada una solo acepta su tipo de cuenta y guarda su propia sesión.
const ROOT = import.meta.env.BASE_URL // '/' en local, '/enfermeraya/' en GitHub Pages
const SEG: Record<Role, string> = { paciente: '', enfermero: 'profesional/', admin: 'admin/' }

// GitHub Pages no reescribe rutas: 404.html redirige a la app con ?__r=<ruta pedida> y aquí se restaura.
const pedida = new URLSearchParams(location.search).get('__r')
if (pedida?.startsWith(ROOT)) history.replaceState(null, '', pedida + location.hash)

const path = location.pathname
export const APP_ROL: Role = path.startsWith(ROOT + 'admin') ? 'admin' : path.startsWith(ROOT + 'profesional') ? 'enfermero' : 'paciente'
/** Ruta base de esta app, con barra final. */
export const APP_BASE = ROOT + SEG[APP_ROL]
export const appUrl = (r: Role) => location.origin + ROOT + SEG[r]
export const APP_NOMBRE: Record<Role, string> = { paciente: 'clientes', enfermero: 'profesionales', admin: 'administración' }
