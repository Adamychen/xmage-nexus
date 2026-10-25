import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ConfirmHost from './ConfirmHost'
import { alertDialog, confirmDialog, getConfirmQueue } from './confirmDialog'
import { setLanguage } from '../i18n'

function open(message = '¿Seguro?') {
  render(<ConfirmHost />)
  const pending = confirmDialog(message)
  return pending
}

afterEach(() => {
  cleanup()
})

describe('ConfirmHost / confirmDialog', () => {
  it('aceptar resuelve true y desmonta el modal', async () => {
    setLanguage('es')
    const pending = open()
    expect(await screen.findByTestId('confirm-modal')).not.toBeNull()
    expect(screen.getByTestId('confirm-modal').textContent).toContain('¿Seguro?')
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await expect(pending).resolves.toBe(true)
    expect(getConfirmQueue()).toEqual([])
  })

  it('cancelar resuelve false', async () => {
    const pending = open()
    await screen.findByTestId('confirm-modal')
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'))
    await expect(pending).resolves.toBe(false)
  })

  it('Escape resuelve false', async () => {
    const pending = open()
    await screen.findByTestId('confirm-modal')
    fireEvent.keyDown(window, { key: 'Escape' })
    await expect(pending).resolves.toBe(false)
  })

  it('DLG-12: a destructive confirmation starts on Cancel and any other confirmation starts on its action', async () => {
    render(<ConfirmHost />)
    const destructive = confirmDialog('¿Borrar?', { danger: true })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('confirm-modal-cancel')))
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'))
    await expect(destructive).resolves.toBe(false)

    const plain = confirmDialog('¿Seguro?')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('confirm-modal-ok')))
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await expect(plain).resolves.toBe(true)

    const alert = alertDialog('Sin mazos')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('confirm-modal-ok')))
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await expect(alert).resolves.toBeUndefined()
  })

  it('alertDialog muestra un solo botón y resuelve al pulsarlo', async () => {
    render(<ConfirmHost />)
    const pending = alertDialog('Sin mazos')
    await screen.findByTestId('confirm-modal')
    expect(screen.queryByTestId('confirm-modal-cancel')).toBeNull()
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await expect(pending).resolves.toBeUndefined()
  })
})
