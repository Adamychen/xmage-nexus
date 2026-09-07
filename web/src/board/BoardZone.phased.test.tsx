// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import BoardZone from './BoardZone'
import { setState } from '../state/store'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

describe('BoardZone phasedIn (G12-4)', () => {
  beforeEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
  })
  afterEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
    cleanup()
  })

  function zone(phasedIn?: boolean) {
    const player = makePlayer({
      playerId: 'p1',
      name: 'Alice',
      controlled: true,
      battlefield: {
        'ph-1': makePermanent({ name: 'Phased Out Guy', parentId: 'ph-1', phasedIn }),
        'ok-1': makePermanent({ name: 'Steady Guy', parentId: 'ok-1' }),
      },
    })
    setState({ game: makeGameView({ players: [player] }) as never })
    return render(<BoardZone player={player} />)
  }

  it('oculta el permanente faseado y muestra el resto', () => {
    const { queryByText } = zone(false)
    expect(queryByText('Phased Out Guy')).toBeNull()
    expect(queryByText('Steady Guy')).not.toBeNull()
  })

  it('sin flag (undefined) se muestra como faseado-dentro', () => {
    const { queryByText } = zone(undefined)
    expect(queryByText('Phased Out Guy')).not.toBeNull()
  })

  it('phasedIn true se muestra', () => {
    const { queryByText } = zone(true)
    expect(queryByText('Phased Out Guy')).not.toBeNull()
  })
})
