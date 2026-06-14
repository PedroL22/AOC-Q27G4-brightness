import koffi from 'koffi'
import { VCP_CODES, isTargetMonitor, parseCapabilities } from '../../shared/monitor.js'

const REQUIRED_VCP_CODES = new Set(Object.values(VCP_CODES))

interface PhysicalMonitor {
  handle: unknown
  description: string
}

interface TargetMonitor extends PhysicalMonitor {
  model: string
  capabilities: string
}

export interface VcpValue {
  current: number
  maximum: number
}

export interface WindowsDdcAdapter {
  withTarget<T>(operation: (monitor: TargetMonitor) => T): T
  getVcp(monitor: TargetMonitor, code: number): VcpValue
  setVcp(monitor: TargetMonitor, code: number, value: number): void
}

const _DWORD = koffi.alias('DWORD', 'uint32_t')
const _BOOL = koffi.alias('BOOL', 'int32_t')
const HANDLE = koffi.pointer('HANDLE', koffi.opaque())
const _HMONITOR = koffi.alias('HMONITOR', HANDLE)
const _HDC = koffi.alias('HDC', HANDLE)
const _LPARAM = koffi.alias('LPARAM', 'intptr_t')

const PHYSICAL_MONITOR = koffi.struct('PHYSICAL_MONITOR', {
  hPhysicalMonitor: HANDLE,
  szPhysicalMonitorDescription: koffi.array('char16_t', 128, 'String'),
})

const _MONITOR_ENUM_PROC = koffi.proto(
  'BOOL __stdcall MONITOR_ENUM_PROC(HMONITOR monitor, HDC hdc, void *rect, LPARAM data)'
)

const user32 = koffi.load('user32.dll')
const dxva2 = koffi.load('dxva2.dll')
const kernel32 = koffi.load('kernel32.dll')

const enumDisplayMonitors = user32.func(
  'BOOL __stdcall EnumDisplayMonitors(HDC hdc, void *clip, MONITOR_ENUM_PROC *callback, LPARAM data)'
)
const getPhysicalMonitorCount = dxva2.func(
  'BOOL __stdcall GetNumberOfPhysicalMonitorsFromHMONITOR(HMONITOR monitor, _Out_ DWORD *count)'
)
const getPhysicalMonitors = dxva2.func(
  'BOOL __stdcall GetPhysicalMonitorsFromHMONITOR(HMONITOR monitor, DWORD count, _Out_ void *monitors)'
)
const destroyPhysicalMonitors = dxva2.func('BOOL __stdcall DestroyPhysicalMonitors(DWORD count, void *monitors)')
const getCapabilitiesLength = dxva2.func(
  'BOOL __stdcall GetCapabilitiesStringLength(HANDLE monitor, _Out_ DWORD *length)'
)
const getCapabilities = dxva2.func(
  'BOOL __stdcall CapabilitiesRequestAndCapabilitiesReply(HANDLE monitor, _Out_ char *capabilities, DWORD length)'
)
const getVcpFeature = dxva2.func(
  'BOOL __stdcall GetVCPFeatureAndVCPFeatureReply(HANDLE monitor, uint8_t code, _Out_ DWORD *type, _Out_ DWORD *current, _Out_ DWORD *maximum)'
)
const setVcpFeature = dxva2.func('BOOL __stdcall SetVCPFeature(HANDLE monitor, uint8_t code, DWORD value)')
const getLastError = kernel32.func('DWORD __stdcall GetLastError()')

function windowsError(operation: string): Error {
  return new Error(`${operation} failed with Windows error ${getLastError()}`)
}

function readCapabilities(handle: unknown): string {
  const length = [0]
  if (!getCapabilitiesLength(handle, length)) {
    throw windowsError('GetCapabilitiesStringLength')
  }

  const size = length[0] ?? 0
  if (size <= 1) {
    throw new Error('Monitor returned an empty capabilities string')
  }

  const buffer = Buffer.alloc(size)
  if (!getCapabilities(handle, buffer, size)) {
    throw windowsError('CapabilitiesRequestAndCapabilitiesReply')
  }

  return koffi.decode(buffer, 'char', -1)
}

function hasRequiredVcpCodes(codes: Set<number>): boolean {
  return [...REQUIRED_VCP_CODES].every((code) => codes.has(code))
}

export class NativeWindowsDdcAdapter implements WindowsDdcAdapter {
  withTarget<T>(operation: (monitor: TargetMonitor) => T): T {
    let result: T | undefined
    let found = false
    let callbackError: unknown

    const enumerated = enumDisplayMonitors(
      null,
      null,
      (logicalMonitor: unknown) => {
        const countOutput = [0]
        if (!getPhysicalMonitorCount(logicalMonitor, countOutput)) {
          return 1
        }

        const count = countOutput[0] ?? 0
        if (count === 0) {
          return 1
        }

        const buffer = Buffer.alloc(koffi.sizeof(PHYSICAL_MONITOR) * count)
        if (!getPhysicalMonitors(logicalMonitor, count, buffer)) {
          return 1
        }

        try {
          for (let index = 0; index < count; index += 1) {
            const decoded = koffi.decode(buffer, index * koffi.sizeof(PHYSICAL_MONITOR), PHYSICAL_MONITOR) as {
              hPhysicalMonitor: unknown
              szPhysicalMonitorDescription: string
            }

            let capabilities: string
            try {
              capabilities = readCapabilities(decoded.hPhysicalMonitor)
            } catch {
              continue
            }

            const parsed = parseCapabilities(capabilities)
            if (isTargetMonitor(parsed.model) && hasRequiredVcpCodes(parsed.vcpCodes)) {
              found = true
              try {
                result = operation({
                  handle: decoded.hPhysicalMonitor,
                  description: decoded.szPhysicalMonitorDescription,
                  model: parsed.model ?? 'AOC Q27G4',
                  capabilities,
                })
              } catch (error) {
                callbackError = error
              }
              return 0
            }
          }
        } catch (error) {
          callbackError = error
          return 0
        } finally {
          destroyPhysicalMonitors(count, buffer)
        }

        return 1
      },
      0
    )

    if (!enumerated && callbackError === undefined && !found) {
      throw windowsError('EnumDisplayMonitors')
    }
    if (callbackError !== undefined) {
      throw callbackError
    }
    if (!found) {
      throw new Error('AOC Q27G4 not found')
    }

    return result as T
  }

  getVcp(monitor: TargetMonitor, code: number): VcpValue {
    const type = [0]
    const current = [0]
    const maximum = [0]

    if (!getVcpFeature(monitor.handle, code, type, current, maximum)) {
      throw windowsError(`GetVCPFeatureAndVCPFeatureReply(0x${code.toString(16)})`)
    }

    return {
      current: current[0] ?? 0,
      maximum: maximum[0] ?? 0,
    }
  }

  setVcp(monitor: TargetMonitor, code: number, value: number): void {
    if (!setVcpFeature(monitor.handle, code, value)) {
      throw windowsError(`SetVCPFeature(0x${code.toString(16)})`)
    }
  }
}
