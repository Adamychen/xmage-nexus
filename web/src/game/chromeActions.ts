import { createContext, useContext } from 'react'

export interface ChromeActions {
  sidePanelOpen: boolean
}

export const ChromeActionsContext = createContext<ChromeActions | null>(null)

export function useChromeActions(): ChromeActions | null {
  return useContext(ChromeActionsContext)
}
