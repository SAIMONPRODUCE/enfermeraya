import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Evita pantalla blanca: si una vista lanza, se muestra un mensaje con opción de recargar. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EnfermeraYa: error de vista', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app-shell items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-extrabold">Algo salió mal</p>
        <p className="text-[14px] text-mute">Recarga la página para continuar.</p>
        <button onClick={() => window.location.reload()} className="press h-12 rounded-2xl bg-brand-600 px-5 font-semibold text-white">
          Recargar
        </button>
      </div>
    )
  }
}
