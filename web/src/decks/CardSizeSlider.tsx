import { useTranslation } from '../i18n'
import './CardSizeSlider.css'

export function CardSizeSlider({ value, min, max, step, onChange, className }: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  className?: string
}) {
  const { t } = useTranslation()
  const label = t('decks', 'grid_size')
  return (
    <div className={className ? `card-size-control ${className}` : 'card-size-control'}>
      <span className="card-size-label">{label}</span>
      <input
        type="range"
        className="arena-grid-size-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={`${value}%`}
        title={`${label}: ${value}%`}
      />
      <span className="arena-grid-size-value">{value}%</span>
    </div>
  )
}
