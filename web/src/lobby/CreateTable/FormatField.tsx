import { useRef, useState } from 'react'
import Button from '../../ui/Button'
import Field from '../../ui/Field'
import Icon from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import FormatGallery, { type GalleryFamily, type GalleryItem } from './FormatGallery'
import { visualOf } from './formatFamily'
import './FormatGallery.css'

/** The item a value belongs to: a plain tile, or one of the mode chips of a grouped item. */
function findEntry(items: GalleryItem[], value: string): { item: GalleryItem; meta?: string } | null {
  for (const item of items) {
    if (item.value === value) return { item, meta: item.meta }
    const mode = item.modes?.find((m) => m.value === value)
    if (mode) return { item, meta: mode.meta }
  }
  return null
}

/** A format or game-type field: shows the current choice as a tile and opens the gallery to change it. */
export default function FormatField({
  label,
  galleryTitle,
  value,
  items,
  families,
  onSelect,
  testId,
}: {
  label: string
  galleryTitle: string
  value: string
  items: GalleryItem[]
  families: GalleryFamily[]
  onSelect: (value: string) => void
  testId: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const entry = findEntry(items, value)
  const visual = entry?.item.visual ?? visualOf(value)

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <Field group label={label}>
      <Button
        ref={triggerRef}
        variant="secondary"
        block
        className="format-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen(true)}
      >
        <span className={`format-trigger-band fg-tile--tone-${visual.tone}`}><Icon name={visual.icon} size={18} /></span>
        <span className="format-trigger-text">
          <span className="format-trigger-value">{value}</span>
          {entry?.meta && <span className="format-trigger-meta">{entry.meta}</span>}
        </span>
        <span className="format-trigger-action">{t('lobby', 'gallery_change')} <Icon name="chevronDown" size={12} /></span>
      </Button>
      {open && (
        <FormatGallery
          title={galleryTitle}
          items={items}
          families={families}
          selected={value}
          onSelect={(v) => { onSelect(v); close() }}
          onClose={close}
        />
      )}
    </Field>
  )
}
