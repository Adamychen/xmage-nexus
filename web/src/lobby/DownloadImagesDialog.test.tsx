import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import DownloadImagesDialog from './DownloadImagesDialog'

describe('DownloadImagesDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all form selectors and symbology button', () => {
    const onClose = vi.fn()
    const { getByText, getByLabelText, getAllByText } = render(<DownloadImagesDialog onClose={onClose} />)

    expect(getByText(/Descargar Imágenes y Símbolos/i)).not.toBeNull()
    expect(getByLabelText(/Fuente de descarga/i)).not.toBeNull()
    expect(getByLabelText(/Expansión \/ Alcance/i)).not.toBeNull()
    expect(getByLabelText(/Hilos concurrentes/i)).not.toBeNull()
    expect(getByText(/Descargar Símbolos/i)).not.toBeNull()
    expect(getAllByText(/Iniciar Descarga/i).length).toBeGreaterThan(0)
  })

  it('triggers onClose when clicking close button', () => {
    const onClose = vi.fn()
    const { getByLabelText } = render(<DownloadImagesDialog onClose={onClose} />)
    const closeBtn = getByLabelText('Cerrar ventana')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
