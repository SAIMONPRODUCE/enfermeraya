import type { ServiceCatalog } from '../types'

export const CENTER = { lat: 4.711, lng: -74.0721 }

export const CATALOGO: ServiceCatalog[] = [
  { id: 'inyect', nombre: 'Inyectología', precio_base: 35000, descripcion: 'Aplicación de inyecciones IM, IV o subcutáneas con fórmula médica.', icon: 'syringe', duracion: '20 min' },
  { id: 'cura', nombre: 'Curaciones', precio_base: 55000, descripcion: 'Curación de heridas, retiro de puntos y manejo de apósitos.', icon: 'bandage', duracion: '30 min' },
  { id: 'posop', nombre: 'Postoperatorio', precio_base: 90000, descripcion: 'Cuidado y vigilancia tras una cirugía, control de signos y medicación.', icon: 'heart', duracion: '1 h' },
  { id: 'adulto', nombre: 'Adulto mayor', precio_base: 120000, descripcion: 'Acompañamiento profesional, higiene, movilidad y medicación.', icon: 'users', duracion: '2 h' },
  { id: 'muestras', nombre: 'Toma de muestras', precio_base: 45000, descripcion: 'Toma de sangre y otras muestras en casa, con envío al laboratorio.', icon: 'flask', duracion: '20 min' },
  { id: 'suero', nombre: 'Terapia IV', precio_base: 110000, descripcion: 'Sueroterapia y administración de medicamentos endovenosos.', icon: 'droplet', duracion: '1 h' },
]
