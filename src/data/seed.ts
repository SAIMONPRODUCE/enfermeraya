import type { ServiceCatalog } from '../types'

export const CENTER = { lat: 4.711, lng: -74.0721 }

export const CATALOGO: ServiceCatalog[] = [
  { id: 'inyect', nombre: 'Inyectología', precio_base: 35000, precio_min: 25000, precio_max: 56000, descripcion: 'Aplicación de inyecciones IM, IV o subcutáneas con fórmula médica.', icon: 'syringe', duracion: '20 min' },
  { id: 'cura', nombre: 'Curaciones', precio_base: 55000, precio_min: 39000, precio_max: 88000, descripcion: 'Curación de heridas, retiro de puntos y manejo de apósitos.', icon: 'bandage', duracion: '30 min' },
  { id: 'posop', nombre: 'Postoperatorio', precio_base: 90000, precio_min: 63000, precio_max: 144000, descripcion: 'Cuidado y vigilancia tras una cirugía, control de signos y medicación.', icon: 'heart', duracion: '1 h' },
  { id: 'adulto', nombre: 'Adulto mayor', precio_base: 120000, precio_min: 84000, precio_max: 192000, descripcion: 'Acompañamiento profesional, higiene, movilidad y medicación.', icon: 'users', duracion: '2 h' },
  { id: 'muestras', nombre: 'Toma de muestras', precio_base: 45000, precio_min: 32000, precio_max: 72000, descripcion: 'Toma de sangre y otras muestras en casa, con envío al laboratorio.', icon: 'flask', duracion: '20 min', activo: false },
  { id: 'suero', nombre: 'Terapia IV', precio_base: 110000, precio_min: 77000, precio_max: 176000, descripcion: 'Sueroterapia y administración de medicamentos endovenosos.', icon: 'droplet', duracion: '1 h' },
]

/** Lo que hoy se puede pedir. CATALOGO completo sigue sirviendo para el historial. */
export const OFERTA = CATALOGO.filter((c) => c.activo !== false)
