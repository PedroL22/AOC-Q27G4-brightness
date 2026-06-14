import { LoaderCircle, MonitorUp, RefreshCw, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DISCONNECTED_STATE,
  normalizeStepValue,
  type ColorTemperature,
  type MonitorState,
  type NumericSetting,
} from '../../shared/monitor'

const TEMPERATURE_OPTIONS: Array<{
  value: ColorTemperature
  label: string
}> = [
  { value: 'srgb', label: 'sRGB' },
  { value: 'warm', label: 'Quente (6500K)' },
  { value: 'normal', label: 'Normal (7300K)' },
  { value: 'cool', label: 'Frio (9300K)' },
  { value: 'userRgb', label: 'UserRGB' },
]

export function App(): React.JSX.Element {
  const [state, setState] = useState<MonitorState>(DISCONNECTED_STATE)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [writeError, setWriteError] = useState<string | null>(null)
  const confirmedState = useRef<MonitorState>(DISCONNECTED_STATE)

  const loadState = useCallback(async () => {
    setLoading(true)
    setWriteError(null)
    const nextState = await window.monitorControls.getState()
    confirmedState.current = nextState
    setState(nextState)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const toggleExpanded = (): void => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    window.windowControls.setExpanded(nextExpanded)
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

  const disconnected = !state.connected

  return (
    <main className='relative h-full w-full select-none overflow-hidden rounded-[14px] border border-[#393a40] text-[#f6f6f7] shadow-[0_18px_60px_rgba(0,0,0,0.48)] [background:radial-gradient(circle_at_12%_0%,rgba(233,52,63,0.12),transparent_34%),#202125] [font-family:"Segoe_UI_Variable","Segoe_UI",sans-serif]'>
      <header className='flex h-12 items-center justify-between border-[#303136] border-b pr-[13px] pl-4 [-webkit-app-region:drag]'>
        <div className='flex items-center gap-[9px] font-[650] text-[#ededee] text-[13px] tracking-[0.02em]'>
          <span
            className={`h-2 w-2 rounded-full ${
              state.connected
                ? 'bg-[#e9343f] shadow-[0_0_0_3px_rgba(233,52,63,0.15)]'
                : 'bg-[#6d6f76] shadow-[0_0_0_3px_rgba(109,111,118,0.12)]'
            }`}
          />
          <span>{state.model ?? 'AOC Q27G4'}</span>
        </div>
        <div className='[-webkit-app-region:no-drag]'>
          <button
            aria-label={expanded ? 'Fechar configurações' : 'Abrir configurações'}
            className='grid h-8 w-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#bfc0c5] [-webkit-app-region:no-drag] hover:bg-[#303136] hover:text-white'
            onClick={toggleExpanded}
            type='button'
          >
            {expanded ? <X size={18} /> : <Settings size={18} />}
          </button>
        </div>
      </header>

      {loading ? (
        <div className='flex h-[calc(100%-48px)] items-center justify-center gap-2.5 text-[#bfc0c5] text-[13px]'>
          <LoaderCircle className='animate-spin' size={24} />
          <span>Lendo monitor...</span>
        </div>
      ) : disconnected ? (
        <div className='flex h-[calc(100%-48px)] flex-col items-center justify-center gap-[7px] p-4 text-center text-[#bfc0c5] text-[13px]'>
          <MonitorUp size={25} />
          <strong className='text-[#f3f3f4]'>AOC Q27G4 não encontrado</strong>
          <span className='text-[#9d9fa6] text-[11px]'>Verifique se o DDC/CI está habilitado no monitor.</span>
          <button
            className='mt-[5px] inline-flex cursor-pointer items-center gap-[7px] rounded-lg border border-[#44454b] bg-[#303136] px-[11px] py-[7px] text-inherit hover:border-[#e9343f]'
            onClick={loadState}
            type='button'
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </div>
      ) : (
        <div
          className={
            expanded
              ? 'grid grid-cols-[minmax(310px,1fr)_minmax(340px,1fr)] gap-[42px] px-6 pt-[18px] pb-[22px]'
              : 'block px-4 pt-[18px] pb-5'
          }
        >
          <section className='flex flex-col gap-[21px]'>
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
            <section>
              <h2 className='mb-[17px] font-[750] text-[#f6f6f7] text-[13px] uppercase tracking-[0.08em]'>
                Temperatura de cor
              </h2>
              <div className='grid grid-cols-2 gap-x-7 gap-y-[19px]'>
                {TEMPERATURE_OPTIONS.map((option) => (
                  <label
                    className='flex cursor-pointer items-center gap-[9px] text-[#dedee1] text-xs uppercase tracking-[0.06em]'
                    key={option.value}
                  >
                    <input
                      checked={state.colorTemperature === option.value}
                      className='peer pointer-events-none absolute opacity-0'
                      name='color-temperature'
                      onChange={() => void updateTemperature(option.value)}
                      type='radio'
                      value={option.value}
                    />
                    <span className='h-[17px] w-[17px] flex-none rounded-full border border-[#5b5d64] bg-[#45464b] transition-[120ms] peer-checked:border-4 peer-checked:border-[#e9343f] peer-checked:bg-white peer-checked:shadow-[0_0_0_3px_rgba(233,52,63,0.12)] peer-focus-visible:outline-2 peer-focus-visible:outline-[#f06a73] peer-focus-visible:outline-offset-[3px]' />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {writeError && (
        <div className='absolute right-3.5 bottom-3 max-w-[340px] rounded-[7px] border border-[rgba(233,52,63,0.5)] bg-[rgba(96,26,31,0.95)] px-2.5 py-[7px] text-[#ffe7e9] text-[11px]'>
          {writeError}
        </div>
      )}
    </main>
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
      <span className='mb-2.5 block font-[750] text-[#f6f6f7] text-[13px] uppercase tracking-[0.08em]'>{label}</span>
      <div className='grid grid-cols-[minmax(0,1fr)_34px] items-center gap-3'>
        <input
          aria-label={label}
          className='m-0 h-[18px] w-full cursor-pointer appearance-none bg-transparent outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-md [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[#f5f5f6] [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:bg-[#e9343f] [&::-webkit-slider-thumb]:shadow-[0_2px_7px_rgba(0,0,0,0.45)] focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-[rgba(233,52,63,0.48)] focus-visible:[&::-webkit-slider-thumb]:outline-offset-2'
          max='100'
          min='0'
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step='5'
          style={{
            background: `linear-gradient(to right, #e9343f 0, #9b2bbd ${value}%, #3a3b40 ${value}%, #3a3b40 100%)`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 6px',
          }}
          type='range'
          value={value}
        />
        <output className='text-right text-[#e8e8ea] text-[13px] tabular-nums'>{value}</output>
      </div>
    </label>
  )
}
