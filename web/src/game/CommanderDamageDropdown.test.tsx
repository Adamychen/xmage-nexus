import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameView, PlayerView } from '../net/types'
import { resetCommanderMemory } from '../board/commanders'
import CommanderDamageDropdown from './CommanderDamageDropdown'

function makePlayer(id: string, name: string, controlled: boolean, commanderId?: string, commanderName?: string, dmgTo?: Record<string, number>): PlayerView {
  const commanderObj = commanderId && commanderName
    ? {
        id: commanderId,
        name: commanderName,
        commandObjectType: 'COMMANDER',
        rules: [
          '<b>Commander</b>',
          ...(dmgTo
            ? Object.entries(dmgTo).map(([targetName, amt]) => `<b>Commander</b> did ${amt} combat damage to player ${targetName}.`)
            : []),
        ],
      }
    : null

  return {
    playerId: id,
    name,
    controlled,
    life: 40,
    commandList: commanderObj ? [commanderObj] : [],
    battlefield: commanderObj ? { [commanderId!]: commanderObj } : {},
    graveyard: {},
    exile: {},
  } as unknown as PlayerView
}

describe('CommanderDamageDropdown', () => {
  afterEach(() => {
    cleanup()
    resetCommanderMemory()
  })

  it('PNL-11: renders nothing when no opponent has a commander', () => {
    const me = makePlayer('p1', 'Alice', true, 'cmd-1', 'Atraxa')
    const opp = makePlayer('p2', 'Bob', false)
    const game = { players: [me, opp] } as unknown as GameView

    const { queryByTestId } = render(<CommanderDamageDropdown game={game} player={me} side="my" />)
    expect(queryByTestId('cmd-dmg-toggle-p1')).toBeNull()
  })

  it('PNL-11: opens a dropdown under life listing each opponent, commander and damage received', () => {
    const me = makePlayer('p1', 'Alice', true, 'cmd-1', 'Atraxa')
    const bob = makePlayer('p2', 'Bob', false, 'cmd-2', 'Edgar Markov', { Alice: 16 })
    const cara = makePlayer('p3', 'Cara', false, 'cmd-3', 'Meren of Clan Nel Toth', { Alice: 21 })
    const game = { players: [me, bob, cara] } as unknown as GameView
    const onParentClick = vi.fn()

    const { getByTestId, queryByTestId } = render(
      <div onClick={onParentClick}>
        <CommanderDamageDropdown game={game} player={me} side="my" />
      </div>,
    )

    const toggle = getByTestId('cmd-dmg-toggle-p1')
    expect(toggle.classList.contains('is-lethal')).toBe(true)
    expect(queryByTestId('cmd-dmg-dropdown-p1')).toBeNull()

    fireEvent.click(toggle)
    expect(onParentClick).not.toHaveBeenCalled()

    const dropdown = getByTestId('cmd-dmg-dropdown-p1')
    expect(dropdown.textContent).toContain('Bob')
    expect(dropdown.textContent).toContain('Edgar Markov')
    expect(dropdown.textContent).toContain('16')
    expect(dropdown.textContent).toContain('Cara')
    expect(dropdown.textContent).toContain('Meren of Clan Nel Toth')
    expect(dropdown.textContent).toContain('21')
    expect(dropdown.querySelectorAll('.cmd-dmg-row.is-warning')).toHaveLength(1)
    expect(dropdown.querySelectorAll('.cmd-dmg-row.is-lethal')).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(queryByTestId('cmd-dmg-dropdown-p1')).toBeNull()
  })
})
