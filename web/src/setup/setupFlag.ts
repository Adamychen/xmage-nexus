export const SETUP_VERSION = '1'

const SETUP_KEY = 'nexus_setup_v'

export const OPEN_SETUP_EVENT = 'nexus:open-setup'
export const SETUP_CONN_EVENT = 'nexus:setup-conn'

export function isSetupDone(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === SETUP_VERSION
  } catch {
    return false
  }
}

export function markSetupDone(): void {
  try {
    localStorage.setItem(SETUP_KEY, SETUP_VERSION)
  } catch {}
}

export function openSetupWizard(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETUP_EVENT))
}
