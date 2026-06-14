export interface StartupControlsApi {
  getOpenAtLogin(): Promise<boolean>
  setOpenAtLogin(enabled: boolean): Promise<boolean>
}
