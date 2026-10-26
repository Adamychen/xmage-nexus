import type { CSSProperties } from 'react'
import CardSlot from '../board/CardSlot'
import { ManaPip, parseManaSymbols } from '../decks/ArenaManaSymbols'
import { showcaseArtUrl } from '../cards/showcaseArt'
import { CUSTOM_PLAYMAT_ID, effectivePlaymat } from '../appearance/playmats'
import { useCustomPlaymat } from '../appearance/customPlaymat'
import { useSettings } from '../state/store'
import { useTranslation } from '../i18n'
import type { PermanentView } from '../net/types'
import '../appearance/playmats.css'
import './BoardDemo.css'
import './BoardLivePreview.css'

const permanent = (partial: Partial<PermanentView> & { name: string }): PermanentView => ({
  id: `live-${partial.name}`,
  cardTypes: ['Creature'],
  manaValue: 0,
  expansionSetCode: 'TEST',
  cardNumber: '0',
  ...partial,
})

const FIELD: PermanentView[] = [
  permanent({ name: 'Shivan Dragon', tapped: true, power: '5', toughness: '5', originalPower: '5', originalToughness: '5', rules: ['Flying'] }),
  permanent({ name: 'Tarmogoyf', power: '4', toughness: '5', originalPower: '3', originalToughness: '4', summoningSickness: true, rules: ['Trample'] }),
  permanent({ name: 'Birds of Paradise', power: '0', toughness: '1', originalPower: '0', originalToughness: '1', rules: ['Flying', '{T}: Add one mana of any color.'] }),
]

const HAND = [
  { name: 'Lightning Bolt', cost: '{R}' },
  { name: 'Counterspell', cost: '{U}{U}' },
]

/**
 * SET-7: your battlefield and hand drawn by the real `CardSlot` with the
 * player's current board settings and playmat, so every choice in the Board
 * section shows up here as soon as it is made. Decorative: aria-hidden.
 */
export default function BoardLivePreview() {
  const { t } = useTranslation()
  const settings = useSettings()
  const customPlaymat = useCustomPlaymat()
  const playmatId = effectivePlaymat(settings.playmatId, customPlaymat)
  const compact = settings.cardStyle === 'compact'
  const matStyle = playmatId === CUSTOM_PLAYMAT_ID && customPlaymat ? ({ '--mat-img': `url("${customPlaymat}")` } as CSSProperties) : undefined
  const demo = (name: string) => ({
    artUrl: showcaseArtUrl(name),
    ptBadgeMode: settings.ptBadgeMode,
    sicknessStyle: settings.sicknessStyle,
    keywordIcons: settings.keywordIcons,
    keywordAura: settings.keywordAura,
  })
  return (
    <figure className="board-live-preview" data-testid="board-live-preview">
      <figcaption className="settings-group-title">{t('lobby', 'settings_live_preview')}</figcaption>
      <span
        className={`board-live-stage board-surface board-zone${compact ? ' card-style-compact' : ''}${settings.tapStyle === 'tilted' ? ' tap-tilted' : ''}`}
        data-playmat={playmatId}
        aria-hidden="true"
      >
        <span className="playmat-layer board-live-mat" data-playmat={playmatId} style={matStyle} />
        <span className="board-live-row">
          {FIELD.map((perm) => (
            <CardSlot
              key={perm.id}
              card={perm}
              tapped={perm.tapped === true}
              showPt={perm.cardTypes?.includes('Creature')}
              compact={compact}
              showManaSource={settings.showManaSource}
              keywordAura
              demo={demo(perm.name)}
            />
          ))}
        </span>
        <span className="board-live-hand">
          {HAND.map((card) => {
            const art = showcaseArtUrl(card.name)
            return (
              <span key={card.name} className="board-live-hand-card" data-testid="board-live-hand-card">
                {settings.showHandCost && (
                  <span className="board-live-cost" data-testid="board-live-cost">
                    {parseManaSymbols(card.cost).map((sym, i) => (
                      <ManaPip key={`${sym}-${i}`} symbol={sym} size={14} />
                    ))}
                  </span>
                )}
                {art ? <img src={art} alt="" draggable={false} /> : null}
              </span>
            )
          })}
        </span>
      </span>
      <p className="settings-group-hint">{t('lobby', 'settings_live_preview_caption')}</p>
    </figure>
  )
}
