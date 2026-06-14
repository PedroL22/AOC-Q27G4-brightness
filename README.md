# AOC Q27G4 Brightness

Windows application for controlling the AOC Q27G4 directly through DDC/CI.

## Features

- System tray icon.
- Compact brightness popover.
- Expanded panel for brightness, contrast, sharpness, and color temperature.
- All sliders work exclusively in increments of 5.
- Starts automatically and remains hidden when Windows starts.
- Direct communication with `user32.dll` and `dxva2.dll`.
- No dependency on AOC G-Menu.

## Requirements

- Windows 10 or 11 x64.
- DDC/CI enabled in the monitor menu.
- AOC Q27G4 connected through an interface that supports DDC/CI.

Avoid running G-Menu at the same time because both applications may send
conflicting commands to the monitor.

## Development

```powershell
bun install
bun run dev
```

If the environment has `ELECTRON_RUN_AS_NODE=1`, remove the variable before
starting Electron:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
bun run dev
```

## Verification

```powershell
bun run typecheck
bun run check
bun test
bun run build
```

Read the DDC/CI state without changing any values:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
.\node_modules\.bin\electron.cmd . --smoke-test
```

## Installer

```powershell
bun run dist:win
```

The NSIS installer will be created in `release/`.
