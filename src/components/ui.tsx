import {
  Baby, Bandage, Droplet, FlaskConical, HeartPulse, Star, Syringe, Users, type LucideIcon,
} from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { initials } from '../lib/format'
import type { Estado } from '../types'

const ICONS: Record<string, LucideIcon> = {
  syringe: Syringe, bandage: Bandage, heart: HeartPulse, users: Users, flask: FlaskConical, droplet: Droplet, baby: Baby,
}
export const ServiceIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const I = ICONS[name] ?? HeartPulse
  return <I size={size} strokeWidth={2} />
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'mint'
  loading?: boolean
  block?: boolean
}
export function Button({ variant = 'primary', loading, block, className = '', children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'btn-primary bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(29,111,232,0.7)]',
    mint: 'bg-mint-500 text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)]',
    soft: 'bg-brand-50 text-brand-700',
    ghost: 'bg-white text-ink border border-slate-200',
    danger: 'bg-red-50 text-red-600',
  }[variant]
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={`press inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold ${v} ${block ? 'w-full' : ''} ${className}`}
    >
      {loading && <span className="spin h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  )
}

export function Avatar({ name, color, size = 44, online }: { name: string; color: string; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(name)}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-mint-500' : 'bg-slate-300'}`} />
      )}
    </span>
  )
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-amber-500" style={{ fontSize: size }}>
      <Star size={size} fill="currentColor" strokeWidth={0} />
      {value.toFixed(1)}
    </span>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`press relative h-9 w-16 rounded-full p-1 transition-colors duration-200 ${on ? 'bg-mint-500' : 'bg-slate-300'}`}
    >
      <span className="switch-knob block h-7 w-7 rounded-full bg-white shadow" style={{ transform: on ? 'translateX(28px)' : 'translateX(0)' }} />
    </button>
  )
}

export const ESTADO_LABEL: Record<Estado, string> = {
  solicitado: 'Buscando',
  aceptado: 'Aceptado',
  en_camino: 'En camino',
  en_atencion: 'En atención',
  completado: 'Completado',
  cancelado: 'Cancelado',
  sin_cobertura: 'Sin cobertura',
}
const ESTADO_STYLE: Record<Estado, string> = {
  solicitado: 'bg-amber-50 text-amber-700',
  aceptado: 'bg-brand-50 text-brand-700',
  en_camino: 'bg-brand-50 text-brand-700',
  en_atencion: 'bg-mint-50 text-mint-600',
  completado: 'bg-mint-50 text-mint-600',
  cancelado: 'bg-slate-100 text-slate-500',
  sin_cobertura: 'bg-red-50 text-red-600',
}
export const StatusPill = ({ estado }: { estado: Estado }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_STYLE[estado]}`}>{ESTADO_LABEL[estado]}</span>
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(15,31,61,0.04),0_8px_24px_-12px_rgba(15,31,61,0.12)] ${className}`}>{children}</div>
)

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-semibold text-mute">{label}</span>
    {children}
  </label>
)
export const inputCls =
  'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:shadow-[0_0_0_4px_rgba(42,116,238,0.12)]'

export function SuccessMark({ size = 88 }: { size?: number }) {
  return (
    <span className="success-ring inline-flex items-center justify-center rounded-full bg-mint-500 text-white" style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="success-check" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  )
}

export function Confetti() {
  const colors = ['#1d6fe8', '#10b981', '#f59e0b', '#ec4899', '#6366f1']
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="confetti absolute h-2 w-1.5 rounded-sm"
          style={{
            background: colors[i % colors.length],
            ['--dx' as string]: `${(i - 8) * 14}px`,
            ['--rot' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
            animationDelay: `${(i % 4) * 40}ms`,
          }}
        />
      ))}
    </div>
  )
}
