import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Icon from './Icon'

describe('Icon component', () => {
  it('renders correctly for known icon names', () => {
    const { container: c1 } = render(<Icon name="skull" size={20} className="custom-icon" />)
    const svg1 = c1.querySelector('svg')
    expect(svg1).not.toBeNull()
    expect(svg1?.getAttribute('width')).toBe('20')
    expect(svg1?.getAttribute('height')).toBe('20')
    expect(svg1?.classList.contains('custom-icon')).toBe(true)

    const { container: c2 } = render(<Icon name="sun" size={16} />)
    expect(c2.querySelector('svg')).not.toBeNull()

    const { container: c3 } = render(<Icon name="moon" size={16} />)
    expect(c3.querySelector('svg')).not.toBeNull()

    const { container: c4 } = render(<Icon name="swords" size={16} />)
    expect(c4.querySelector('svg')).not.toBeNull()
  })

  it('renders null for unknown icon names', () => {
    const { container } = render(<Icon name={'non-existent' as any} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
