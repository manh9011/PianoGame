interface DesktopBridge {
  platform: 'electron'
  exitApp(): void
  openUrl(url: string): void
}

declare global {
  interface Window {
    pianogameDesktop?: DesktopBridge
  }
}

export function isElectron(): boolean {
  return window.pianogameDesktop?.platform === 'electron'
}

export function exitApp(): void {
  window.pianogameDesktop?.exitApp()
}

export function openExternalUrl(url: string): void {
  window.pianogameDesktop?.openUrl(url)
}
