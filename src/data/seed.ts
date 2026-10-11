import type { AppState, NurseDetail, ServiceCatalog, User } from '../types'

export const CENTER = { lat: 4.711, lng: -74.0721 }

export const CATALOGO: ServiceCatalog[] = [
  { id: 'inyect', nombre: 'Inyectología', precio_base: 35000, descripcion: 'Aplicación de inyecciones IM, IV o subcutáneas con fórmula médica.', icon: 'syringe', duracion: '20 min' },
  { id: 'cura', nombre: 'Curaciones', precio_base: 55000, descripcion: 'Curación de heridas, retiro de puntos y manejo de apósitos.', icon: 'bandage', duracion: '30 min' },
  { id: 'posop', nombre: 'Postoperatorio', precio_base: 90000, descripcion: 'Cuidado y vigilancia tras una cirugía, control de signos y medicación.', icon: 'heart', duracion: '1 h' },
  { id: 'adulto', nombre: 'Adulto mayor', precio_base: 120000, descripcion: 'Acompañamiento profesional, higiene, movilidad y medicación.', icon: 'users', duracion: '2 h' },
  { id: 'muestras', nombre: 'Toma de muestras', precio_base: 45000, descripcion: 'Toma de sangre y otras muestras en casa, con envío al laboratorio.', icon: 'flask', duracion: '20 min' },
  { id: 'suero', nombre: 'Terapia IV', precio_base: 110000, descripcion: 'Sueroterapia y administración de medicamentos endovenosos.', icon: 'droplet', duracion: '1 h' },
]

const user = (
  id: string,
  rol: User['rol'],
  nombre: string,
  lat: number,
  lng: number,
  calificacion: number,
  color: string,
  direccion = '',
): User => ({
  id,
  rol,
  nombre,
  email: `${nombre.split(' ')[0].toLowerCase()}@demo.co`,
  telefono: '+57 300 ' + Math.floor(1000000 + Math.random() * 8999999),
  ubicacion: { lat, lng },
  direccion,
  calificacion,
  color,
})

const nurse = (
  id: string,
  especialidad: string,
  servicios: number,
  experiencia: number,
  bio: string,
  online = true,
  estado: NurseDetail['aprobado_por_admin'] = 'aprobado',
  ganancias = 0,
): NurseDetail => ({
  usuario_id: id,
  especialidad,
  documentos_url: ['tarjeta_profesional.pdf', 'diploma_enfermeria.pdf'],
  aprobado_por_admin: estado,
  ganancias,
  online,
  servicios,
  experiencia,
  bio,
})

export function seedState(): AppState {
  return {
    sessionId: null,
    users: [
      user('p1', 'paciente', 'Camila Rojas', 4.7143, -74.0645, 5, '#1d6fe8', 'Cra 15 #93-40, Chapinero'),
      user('a1', 'admin', 'Admin EnfermeraYa', 4.711, -74.0721, 5, '#0f172a'),
      user('n1', 'enfermero', 'Laura Gómez', 4.7185, -74.0592, 4.9, '#0ea5a4'),
      user('n2', 'enfermero', 'Andrés Pardo', 4.6987, -74.0806, 4.8, '#6366f1'),
      user('n3', 'enfermero', 'Marta Quintero', 4.7312, -74.0502, 4.7, '#f59e0b'),
      user('n4', 'enfermero', 'Julián Mora', 4.6722, -74.0538, 4.9, '#ec4899'),
      user('n5', 'enfermero', 'Sofía Beltrán', 4.7542, -74.0905, 4.6, '#10b981'),
      user('n6', 'enfermero', 'Diego Ramírez', 4.6405, -74.1105, 4.8, '#8b5cf6', ),
      user('n7', 'enfermero', 'Valeria Cruz', 4.7002, -74.0456, 5, '#ef4444'),
      user('n8', 'enfermero', 'Esteban Niño', 4.7089, -74.1021, 4.5, '#0284c7'),
    ],
    nurses: {
      n1: nurse('n1', 'Enfermera profesional', 412, 8, 'Especialista en curaciones y cuidado postoperatorio. Trato cálido y puntual.', false, 'aprobado', 1284500),
      n2: nurse('n2', 'Inyectología y terapia IV', 289, 6, 'Experiencia en UCI. Rápido y muy cuidadoso con la técnica.', true, 'aprobado', 843000),
      n3: nurse('n3', 'Cuidado de adulto mayor', 356, 11, 'Acompañamiento paciente y humano para personas mayores.', true, 'aprobado', 2210000),
      n4: nurse('n4', 'Toma de muestras', 198, 4, 'Toma de muestras sin dolor, también en niños.', true, 'aprobado', 530000),
      n5: nurse('n5', 'Postoperatorio', 167, 5, 'Seguimiento postquirúrgico y curaciones complejas.', true, 'aprobado', 412000),
      n6: nurse('n6', 'Enfermero profesional', 90, 3, 'Atención general a domicilio.', true, 'aprobado', 210000),
      n7: nurse('n7', 'Inyectología', 502, 9, 'Más de 500 servicios a domicilio, calificación perfecta.', true, 'aprobado', 1620000),
      n8: nurse('n8', 'Enfermero profesional', 12, 1, 'Recién graduado, con muchas ganas.', false, 'pendiente', 0),
    },
    servicios: [],
    notifs: [],
  }
}
