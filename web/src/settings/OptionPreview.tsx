import { ManaPip, parseManaSymbols } from '../decks/ArenaManaSymbols'
import RenderedCard from '../cards/rendered/RenderedCard'
import { showcaseArtUrl } from '../cards/showcaseArt'
import type { CardView } from '../net/types'
import BoardDemo from './BoardDemo'
import '../appearance/playmats.css'
import './OptionPreview.css'

export type OptionPreviewKind = 'handCost' | 'manaSource' | 'rendered' | 'boardFill' | 'boardSpotlight' | 'handRail' | 'handRow' | 'stackCaption'

const HAND_SAMPLE = [
  { name: 'Shivan Dragon', cost: '{4}{R}{R}' },
  { name: 'Counterspell', cost: '{U}{U}' },
  { name: 'Lightning Bolt', cost: '{R}' },
]

const BOARD_SAMPLE = ['Mountain', 'Forest', 'Shivan Dragon']

const RENDERED_SAMPLE = {
  id: 'preview-rendered',
  name: 'Shivan Dragon',
  manaValue: 6,
  rules: ['Flying', '{R}: Shivan Dragon gets +1/+0 until end of turn.'],
  cardTypes: ['CREATURE'],
  subTypes: ['DRAGON'],
  superTypes: [],
  power: '5',
  toughness: '5',
  loyalty: '',
  defense: '',
  color: { white: false, blue: false, black: false, red: true, green: false },
  manaCostLeftStr: ['{4}{R}{R}'],
  manaCostRightStr: [],
  rarity: 'RARE',
} as unknown as CardView

function Art({ name }: { name: string }) {
  const art = showcaseArtUrl(name)
  return art ? <img className="opt-preview-art" src={art} alt="" draggable={false} /> : <span className="opt-preview-art is-blank" />
}

function Tiles({ fill = false }: { fill?: boolean }) {
  return (
    <span className={`opt-preview-zone${fill ? ' is-fill' : ''}`}>
      {BOARD_SAMPLE.map((name) => (
        <span key={name} className="opt-preview-tile">
          <Art name={name} />
        </span>
      ))}
    </span>
  )
}

function HandCostPreview({ on }: { on: boolean }) {
  return (
    <span className="opt-preview-hand">
      {HAND_SAMPLE.map((card) => (
        <span key={card.name} className="opt-preview-hand-card">
          {on && (
            <span className="opt-preview-cost">
              {parseManaSymbols(card.cost).map((sym, i) => (
                <ManaPip key={`${sym}-${i}`} symbol={sym} size={14} />
              ))}
            </span>
          )}
          <Art name={card.name} />
        </span>
      ))}
    </span>
  )
}

function RenderedPreview({ on }: { on: boolean }) {
  return (
    <span className="opt-preview-rendered">
      {on ? <RenderedCard card={RENDERED_SAMPLE} /> : <span className="opt-preview-image-card"><Art name="Shivan Dragon" /></span>}
    </span>
  )
}

function SpotlightPreview({ on }: { on: boolean }) {
  if (on) {
    return (
      <span className="opt-preview-spot">
        <span className="opt-preview-spot-main" />
        <span className="opt-preview-spot-panel">
          <span className="opt-preview-spot-copy" />
          <span className="opt-preview-spot-copy" />
          <span className="opt-preview-spot-copy" />
        </span>
      </span>
    )
  }
  return (
    <span className="opt-preview-spot is-stacked">
      <span className="opt-preview-spot-row">
        <span className="opt-preview-spot-copy" />
        <span className="opt-preview-spot-copy" />
        <span className="opt-preview-spot-copy" />
      </span>
      <span className="opt-preview-spot-main" />
    </span>
  )
}

function HandRailPreview({ on }: { on: boolean }) {
  return (
    <span className="opt-preview-mat" aria-hidden="true">
      <span className="playmat-layer" data-playmat="abyss" />
      {on && (
        <span className="opt-preview-rail">
          {HAND_SAMPLE.map((card) => (
            <span key={card.name} className="opt-preview-rail-card">
              <Art name={card.name} />
            </span>
          ))}
        </span>
      )}
      <Tiles />
    </span>
  )
}

function HandRowPreview({ on }: { on: boolean }) {
  return (
    <span className={`opt-preview-mat${on ? ' opt-preview-with-row' : ''}`} aria-hidden="true">
      <span className="playmat-layer" data-playmat="abyss" />
      <Tiles />
      {on && (
        <span className="opt-preview-row">
          {HAND_SAMPLE.map((card) => (
            <span key={card.name} className="opt-preview-row-card">
              <Art name={card.name} />
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

/**
 * Miniature of one card-display option in one state (on/off). Reuses the real
 * board tile, mana pips, rendered card and board demo so the preview cannot
 * drift from the game; the placement schematics only show layout. Decorative:
 * aria-hidden, not clickable (the choice card owns the interaction).
 */
export default function OptionPreview({ kind, on = true }: { kind: OptionPreviewKind; on?: boolean }) {
  return (
    <div className="opt-preview" data-testid={`option-preview-${kind}-${on ? 'on' : 'off'}`} aria-hidden="true">
      {kind === 'handCost' && <HandCostPreview on={on} />}
      {kind === 'manaSource' && <BoardDemo spec={{ kind: 'manaSource', value: on }} />}
      {kind === 'rendered' && <RenderedPreview on={on} />}
      {kind === 'boardFill' && <Tiles fill={on} />}
      {kind === 'boardSpotlight' && <SpotlightPreview on={on} />}
      {kind === 'handRail' && <HandRailPreview on={on} />}
      {kind === 'handRow' && <HandRowPreview on={on} />}
      {kind === 'stackCaption' && <StackCaptionPreview on={on} />}
    </div>
  )
}

function StackCaptionPreview({ on }: { on: boolean }) {
  return (
    <div className="opt-stack-caption">
      <div className="opt-stack-caption-art" />
      {on && (
        <div className="opt-stack-caption-panel">
          <span className="opt-stack-caption-kind">Disparada</span>
          <span className="opt-stack-caption-rules">You gain 1 life.</span>
        </div>
      )}
    </div>
  )
}
