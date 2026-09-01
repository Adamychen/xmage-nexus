import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import DownloadImagesDialog from './DownloadImagesDialog'

describe('DownloadImagesDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all form selectors and symbology button', () => {
    const onClose = vi.fn()
    const { getByLabelText, getAllByText } = render(<DownloadImagesDialog onClose={onClose} />)

    expect(getAllByText(/Descargar Imágenes y Símbolos/i).length).toBeGreaterThan(0)
    expect(getByLabelText(/Fuente de descarga/i)).not.toBeNull()
    expect(getByLabelText(/Expansión \/ Alcance/i)).not.toBeNull()
    expect(getByLabelText(/Hilos concurrentes/i)).not.toBeNull()
    expect(getAllByText(/Descargar Símbolos/i).length).toBeGreaterThan(0)
    expect(getAllByText(/Iniciar Descarga/i).length).toBeGreaterThan(0)
  })

  it('triggers onClose when clicking close button', () => {
    const onClose = vi.fn()
    const { getByLabelText } = render(<DownloadImagesDialog onClose={onClose} />)
    const closeBtn = getByLabelText('Cerrar')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
