import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedState } from '../data/seed'
import { haversine } from '../lib/geo'
import type { AppState, Servicio } from '../types'
import { actions, availableNurses, quote } from './sim'

const NOW = 1_000_000

function serviceFor(state: AppState, id: string, patch: Partial<Servicio> = {}): Servicio {
  const nurse = state.users.find((u) => u.rol === 'enfermero' && u.ubicacion)!
  return {
    id, paciente_id: 'p1', enfermero_id: null, servicio_id: 'inyect', estado: 'solicitado',
    ubicacion_paciente: nurse.ubicacion, direccion: 'Test', inmediato: true, fecha_hora: null,
    notas: '', total: 50000, metodo_pago: 'efectivo', calificacion: null, resena: '',
    creado: NOW, estado_ts: NOW, nursePos: null, llego: false, llego_ts: 0, manual: false,
    candidato: null, oferta_inicio: NOW, rechazados: [], ...patch,
  }
}

test('haversine: distancia conocida entre dos puntos de Bogotá', () => {
  const d = haversine({ lat: 4.711, lng: -74.0721 }, { lat: 4.7143, lng: -74.0645 })
  assert.ok(d > 0.9 && d < 0.94, `esperado ~0.92 km (cálculo a mano), obtuve ${d}`)
})

test('quote: urgencia suma 20% redondeado a 500 y desplazamiento mínimo 2000', () => {
  const q = quote(35000, true, 0.2)
  assert.equal(q.recargo, 7000)
  assert.equal(q.desplazamiento, 2000)
  assert.equal(q.total, 35000 + 7000 + 2000)
})

test('availableNurses: solo enfermeras online, aprobadas y dentro del radio', () => {
  const state = seedState()
  const from = { lat: 4.7143, lng: -74.0645 }
  const got = availableNurses(state, from, [], 5)
  for (const c of got) {
    assert.equal(state.nurses[c.user.id].online, true)
    assert.equal(state.nurses[c.user.id].aprobado_por_admin, 'aprobado')
    assert.ok(c.dist <= 5)
  }
})

test('BUG doble oferta: una enfermera con oferta pendiente no debe ofrecerse a otro servicio', () => {
  const state = seedState()
  const from = { lat: 4.7143, lng: -74.0645 }
  const first = availableNurses(state, from, [], 10)[0]
  const withOffer: AppState = {
    ...state,
    servicios: [serviceFor(state, 's1', { candidato: first.user.id })],
  }
  const ids = availableNurses(withOffer, from, [], 10).map((c) => c.user.id)
  assert.ok(!ids.includes(first.user.id), `${first.user.id} ya tiene oferta pendiente y aparece como disponible`)
})

test('BUG doble aceptación: accept no debe asignar a una enfermera ya ocupada', () => {
  const state = seedState()
  const nurseId = 'n2'
  const busy: AppState = {
    ...state,
    servicios: [serviceFor(state, 'busy', { enfermero_id: nurseId, estado: 'en_camino' })],
  }
  const next = actions.accept(busy, 'new', nurseId, true, NOW)
  const newest = next.servicios.find((s) => s.id === 'new')
  assert.equal(newest, undefined, 'accept sobre servicio inexistente no debe crear nada')

  const pending: AppState = {
    ...busy,
    servicios: [...busy.servicios, serviceFor(state, 'new', { candidato: nurseId })],
  }
  const after = actions.accept(pending, 'new', nurseId, true, NOW)
  const acc = after.servicios.find((s) => s.id === 'new')!
  assert.equal(acc.estado, 'solicitado', 'enfermera ocupada no debe poder aceptar otro servicio')
})

test('BUG rate: el promedio no debe contar el servicio dos veces', () => {
  const seed = seedState()
  // calificación 1.0 para que el redondeo a 1 decimal no oculte la diferencia
  const state: AppState = {
    ...seed,
    users: seed.users.map((u) => (u.id === 'n1' ? { ...u, calificacion: 1 } : u)),
  }
  const base: AppState = {
    ...state,
    nurses: { ...state.nurses, n1: { ...state.nurses.n1, servicios: 10 } },
    servicios: [serviceFor(state, 'done', { enfermero_id: 'n1', estado: 'en_atencion' })],
  }
  const done = actions.advance(base, 'done', NOW + 1)
  const rated = actions.rate(done, 'done', 5, '', NOW + 2)
  const updated = rated.users.find((u) => u.id === 'n1')!
  // promedio previo sobre 10 servicios + nueva calificación 5, dividido entre 11
  const expected = Math.round(((1 * 10 + 5) / 11) * 10) / 10
  assert.equal(updated.calificacion, expected)
})
