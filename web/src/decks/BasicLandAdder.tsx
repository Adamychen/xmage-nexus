import { useState } from 'react'
import { BASIC_LAND_PRESETS, countManaPips, suggestBasicLands, type BasicLandPreset } from './deckUtils'
import type { DeckCard } from '../lobby/decks'
import { ManaPip } from './ArenaManaSymbols'
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
  const { t } = useTranslation()
  const isCommander = format === 'Commander'
  const defaultTarget = isCommander ? 36 : (format === 'Limited' ? 17 : 24)
  const [targetCount, setTargetCount] = useState<number>(defaultTarget)
  const [isOpen, setIsOpen] = useState(false)

  const pips = countManaPips(cards, metaMap)
  const totalPips = pips.W + pips.U + pips.B + pips.R + pips.G

  const getLandCount = (name: string): number => {
    const found = cards.find((c) => c.cardName.toLowerCase() === name.toLowerCase())
    return found ? found.amount : 0
  }

  const handleSuggest = () => {
    const suggested = suggestBasicLands(pips, targetCount)
    if (suggested.length > 0) {
      onApplySuggestedLands(suggested)
      setIsOpen(false)
    }
  }

  return (
    <div className="basic-land-adder">
      {/* Compact Quick Bar */}
      <div className="basic-land-quick-row">
        <span className="basic-land-label">{t('decks', 'basic_lands')}:</span>
        <div className="basic-land-buttons">
          {BASIC_LAND_PRESETS.map((preset) => {
            const count = getLandCount(preset.name)
            return (
              <div key={preset.name} className="basic-land-btn-group">
                <button
                  type="button"
                  className={`basic-land-btn pip-${preset.color.toLowerCase()}`}
                  onClick={() => onAddLand(preset)}
                  title={`+1 ${preset.label} (${preset.name})`}
                >
                  <ManaPip symbol={preset.symbol} size={16} />
                  <span className="basic-land-btn-name">{preset.label}</span>
                  {count > 0 && <span className="basic-land-btn-count">{count}</span>}
                </button>
                {count > 0 && (
                  <button
                    type="button"
                    className="basic-land-dec-btn"
                    onClick={() => onRemoveLand(preset)}
                    title={`-1 ${preset.label}`}
                  >
                    -
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className={`basic-land-suggest-toggle-btn ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title={t('decks', 'basic_lands')}
        >
          🪄 {t('decks', 'basic_lands')}
        </button>
      </div>

      {/* Expandable Auto-Suggester Assistant */}
      {isOpen && (
        <div className="basic-land-suggester-panel">
          <div className="suggester-header">
            <span className="suggester-title">{t('decks', 'basic_lands')}</span>
            <div className="suggester-pips-summary">
              <span>{t('decks', 'mana_curve')}:</span>
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
              {t('decks', 'total_cards')}:
              <input
                type="number"
                min={1}
                max={99}
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="suggester-input"
              />
            </label>
            <button
              type="button"
              className="suggester-apply-btn"
              disabled={totalPips === 0}
              onClick={handleSuggest}
            >
              {t('common', 'confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
