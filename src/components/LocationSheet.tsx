import { Crosshair, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import { availableNurses } from '../store/sim'
import type { LatLng } from '../types'
import { MapView } from './MapView'
import { Sheet } from './Sheet'
import { Button, inputCls } from './ui'

const PRESETS: { name: string; pos: LatLng }[] = [
  { name: 'Chapinero · Cra 15 #93-40', pos: { lat: 4.7143, lng: -74.0645 } },
  { name: 'Usaquén · Calle 119 #6-20', pos: { lat: 4.6965, lng: -74.0305 } },
  { name: 'Teusaquillo · Calle 45 #19-10', pos: { lat: 4.6395, lng: -74.0712 } },
  { name: 'Suba · Av. Suba #115-30', pos: { lat: 4.7432, lng: -74.0925 } },
  { name: 'Kennedy · Cra 78 #38-15', pos: { lat: 4.6275, lng: -74.1405 } },
]

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, state, setLocation } = useApp()
  const [pos, setPos] = useState<LatLng>(me!.ubicacion)
  const [addr, setAddr] = useState(me!.direccion)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (open && me) {
      setPos(me.ubicacion)
      setAddr(me.direccion)
    }
  }, [open, me])

  const near = availableNurses(state, pos, [], 10)

  const locate = () => {
    setLocating(true)
    setTimeout(() => {
      setPos(PRESETS[0].pos)
      setAddr(PRESETS[0].name)
      setLocating(false)
    }, 900)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ubicación">
      <h2 className="text-xl font-extrabold">¿Dónde te atendemos?</h2>
      <p className="mb-3 text-[14px] text-mute">Toca el mapa para mover el punto o elige una dirección.</p>

      <div className="relative">
        <MapView
          className="h-48 rounded-3xl"
          center={pos}
          kmAcross={9}
          radiusKm={5}
          onPick={(p) => {
            setPos(p)
            setAddr(`Punto en el mapa (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`)
          }}
          markers={[
            { id: 'me', pos, kind: 'patient' },
            ...near.map((c) => ({ id: c.user.id, pos: c.user.ubicacion, kind: 'nurse' as const, label: c.user.nombre, color: c.user.color })),
          ]}
        />
        <button onClick={locate} className="press absolute bottom-3 right-3 flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold text-brand-700 shadow-lg">
          {locating ? <span className="spin h-4 w-4 rounded-full border-2 border-brand-200 border-t-brand-600" /> : <Crosshair size={16} />}
          Mi ubicación
        </button>
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold text-mint-600">{near.length} enfermeros disponibles en 10 km</p>

      <div className="relative mt-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={inputCls + ' pl-11'} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Escribe tu dirección" enterKeyHint="done" />
      </div>

      <div className="mt-3 space-y-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => { setPos(p.pos); setAddr(p.name) }} className="press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-slate-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><MapPin size={18} /></span>
            <span className="text-[14px] font-semibold">{p.name}</span>
          </button>
        ))}
      </div>

      <Button block className="mt-4" onClick={() => { setLocation(pos, addr || 'Ubicación seleccionada'); onClose() }}>
        Confirmar ubicación
      </Button>
    </Sheet>
  )
}
