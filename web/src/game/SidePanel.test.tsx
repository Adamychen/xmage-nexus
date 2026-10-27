import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidePanel, { type SidePanelTab } from './SidePanel'
import { setState } from '../state/store'

interface HarnessProps {
  tab?: SidePanelTab
  commanders?: boolean
  mechanics?: number
  onTabChange?: (tab: SidePanelTab) => void
  onClose?: () => void
}

function renderPanel({ tab = 'log', commanders = false, mechanics = 0, onTabChange = vi.fn(), onClose = vi.fn() }: HarnessProps = {}) {
  const view = render(
    <SidePanel
      tab={tab}
      onTabChange={onTabChange}
      onClose={onClose}
      hasCommanders={commanders}
      hasActiveMechanics={mechanics > 0}
      mechanicsCount={mechanics}
    />,
  )
  return { ...view, onTabChange, onClose }
}

describe('SidePanel header', () => {
  beforeEach(() => {
    setState({ log: [], game: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('PNL-1: every visible tab is an icon button named by its title, without commanders the commander tab is absent', () => {
    const { container, queryByTestId } = renderPanel()
    const tabs = [...container.querySelectorAll<HTMLElement>('.side-panel-tabs [role="tab"]')]
    expect(tabs.map((el) => el.getAttribute('data-testid'))).toEqual([
      'side-panel-tab-log',
      'side-panel-tab-chat',
      'side-panel-tab-tracker',
      'side-panel-tab-mechanics',
    ])
    for (const el of tabs) {
      expect(el.tagName).toBe('BUTTON')
      expect(el.querySelector('svg')).not.toBeNull()
      expect(el.getAttribute('aria-label')).toBeTruthy()
      expect(el.getAttribute('aria-label')).toBe(el.getAttribute('title'))
    }
    expect(queryByTestId('side-panel-tab-commander')).toBeNull()
  })

  it('PNL-1: the commander tab appears when the game has commanders', () => {
    const { getByTestId } = renderPanel({ commanders: true })
    expect(getByTestId('side-panel-tab-commander').getAttribute('role')).toBe('tab')
  })

  it('PNL-1: only the selected tab has aria-selected and the gold selected state', () => {
    const { getByTestId } = renderPanel({ tab: 'tracker' })
    expect(getByTestId('side-panel-tab-tracker').getAttribute('aria-selected')).toBe('true')
    expect(getByTestId('side-panel-tab-tracker').className).toContain('is-active')
    expect(getByTestId('side-panel-tab-log').getAttribute('aria-selected')).toBe('false')
    expect(getByTestId('side-panel-tab-mechanics').getAttribute('aria-selected')).toBe('false')
  })

  it('PNL-1: the mechanics badge shows the number of active mechanics passed in, not a star', () => {
    const { getByTestId } = renderPanel({ mechanics: 3 })
    expect(getByTestId('mechanics-count').textContent).toBe('3')
    expect(getByTestId('side-panel-tab-mechanics').contains(getByTestId('mechanics-count'))).toBe(true)
  })

  it('PNL-1: clicking a tab asks for that tab', () => {
    const { getByTestId, onTabChange } = renderPanel({ tab: 'log' })
    fireEvent.click(getByTestId('side-panel-tab-mechanics'))
    expect(onTabChange).toHaveBeenCalledWith('mechanics')
  })

  it('PNL-1: the arrow keys move to the neighbouring tab', () => {
    const { getByTestId, onTabChange } = renderPanel({ tab: 'log' })
    fireEvent.keyDown(getByTestId('side-panel-tab-log'), { key: 'ArrowRight' })
    expect(onTabChange).toHaveBeenLastCalledWith('chat')
    fireEvent.keyDown(getByTestId('side-panel-tab-log'), { key: 'ArrowLeft' })
    expect(onTabChange).toHaveBeenLastCalledWith('mechanics')
  })

  it('PNL-1: the close button is inside the header and calls onClose', () => {
    const { container, onClose } = renderPanel()
    const close = container.querySelector<HTMLButtonElement>('.side-panel-head .side-panel-close')
    expect(close).not.toBeNull()
    expect(close!.getAttribute('aria-label')).toBeTruthy()
    fireEvent.click(close!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('PNL-1: the title bar names the active tab in a heading and keeps the head slot', () => {
    const { container, getByTestId } = renderPanel({ tab: 'chat' })
    const heading = container.querySelector('.side-panel-title h2')
    expect(heading?.textContent).toBe(getByTestId('side-panel-tab-chat').getAttribute('title'))
    expect(container.querySelector('.side-panel-title [data-testid="game-drawer-head-actions"]')).not.toBeNull()
  })
})
