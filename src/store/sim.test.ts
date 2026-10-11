import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversine } from '../lib/geo'
import type { AppState, NurseDetail, Servicio, User } from '../types'
import { availableNurses } from './sim'

// La lógica de despacho, dinero y calificación vive en SQL (supabase/tests/rpc_test.sql).
// Aquí solo queda lo que el cliente calcula para mostrar.

const FROM = { lat: 4.7143, lng: -74.0645 }

const nurse = (id: string, lat: number, d: Partial<NurseDetail> = {}): [User, NurseDetail] => [
  { id, rol: 'enfermero', nombre: id, email: '', telefono: '', ubicacion: { lat, lng: FROM.lng }, direccion: '', calificacion: 5, color: '#000' },
  { usuario_id: id, especialidad: '', documentos_url: [], aprobado_por_admin: 'aprobado', ganancias: 0, online: true, servicios: 0, experiencia: 0, bio: '', ...d },
]

function stateWith(pairs: [User, NurseDetail][], servicios: Partial<Servicio>[] = []): AppState {
  return {
    sessionId: null,
    notifs: [],
    users: pairs.map(([u]) => u),
    nurses: Object.fromEntries(pairs.map(([u, d]) => [u.id, d])),
    servicios: servicios as Servicio[],
  }
}

test('haversine: distancia conocida entre dos puntos de Bogotá', () => {
  const d = haversine({ lat: 4.711, lng: -74.0721 }, { lat: 4.7143, lng: -74.0645 })
  assert.ok(d > 0.9 && d < 0.94, `esperado ~0.92 km (cálculo a mano), obtuve ${d}`)
})

test('availableNurses: solo online, aprobadas y dentro del radio, ordenadas por distancia', () => {
  const state = stateWith([
    nurse('lejos', FROM.lat + 0.02), // ~2.2 km
    nurse('cerca', FROM.lat + 0.001), // ~0.1 km
    nurse('offline', FROM.lat, { online: false }),
    nurse('pendiente', FROM.lat, { aprobado_por_admin: 'pendiente' }),
    nurse('fuera', FROM.lat + 0.1), // ~11 km
  ])
  assert.deepEqual(availableNurses(state, FROM, [], 5).map((c) => c.user.id), ['cerca', 'lejos'])
})

test('availableNurses: excluye ocupadas y con oferta pendiente', () => {
  const state = stateWith(
    [nurse('ocupada', FROM.lat), nurse('ofertada', FROM.lat), nurse('libre', FROM.lat)],
    [
      { enfermero_id: 'ocupada', estado: 'en_camino', candidato: 'ocupada' },
      { enfermero_id: null, estado: 'solicitado', candidato: 'ofertada' },
    ],
  )
  assert.deepEqual(availableNurses(state, FROM).map((c) => c.user.id), ['libre'])
})
