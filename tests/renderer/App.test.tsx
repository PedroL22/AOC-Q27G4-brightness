// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/src/App'
import type { MonitorState } from '../../src/shared/monitor'

const connectedState: MonitorState = {
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

beforeEach(() => {
  getState.mockResolvedValue(connectedState)
  setNumeric.mockResolvedValue(connectedState)
  setColorTemperature.mockResolvedValue(connectedState)
  Object.assign(window, {
    monitorControls: {
      getState,
      setNumeric,
      setColorTemperature,
      rescan: getState,
    },
    windowControls: {
      setExpanded,
      hide: vi.fn(),
    },
  })
})

describe('App', () => {
  it('shows only brightness in compact mode', async () => {
    render(<App />)

    expect(await screen.findByText('AOC Q27G4N')).toBeInTheDocument()
    expect(screen.getByLabelText('Brilho')).toHaveAttribute('step', '5')
    expect(screen.queryByLabelText('Contraste')).not.toBeInTheDocument()
  })

  it('expands to show all screenshot controls', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')

    fireEvent.click(screen.getByLabelText('Abrir configurações'))

    expect(setExpanded).toHaveBeenCalledWith(true)
    expect(screen.getByLabelText('Contraste')).toBeInTheDocument()
    expect(screen.getByLabelText('Nitidez')).toBeInTheDocument()
    expect(screen.getByText('Temperatura de cor')).toBeInTheDocument()
    expect(screen.getByText('UserRGB')).toBeInTheDocument()
  })

  it('sends normalized slider values', async () => {
    render(<App />)
    await screen.findByText('AOC Q27G4N')

    fireEvent.change(screen.getByLabelText('Brilho'), {
      target: { value: '25' },
    })

    await waitFor(() => {
      expect(setNumeric).toHaveBeenCalledWith('brightness', 25)
    })
  })

  it('shows the retry state when the monitor is disconnected', async () => {
    getState.mockResolvedValue({
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
})
