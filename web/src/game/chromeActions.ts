import { createContext, useContext } from 'react'
import type { SidePanelTab } from './SidePanel'

export interface ChromeActions {
  openPanel: (tab: SidePanelTab) => void
  sidePanelOpen: boolean
}

export const ChromeActionsContext = createContext<ChromeActions | null>(null)

export function useChromeActions(): ChromeActions | null {
  return useContext(ChromeActionsContext)
}
