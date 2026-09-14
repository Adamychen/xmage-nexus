import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBanner from './ErrorBanner'
import { setLanguage } from '../i18n'

afterEach(() => {
  cleanup()
})

describe('ErrorBanner', () => {
  it('muestra el mensaje traducido con role=alert', () => {
    setLanguage('es')
    render(<ErrorBanner message="table full" testId="banner" />)
    const banner = screen.getByTestId('banner')
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.textContent).toContain('La mesa ya está completa')
  })

  it('no renderiza nada sin mensaje', () => {
    const { container } = render(<ErrorBanner message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('sin onClose no pinta botón de cerrar', () => {
    render(<ErrorBanner message="table full" testId="banner" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('el botón de cerrar es accesible y llama a onClose', () => {
    setLanguage('es')
    const onClose = vi.fn()
    render(<ErrorBanner message="table full" onClose={onClose} testId="banner" />)
    const close = screen.getByRole('button', { name: 'Cerrar' })
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('conserva saltos de línea y texto largo del servidor', () => {
    render(<ErrorBanner message={'boom line1\nline2'} testId="banner" />)
    expect(screen.getByTestId('banner').textContent).toContain('line2')
  })
})
