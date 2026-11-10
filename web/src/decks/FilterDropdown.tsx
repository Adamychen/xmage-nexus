import type { ReactNode } from 'react'
import Select, { type SelectProps, type SelectValue } from '../ui/Select'

type FilterSelectProps<V extends SelectValue> = Omit<SelectProps<V>, 'summary' | 'aria-label' | 'className' | 'boundary' | 'panelTestId' | 'data-testid'>

export function FilterDropdown<V extends SelectValue>({
  label,
  summary,
  active,
  testId,
  ...select
}: FilterSelectProps<V> & {
  label: string
  summary: ReactNode
  active: boolean
  testId?: string
}) {
  return (
    <div className="arena-filter-dd" data-testid={testId}>
      <span className="arena-chip-label">{label}</span>
      <Select
        {...select}
        aria-label={label}
        summary={<span className="arena-filter-dd-summary">{summary}</span>}
        className={`arena-filter-select arena-filter-dd-trigger${active ? ' is-active' : ''}`}
        boundary=".arena-filter-bar"
        panelTestId={testId ? `${testId}-panel` : undefined}
      />
    </div>
  )
}
