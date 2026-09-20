import { useEffect, useState } from 'react'
import ChipButton from '../ui/ChipButton'
import Button from '../ui/Button'
import { BASIC_LAND_PRESETS, BASIC_LAND_SETS, countManaPips, suggestBasicLands, getBasicLandLabel, landPrinting, loadBasicLandSet, saveBasicLandSet, type BasicLandPreset } from './deckUtils'
import type { DeckCard } from '../lobby/decks'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import { confirmDialog } from '../ui/confirmDialog'
import { useTranslation } from '../i18n'
import './BasicLandAdder.css'

export function BasicLandAdder({
  cards,
  metaMap,
  format,
  onAddLand,
  onRemoveLand,
  onApplySuggestedLands,
}: {
  cards: DeckCard[]
  metaMap: Map<string, any>
  format: string
  onAddLand: (preset: BasicLandPreset) => void
  onRemoveLand: (preset: BasicLandPreset) => void
  onApplySuggestedLands: (suggested: { name: string; setCode: string; cardNumber: string; amount: number }[]) => void
}) {
  const { t, lang } = useTranslation()
  const isCommander = format === 'Commander'
  const defaultTarget = isCommander ? 36 : (format === 'Limited' ? 17 : 24)
  const [targetCount, setTargetCount] = useState<number>(defaultTarget)
  // El objetivo depende del formato: al cambiarlo se resetea la sugerencia.
  useEffect(() => {
    setTargetCount(defaultTarget)
  }, [defaultTarget])
  const [isOpen, setIsOpen] = useState(false)
  const [landSet, setLandSet] = useState<string>(() => loadBasicLandSet())

  const pips = countManaPips(cards, metaMap)
  const totalPips = pips.W + pips.U + pips.B + pips.R + pips.G

  const withPrinting = (preset: BasicLandPreset): BasicLandPreset => {
    const printing = landPrinting(preset.name, landSet)
    return { ...preset, setCode: printing.setCode, cardNumber: printing.cardNumber }
  }

  const handleLandSetChange = (code: string) => {
    setLandSet(code)
    saveBasicLandSet(code)
  }

  const getLandCount = (name: string): number => {
    const found = cards.find((c) => c.cardName.toLowerCase() === name.toLowerCase())
    return found ? found.amount : 0
  }

  const handleSuggest = async () => {
    const suggested = suggestBasicLands(pips, targetCount, landSet)
    if (suggested.length === 0) return
    const basicNames = new Set(BASIC_LAND_PRESETS.map((p) => p.name.toLowerCase()))
    const currentBasics = cards
      .filter((c) => basicNames.has(c.cardName.toLowerCase()))
      .reduce((sum, c) => sum + c.amount, 0)
    const summary = suggested.map((s) => `${getBasicLandLabel(s.name, lang)} ×${s.amount}`).join(', ')
    const ok = await confirmDialog(
      t('decks', 'builder_basics_replace_confirm', { count: currentBasics, summary }),
    )
    if (!ok) return
    onApplySuggestedLands(suggested)
    setIsOpen(false)
  }

  return (
    <div className="basic-land-adder">
      {/* Compact Quick Bar */}
      <div className="basic-land-quick-row">
        <span className="basic-land-label">{t('decks', 'basic_lands')}:</span>
        <div className="basic-land-buttons">
          {BASIC_LAND_PRESETS.map((preset) => {
            const count = getLandCount(preset.name)
            const label = getBasicLandLabel(preset.name, lang)
            return (
              <div key={preset.name} className="basic-land-btn-group">
                <button
                  type="button"
                  className={`basic-land-btn pip-${preset.color.toLowerCase()}`}
                  onClick={() => onAddLand(withPrinting(preset))}
                  title={`+1 ${label} (${preset.name})`}
                >
                  <ManaPip symbol={preset.symbol} size={16} />
                  <span className="basic-land-btn-name">{label}</span>
                  {count > 0 && <span className="basic-land-btn-count">{count}</span>}
                </button>
                {count > 0 ? (
                  <button
                    type="button"
                    className="basic-land-dec-btn"
                    onClick={() => onRemoveLand(preset)}
                    title={`-1 ${label}`}
                  >
                    -
                  </button>
                ) : (
                  <span className="basic-land-dec-placeholder" aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>

        <ChipButton
          size="sm"
          pill
          className="basic-land-suggest-toggle-btn"
          active={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          title={t('decks', 'basic_lands')}
        >
          <Icon name="wand" size={13} /> {t('decks', 'basic_lands')}
        </ChipButton>
      </div>

      {/* Expandable Auto-Suggester Assistant */}
      {isOpen && (
        <div className="basic-land-suggester-panel">
          <div className="suggester-header">
            <span className="suggester-title">{t('decks', 'basic_lands')}</span>
            <div className="suggester-pips-summary">
              <span>{t('decks', 'builder_mana_pips')}:</span>
              {totalPips > 0 ? (
                <div className="pips-chips">
                  {pips.W > 0 && <span className="pip-chip pip-w"><ManaPip symbol="W" size={14} /> {pips.W}</span>}
                  {pips.U > 0 && <span className="pip-chip pip-u"><ManaPip symbol="U" size={14} /> {pips.U}</span>}
                  {pips.B > 0 && <span className="pip-chip pip-b"><ManaPip symbol="B" size={14} /> {pips.B}</span>}
                  {pips.R > 0 && <span className="pip-chip pip-r"><ManaPip symbol="R" size={14} /> {pips.R}</span>}
                  {pips.G > 0 && <span className="pip-chip pip-g"><ManaPip symbol="G" size={14} /> {pips.G}</span>}
                </div>
              ) : (
                <span className="pips-empty">{t('decks', 'basics_empty')}</span>
              )}
            </div>
          </div>

          <div className="suggester-action-row">
            <label className="suggester-target-label">
              {t('system', 'land_set')}:
              <select
                value={landSet}
                onChange={(e) => handleLandSetChange(e.target.value)}
                className="suggester-input"
                data-testid="land-set-select"
              >
                {BASIC_LAND_SETS.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="suggester-target-label">
              {t('decks', 'builder_lands_target')}:
              <input
                type="number"
                min={1}
                max={99}
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="suggester-input"
              />
            </label>
            <Button variant="success" size="sm"
              disabled={totalPips === 0}
              onClick={handleSuggest}>
              {t('common', 'confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
