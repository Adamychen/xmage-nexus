import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import InviteLinkButton from './InviteLinkButton'

afterEach(() => {
  cleanup()
})

describe('InviteLinkButton', () => {
  it('no renderiza nada sin mesa', () => {
    const { container } = render(<InviteLinkButton tableId={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('renderiza botones de invitar a jugar y a espectar', () => {
    const { getByTestId } = render(<InviteLinkButton tableId="table-1" />)
    expect(getByTestId('invite-copy-join')).not.toBeNull()
    expect(getByTestId('invite-copy-watch')).not.toBeNull()
  })
})
