import { ChevronLeft, LoaderCircle, MonitorUp, RefreshCw, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  DISCONNECTED_STATE,
  normalizeStepValue,
  type ColorTemperature,
  type MonitorState,
  type NumericSetting,
} from '../../shared/monitor'

const TEMPERATURE_OPTIONS: Array<{ value: ColorTemperature; label: string }> = [
  { value: 'srgb', label: 'sRGB' },
  { value: 'warm', label: 'Quente (6500K)' },
  { value: 'normal', label: 'Normal (7300K)' },
  { value: 'cool', label: 'Frio (9300K)' },
  { value: 'userRgb', label: 'UserRGB' },
]

export function App(): React.JSX.Element {
  const [state, setState] = useState<MonitorState>(DISCONNECTED_STATE)
  const [expanded, setExpanded] = useState(false)
  const [openAtLogin, setOpenAtLogin] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const confirmedState = useRef<MonitorState>(DISCONNECTED_STATE)

  useEffect(() => {
    let mounted = true
    const applyState = (nextState: MonitorState): void => {
      if (!mounted) {
        return
      }
      confirmedState.current = nextState
      setState(nextState)
      setRefreshing(false)
    }

    void window.monitorControls.getState().then(applyState)
    void window.startupControls.getOpenAtLogin().then((enabled) => {
      if (mounted) {
        setOpenAtLogin(enabled)
      }
    })
    const unsubscribeState = window.monitorControls.onStateChanged(applyState)
    const unsubscribeCollapsed = window.windowControls.onCollapsed(() => setExpanded(false))
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        window.windowControls.hide()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      mounted = false
      unsubscribeState()
      unsubscribeCollapsed()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const toggleExpanded = (): void => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    window.windowControls.setExpanded(nextExpanded)
  }

  const collapseSettings = (): void => {
    setExpanded(false)
    window.windowControls.setExpanded(false)
  }

  const rescan = async (): Promise<void> => {
    setRefreshing(true)
    setWriteError(null)
    const nextState = await window.monitorControls.rescan()
    confirmedState.current = nextState
    setState(nextState)
    setRefreshing(false)
  }

  const updateNumeric = async (setting: NumericSetting, value: number): Promise<void> => {
    const normalized = normalizeStepValue(value)
    setWriteError(null)
    setState((current) => ({ ...current, [setting]: normalized }))

    try {
      const nextState = await window.monitorControls.setNumeric(setting, normalized)
      confirmedState.current = nextState
      setState(nextState)
    } catch (error) {
      setState(confirmedState.current)
      setWriteError(error instanceof Error ? error.message : 'Não foi possível alterar o monitor')
    }
  }

  const updateTemperature = async (value: ColorTemperature): Promise<void> => {
    setWriteError(null)
    setState((current) => ({ ...current, colorTemperature: value }))

    try {
      const nextState = await window.monitorControls.setColorTemperature(value)
      confirmedState.current = nextState
      setState(nextState)
    } catch (error) {
      setState(confirmedState.current)
      setWriteError(error instanceof Error ? error.message : 'Não foi possível alterar o monitor')
    }
  }

  const updateOpenAtLogin = async (enabled: boolean): Promise<void> => {
    setOpenAtLogin(enabled)
    try {
      setOpenAtLogin(await window.startupControls.setOpenAtLogin(enabled))
    } catch {
      setOpenAtLogin(!enabled)
    }
  }

  const initializing = !state.initialized

  return (
    <main className='relative h-full w-full select-none overflow-hidden rounded-xl border border-[#3a3b40] bg-[#202125] text-[#f5f5f6] shadow-2xl [font-family:"Segoe_UI_Variable","Segoe_UI",sans-serif]'>
      <header className='flex h-12 items-center justify-between border-[#34353a] border-b px-3.5 [-webkit-app-region:drag]'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              initializing ? 'bg-[#92949a]' : state.connected ? 'bg-[#35b878]' : 'bg-[#e5484d]'
            }`}
          />
          <div className='min-w-0'>
            <div className='truncate font-semibold text-[13px]'>{state.model ?? 'AOC Q27G4'}</div>
            <div className='text-[#9fa1a8] text-[10px]'>
              {initializing ? 'Inicializando...' : state.connected ? 'Pronto' : 'Monitor indisponível'}
            </div>
          </div>
        </div>
        <button
          aria-label={expanded ? 'Fechar configurações' : 'Abrir configurações'}
          className='grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-transparent text-[#b8bac0] [-webkit-app-region:no-drag] hover:bg-[#303136] hover:text-white'
          onClick={expanded ? collapseSettings : toggleExpanded}
          type='button'
        >
          {expanded ? <X size={18} /> : <Settings size={18} />}
        </button>
      </header>

      <div className='flex h-[calc(100%-48px)] min-h-0 flex-col'>
        {initializing ? (
          <StatusPanel icon={<LoaderCircle className='animate-spin' size={20} />} text='Conectando ao monitor...' />
        ) : !state.connected ? (
          <div className='flex min-h-0 flex-1 items-center justify-center gap-3 px-4 text-[#b8bac0] text-xs'>
            <MonitorUp size={20} />
            <span>AOC Q27G4 não encontrado</span>
            <button
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#303136] px-2.5 py-1.5 text-[#ededee] hover:bg-[#3a3b40]'
              disabled={refreshing}
              onClick={() => void rescan()}
              type='button'
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} size={14} />
              Tentar novamente
            </button>
          </div>
        ) : (
          <div
            className={
              expanded ? 'grid min-h-0 flex-1 grid-cols-[minmax(320px,1fr)_minmax(340px,1fr)] gap-8 p-6' : 'p-4'
            }
          >
            <section className='flex flex-col gap-5'>
              <MonitorSlider
                label='Brilho'
                onChange={(value) => void updateNumeric('brightness', value)}
                value={state.brightness ?? 0}
              />
              {expanded && (
                <>
                  <MonitorSlider
                    label='Contraste'
                    onChange={(value) => void updateNumeric('contrast', value)}
                    value={state.contrast ?? 0}
                  />
                  <MonitorSlider
                    label='Nitidez'
                    onChange={(value) => void updateNumeric('sharpness', value)}
                    value={state.sharpness ?? 0}
                  />
                </>
              )}
            </section>

            {expanded && (
              <section className='rounded-lg bg-[#27282c] p-4'>
                <h2 className='mb-3 font-semibold text-[#c8c9ce] text-xs uppercase tracking-[0.08em]'>
                  Temperatura de cor
                </h2>
                <div className='flex flex-col gap-1.5'>
                  {TEMPERATURE_OPTIONS.map((option) => (
                    <label
                      className='flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[#e2e2e4] text-[13px] hover:bg-[#303136]'
                      key={option.value}
                    >
                      <input
                        checked={state.colorTemperature === option.value}
                        className='peer sr-only'
                        name='color-temperature'
                        onChange={() => void updateTemperature(option.value)}
                        type='radio'
                      />
                      <span className='h-4 w-4 rounded-full border-2 border-[#66686f] peer-checked:border-[#e5484d] peer-checked:border-[5px] peer-focus-visible:outline-2 peer-focus-visible:outline-[#e5484d] peer-focus-visible:outline-offset-2' />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {expanded && (
          <footer className='flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-[#34353a] border-t px-4 py-2 text-xs'>
            <button
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-[#d7d8dc] hover:bg-[#303136] hover:text-white'
              onClick={collapseSettings}
              type='button'
            >
              <ChevronLeft size={15} />
              Voltar ao modo normal
            </button>
            <label className='flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-[#d7d8dc]'>
              <input
                aria-label='Abrir quando o computador iniciar'
                checked={openAtLogin}
                className='peer sr-only'
                onChange={(event) => void updateOpenAtLogin(event.currentTarget.checked)}
                type='checkbox'
              />
              <span className='grid h-4 w-4 place-items-center rounded border border-[#66686f] bg-[#292a2e] text-transparent peer-checked:border-[#e5484d] peer-checked:bg-[#e5484d] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-[#e5484d] peer-focus-visible:outline-offset-2'>
                ✓
              </span>
              <span>Abrir quando o computador iniciar</span>
            </label>
          </footer>
        )}
      </div>

      {writeError && (
        <div className='absolute right-3 bottom-3 rounded-md border border-[#7f3438] bg-[#4a2528] px-3 py-2 text-[#ffdadd] text-xs'>
          {writeError}
        </div>
      )}
    </main>
  )
}

function StatusPanel({ icon, text }: { icon: React.ReactNode; text: string }): React.JSX.Element {
  return (
    <div className='flex min-h-0 flex-1 items-center justify-center gap-2.5 text-[#b8bac0] text-xs'>
      {icon}
      <span>{text}</span>
    </div>
  )
}

interface MonitorSliderProps {
  label: string
  value: number
  onChange(value: number): void
}

function MonitorSlider({ label, value, onChange }: MonitorSliderProps): React.JSX.Element {
  return (
    <label className='block'>
      <span className='mb-2 flex items-center justify-between'>
        <span className='font-semibold text-[#d7d8dc] text-xs uppercase tracking-[0.08em]'>{label}</span>
        <output className='text-[#f0f0f1] text-xs tabular-nums'>{value}</output>
      </span>
      <div className='relative h-5'>
        <span className='absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-[#3c3d42]' />
        <span
          className='absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-[#e5484d]'
          style={{ width: `${value}%` }}
        />
        <input
          aria-label={label}
          className='absolute inset-0 m-0 h-5 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#e5484d] focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-[#e5484d] focus-visible:[&::-webkit-slider-thumb]:outline-offset-2'
          max='100'
          min='0'
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step='5'
          type='range'
          value={value}
        />
      </div>
    </label>
  )
}
