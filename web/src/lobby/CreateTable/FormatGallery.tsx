import { useMemo, useRef, useState, type MouseEvent } from 'react'
import DialogShell from '../../ui/DialogShell'
import Button from '../../ui/Button'
import ChipButton from '../../ui/ChipButton'
import Icon, { type IconName } from '../../ui/Icon'
import { clickableProps } from '../../ui/clickable'
import { usePointerTilt } from '../../ui/usePointerTilt'
import { useCardArtUrl } from '../../decks/useCardArtUrl'
import { useTranslation } from '../../i18n'
import type { DescGroup, FormatVisual } from './formatFamily'
import './FormatGallery.css'

export interface GalleryMode {
  value: string
  label: string
  meta?: string
}

export interface GalleryItem {
  /** The value this tile selects. Grouped items (with `modes`) select through their mode chips instead. */
  value: string
  label: string
  family: string
  visual: FormatVisual
  meta?: string
  modes?: GalleryMode[]
}

export interface GalleryFamily {
  id: string
  label: string
  icon: IconName
}

type DescKey =
  | 'format_desc_duel' | 'format_desc_multi' | 'format_desc_commander' | 'format_desc_oathbreaker'
  | 'format_desc_brawl' | 'format_desc_tiny' | 'format_desc_highlander' | 'format_desc_momir'
  | 'format_desc_penny' | 'format_desc_freeform' | 'format_desc_pauper' | 'format_desc_limited'
  | 'format_desc_block' | 'format_desc_constructed'

const DESC_KEY: Record<DescGroup, DescKey> = {
  duel: 'format_desc_duel',
  multi: 'format_desc_multi',
  commander: 'format_desc_commander',
  oathbreaker: 'format_desc_oathbreaker',
  brawl: 'format_desc_brawl',
  tiny: 'format_desc_tiny',
  highlander: 'format_desc_highlander',
  momir: 'format_desc_momir',
  penny: 'format_desc_penny',
  freeform: 'format_desc_freeform',
  pauper: 'format_desc_pauper',
  limited: 'format_desc_limited',
  block: 'format_desc_block',
  constructed: 'format_desc_constructed',
}

/**
 * Double-click (or Enter on the choose button) picks a format; a single click or a right-click only
 * reads about it in the footer, so browsing the catalogue never changes the table by accident.
 */
export default function FormatGallery({
  title,
  items,
  families,
  selected,
  onSelect,
  onClose,
}: {
  title: string
  items: GalleryItem[]
  families: GalleryFamily[]
  selected: string
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<string>('all')
  /** The item the footer describes. */
  const [inspected, setInspected] = useState<string | null>(null)
  /** The value the Choose button will select: the current one, or the mode last picked in a grouped card. */
  const [pending, setPending] = useState(selected)
  const gridRef = useRef<HTMLDivElement>(null)
  usePointerTilt(gridRef, '.fg-tile')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (family !== 'all' && item.family !== family) return false
      if (q === '') return true
      const haystack = [item.label, ...(item.modes ?? []).map((m) => m.value)].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, family, query])

  const sections = families
    .map((f) => ({ family: f, items: visible.filter((item) => item.family === f.id) }))
    .filter((s) => s.items.length > 0)

  const countOf = (id: string) => items.filter((item) => item.family === id).length
  const inspectedItem = items.find((item) => item.value === inspected) ?? null

  const inspect = (item: GalleryItem) => {
    setInspected(item.value)
    if (!item.modes) setPending(item.value)
    else if (!item.modes.some((m) => m.value === pending)) setPending(item.modes[0].value)
  }

  const choose = (value: string) => onSelect(value)

  const footer = (
    <div className="fg-footer">
      <div className="fg-info" aria-live="polite">
        {inspectedItem ? (
          <>
            <span className="fg-info-title">{inspectedItem.label || t('lobby', 'family_classic')}</span>
            <span className="fg-info-text">{t('lobby', DESC_KEY[inspectedItem.visual.group])}</span>
          </>
        ) : (
          <span className="fg-info-text fg-info-hint">{t('lobby', 'gallery_inspect_hint')}</span>
        )}
      </div>
      <div className="fg-footer-actions">
        <Button variant="ghost" onClick={onClose}>{t('common', 'cancel')}</Button>
        <Button variant="primary" onClick={() => choose(pending)}>{t('lobby', 'gallery_choose')}</Button>
      </div>
    </div>
  )

  return (
    <DialogShell
      labelledBy="format-gallery-title"
      titleId="format-gallery-title"
      size="lg"
      ornate
      legacyPanelClass="format-gallery"
      title={title}
      actions={footer}
      onClose={onClose}
      onEscape={onClose}
    >
      <div className="fg-toolbar">
        <input
          type="search"
          className="fg-search"
          value={query}
          placeholder={t('lobby', 'gallery_search')}
          aria-label={t('lobby', 'gallery_search')}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="fg-filters" role="group" aria-label={title}>
          <ChipButton pill size="sm" active={family === 'all'} onClick={() => setFamily('all')}>
            {t('lobby', 'gallery_all')} · {items.length}
          </ChipButton>
          {families.filter((f) => countOf(f.id) > 0).map((f) => (
            <ChipButton key={f.id} pill size="sm" active={family === f.id} onClick={() => setFamily(f.id)}>
              {f.label} · {countOf(f.id)}
            </ChipButton>
          ))}
        </div>
      </div>

      <div ref={gridRef} className="fg-body">
        {sections.length === 0 && (
          <div className="wizard-hint-box">{t('lobby', 'gallery_empty')}</div>
        )}
        {sections.map((section) => (
          <section key={section.family.id} className="fg-section">
            <h4 className="fg-section-title">
              <Icon name={section.family.icon} size={13} /> {section.family.label}
            </h4>
            <div className="fg-grid" role="group" aria-label={section.family.label}>
              {section.items.map((item) => (
                <GalleryTile
                  key={item.value}
                  item={item}
                  selected={selected}
                  pending={pending}
                  inspected={inspected === item.value}
                  onInspect={() => inspect(item)}
                  onDescribe={() => setInspected(item.value)}
                  onPickMode={(value) => { setPending(value); setInspected(item.value) }}
                  onChoose={choose}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DialogShell>
  )
}

function GalleryTile({
  item,
  selected,
  pending,
  inspected,
  onInspect,
  onDescribe,
  onPickMode,
  onChoose,
}: {
  item: GalleryItem
  selected: string
  pending: string
  inspected: boolean
  onInspect: () => void
  onDescribe: () => void
  onPickMode: (value: string) => void
  onChoose: (value: string) => void
}) {
  const art = useCardArtUrl(item.visual.art ? { cardName: item.visual.art } : null)
  const isCurrent = item.modes ? item.modes.some((m) => m.value === selected) : item.value === selected
  const className = `fg-tile fg-tile--tone-${item.visual.tone} ${isCurrent ? 'current' : ''} ${inspected ? 'inspected' : ''}`
  const band = (
    <span className="fg-tile-band">
      {art && <img className="fg-tile-art" src={art} alt="" loading="lazy" />}
      <span className="fg-tile-icon"><Icon name={item.visual.icon} size={28} /></span>
      {isCurrent && <span className="fg-tile-check"><Icon name="check" size={13} /></span>}
    </span>
  )
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    onDescribe()
  }

  if (item.modes) {
    return (
      <div
        className={`${className} fg-tile--modes`}
        data-value={item.value}
        onClick={onInspect}
        onDoubleClick={() => onChoose(item.modes!.some((m) => m.value === pending) ? pending : item.modes![0].value)}
        onContextMenu={onContextMenu}
      >
        {band}
        <span className="fg-tile-name" title={item.label}>{item.label}</span>
        <span className="fg-tile-modes" role="group" aria-label={item.label}>
          {item.modes.map((mode) => (
            <ChipButton
              key={mode.value}
              pill
              size="sm"
              active={pending === mode.value}
              data-value={mode.value}
              onClick={(e) => { e.stopPropagation(); onPickMode(mode.value) }}
              onDoubleClick={(e) => { e.stopPropagation(); onChoose(mode.value) }}
            >
              {mode.label}
              {mode.meta && <span className="fg-mode-meta">{mode.meta}</span>}
            </ChipButton>
          ))}
        </span>
      </div>
    )
  }

  return (
    <div
      {...clickableProps(onInspect)}
      onClick={onInspect}
      onDoubleClick={() => onChoose(item.value)}
      onContextMenu={onContextMenu}
      aria-pressed={isCurrent}
      data-value={item.value}
      className={className}
    >
      {band}
      <span className="fg-tile-name" title={item.label}>{item.label}</span>
      {item.meta && <span className="fg-tile-meta">{item.meta}</span>}
    </div>
  )
}
