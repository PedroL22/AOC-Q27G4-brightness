// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/src/App'
import type { MonitorState } from '../../src/shared/monitor'

const connectedState: MonitorState = {
  initialized: true,
  connected: true,
  model: 'AOC Q27G4N',
  brightness: 15,
  contrast: 50,
  sharpness: 0,
  colorTemperature: 'warm',
}

const getState = vi.fn()
const setNumeric = vi.fn()
const setColorTemperature = vi.fn()
const setExpanded = vi.fn()
const hide = vi.fn()
const getOpenAtLogin = vi.fn()
const setOpenAtLogin = vi.fn()
let stateListener: ((state: MonitorState) => void) | undefined

beforeEach(() => {
  vi.clearAllMocks()
  getState.mockResolvedValue(connectedState)
  setNumeric.mockResolvedValue(connectedState)
  setColorTemperature.mockResolvedValue(connectedState)
  getOpenAtLogin.mockResolvedValue(true)
  setOpenAtLogin.mockImplementation(async (enabled: boolean) => enabled)
  stateListener = undefined
  Object.assign(window, {
    monitorControls: {
      getState,
      setNumeric,
      setColorTemperature,
      rescan: getState,
      onStateChanged: (listener: (state: MonitorState) => void) => {
        stateListener = listener
        return vi.fn()
      },
    },
    windowControls: {
      setExpanded,
      hide,
      onCollapsed: () => vi.fn(),
    },
    startupControls: {
      getOpenAtLogin,
      setOpenAtLogin,
    },
  })
})

describe('App', () => {
  it('shows only brightness in compact mode', async () => {
    render(<App />)

    expect(await screen.findByText('AOC Q27G4N')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Brilho' })).toHaveAttribute('step', '5')
    expect(screen.queryByRole('slider', { name: 'Contraste' })).not.toBeInTheDocument()
  })

  it('shows a marker for every five-point slider step', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')

    expect(screen.getByTestId('Brilho-step-markers').children).toHaveLength(21)
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('expands to show all screenshot controls', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')

    fireEvent.click(screen.getByLabelText('Abrir configurações'))

    expect(setExpanded).toHaveBeenCalledWith(true)
    expect(screen.getByRole('slider', { name: 'Contraste' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Nitidez' })).toBeInTheDocument()
    expect(screen.getByText('Temperatura de cor')).toBeInTheDocument()
    expect(screen.getByText('UserRGB')).toBeInTheDocument()
  })

  it('returns to compact mode from the settings footer', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')
    fireEvent.click(screen.getByLabelText('Abrir configurações'))

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao modo normal' }))

    expect(setExpanded).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('slider', { name: 'Contraste' })).not.toBeInTheDocument()
  })

  it('sends normalized slider values', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')
    const brightness = screen.getByRole('slider', { name: 'Brilho' })

    fireEvent.pointerDown(brightness)
    fireEvent.change(brightness, {
      target: { value: '25' },
    })
    expect(setNumeric).not.toHaveBeenCalled()
    fireEvent.pointerUp(brightness)

    await waitFor(() => {
      expect(setNumeric).toHaveBeenCalledWith('brightness', 25)
    })
  })

  it('shows loading feedback while a slider write is pending', async () => {
    let resolveWrite: ((state: MonitorState) => void) | undefined
    setNumeric.mockReturnValue(
      new Promise<MonitorState>((resolve) => {
        resolveWrite = resolve
      })
    )
    render(<App />)
    await screen.findByText('AOC Q27G4N')
    const brightness = screen.getByRole('slider', { name: 'Brilho' })

    fireEvent.pointerDown(brightness)
    fireEvent.change(brightness, {
      target: { value: '25' },
    })
    fireEvent.pointerUp(brightness)

    expect(screen.getByLabelText('Salvando Brilho')).toBeInTheDocument()
    resolveWrite?.(connectedState)

    await waitFor(() => {
      expect(screen.queryByLabelText('Salvando Brilho')).not.toBeInTheDocument()
    })
  })

  it('keeps the optimistic slider value while monitor confirmation is pending', async () => {
    let resolveWrite: ((state: MonitorState) => void) | undefined
    setNumeric.mockReturnValue(
      new Promise<MonitorState>((resolve) => {
        resolveWrite = resolve
      })
    )
    render(<App />)
    await screen.findByText('AOC Q27G4N')
    const brightness = screen.getByRole('slider', { name: 'Brilho' })

    fireEvent.pointerDown(brightness)
    fireEvent.change(brightness, { target: { value: '25' } })
    expect(setNumeric).not.toHaveBeenCalled()
    expect(brightness).toHaveValue('25')
    fireEvent.pointerUp(brightness)
    stateListener?.(connectedState)

    expect(brightness).toHaveValue('25')
    expect(screen.getByLabelText('Salvando Brilho')).toBeInTheDocument()

    resolveWrite?.({ ...connectedState, brightness: 25 })
    await waitFor(() => {
      expect(screen.queryByLabelText('Salvando Brilho')).not.toBeInTheDocument()
    })
  })

  it('shows the retry state when the monitor is disconnected', async () => {
    getState.mockResolvedValue({
      initialized: true,
      connected: false,
      model: null,
      brightness: null,
      contrast: null,
      sharpness: null,
      colorTemperature: null,
    })

    render(<App />)

    expect(await screen.findByText('AOC Q27G4 não encontrado')).toBeInTheDocument()
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
  })

  it('shows initialization progress and reacts to the ready state', async () => {
    getState.mockResolvedValue({
      ...connectedState,
      initialized: false,
      connected: false,
      model: null,
    })

    render(<App />)

    expect(await screen.findByText('Inicializando...')).toBeInTheDocument()
    stateListener?.(connectedState)
    expect(await screen.findByText('Pronto')).toBeInTheDocument()
  })

  it('hides the window when Escape is pressed', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(hide).toHaveBeenCalled()
  })

  it('enables startup by default and persists changes', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')
    fireEvent.click(screen.getByLabelText('Abrir configurações'))

    const startupCheckbox = await screen.findByRole('checkbox', {
      name: 'Abrir quando o computador iniciar',
    })
    expect(startupCheckbox).toBeChecked()

    fireEvent.click(startupCheckbox)

    await waitFor(() => {
      expect(setOpenAtLogin).toHaveBeenCalledWith(false)
    })
  })
})
