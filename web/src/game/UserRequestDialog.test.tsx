// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import UserRequestDialog from './UserRequestDialog'
import { getState, setState } from '../state/store'
import { setGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'

describe('UserRequestDialog (permiso de mano)', () => {
  const send = vi.fn(async (action: string, args?: unknown) => ({ ok: true, action, requestId: 1, args }))

  beforeEach(() => {
    send.mockClear()
    setGateway({ send } as unknown as Gateway)
    setState({
      userRequest: {
        title: 'User request',
        message: 'Allow user X to see your hand cards?',
        gameId: 'g1',
        relatedUserId: '123e4567-e89b-12d3-a456-426614174000',
        buttons: [
          { text: 'Accept', action: 'ADD_PERMISSION_TO_SEE_HAND_CARDS' },
          { text: 'Reject', action: 'DENY_PERMISSION_TO_SEE_HAND_CARDS' },
        ],
      },
    })
  })

  afterEach(() => {
    setState({ userRequest: null, rollbackPendingFor: null })
    setGateway(null)
    cleanup()
  })

  it('Accept envía la acción con el relatedUserId como data', async () => {
    const { getByText } = render(<UserRequestDialog />)
    fireEvent.click(getByText('Accept'))
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    expect(send).toHaveBeenCalledWith('sendPlayerAction', {
      action: 'ADD_PERMISSION_TO_SEE_HAND_CARDS',
      gameId: 'g1',
      data: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
  it('sin relatedUserId envía data undefined (diálogos sin solicitante)', async () => {
    setState({
      userRequest: {
        title: 'T',
        message: 'M',
        gameId: 'g1',
        buttons: [{ text: 'Accept', action: 'SOME_ACTION' }],
      },
    })
    const { getByText } = render(<UserRequestDialog />)
    fireEvent.click(getByText('Accept'))
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    expect(send).toHaveBeenCalledWith('sendPlayerAction', {
      action: 'SOME_ACTION',
      gameId: 'g1',
      data: undefined,
    })
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('Accept de rollback arma la espera de la vista restaurada', async () => {
    setState({
      userRequest: {
        title: 'Request by Hero',
        message: 'Allow rollback to the start of the previous turn?',
        gameId: 'g1',
        relatedUserId: 'u-hero',
        buttons: [
          { text: 'Accept', action: 'ADD_PERMISSION_TO_ROLLBACK_TURN' },
          { text: 'Deny', action: 'DENY_PERMISSION_TO_ROLLBACK_TURN' },
        ],
      },
    })
    const { getByText } = render(<UserRequestDialog />)
    fireEvent.click(getByText('Accept'))
    await vi.waitFor(() => expect(send).toHaveBeenCalled())
    expect(send).toHaveBeenCalledWith('sendPlayerAction', {
      action: 'ADD_PERMISSION_TO_ROLLBACK_TURN',
      gameId: 'g1',
      data: 'u-hero',
    })
    await vi.waitFor(() => expect(getState().rollbackPendingFor).toBe('g1'))
  })
})
