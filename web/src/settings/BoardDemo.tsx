import CardSlot from '../board/CardSlot'
import type { KeywordAuraMode, KeywordIconSet, PtBadgeMode, SicknessStyle } from '../board/cardOverlays'
import type { CardStyle, TapStyle } from '../board/compactCard'
import { showcaseArtUrl } from '../cards/showcaseArt'
import type { PermanentView } from '../net/types'
import '../appearance/playmats.css'
import './BoardDemo.css'

export type BoardDemoSpec =
  | { kind: 'cardStyle'; value: CardStyle }
  | { kind: 'tapStyle'; value: TapStyle }
  | { kind: 'ptBadge'; value: PtBadgeMode }
  | { kind: 'sickness'; value: SicknessStyle }
  | { kind: 'keywordIcons'; value: KeywordIconSet }
  | { kind: 'keywordAura'; value: KeywordAuraMode }
  | { kind: 'manaSource'; value: boolean }

interface Tile {
  perm: PermanentView
  showPt?: boolean
}

const makePermanent = (partial: Partial<PermanentView> & { name: string }): PermanentView => ({
  cardTypes: ['Creature'],
  manaValue: 0,
  expansionSetCode: 'TEST',
  cardNumber: '0',
  ...partial,
})

const creature = (name: string, extra: Partial<PermanentView> = {}): PermanentView =>
  makePermanent({ id: `demo-${name}`, name, cardTypes: ['Creature'], power: '4', toughness: '4', originalPower: '4', originalToughness: '4', ...extra })

const land = (name: string, extra: Partial<PermanentView> = {}): PermanentView =>
  makePermanent({ id: `demo-${name}`, name, cardTypes: ['Land'], subTypes: [name], ...extra })

function tilesFor(spec: BoardDemoSpec): Tile[] {
  switch (spec.kind) {
    case 'cardStyle':
      return [
        { perm: land('Forest') },
        { perm: creature('Tarmogoyf', { power: '3', toughness: '4', originalPower: '3', originalToughness: '4' }), showPt: true },
        { perm: makePermanent({ id: 'demo-Sol Ring', name: 'Sol Ring', cardTypes: ['Artifact'], rules: ['{T}: Add {C}{C}.'] }) },
      ]
    case 'tapStyle':
      return [
        { perm: land('Mountain', { tapped: true }) },
        { perm: land('Island', { tapped: true }) },
        { perm: land('Forest') },
      ]
    case 'ptBadge':
      return [
        { perm: creature('Shivan Dragon', { power: '5', toughness: '5', originalPower: '5', originalToughness: '5' }), showPt: true },
        { perm: creature('Sentinel Spider', { power: '6', toughness: '6', originalPower: '4', originalToughness: '4' }), showPt: true },
      ]
    case 'sickness':
      return [
        { perm: creature('Shivan Dragon', { power: '5', toughness: '5', originalPower: '5', originalToughness: '5' }), showPt: true },
        { perm: creature('Sentinel Spider', { summoningSickness: true }), showPt: true },
      ]
    case 'keywordIcons':
      return [
        { perm: creature('Shivan Dragon', { rules: ['Flying, haste'] }) },
        { perm: creature('Sentinel Spider', { rules: ['Deathtouch, lifelink'] }) },
        { perm: creature('Tarmogoyf', { rules: ['Trample, hexproof'] }) },
        { perm: creature('Birds of Paradise', { rules: ['Indestructible'] }) },
      ]
    case 'keywordAura':
      return [
        { perm: creature('Shivan Dragon', { power: '5', toughness: '5', originalPower: '5', originalToughness: '5', rules: ['Flying'] }), showPt: true },
        { perm: creature('Sentinel Spider', { rules: ['Deathtouch'] }), showPt: true },
        { perm: creature('Tarmogoyf', { power: '3', toughness: '4', originalPower: '3', originalToughness: '4', rules: ['Indestructible'] }), showPt: true },
      ]
    case 'manaSource':
      return [
        { perm: land('Forest', { rules: ['{T}: Add {G}.'] }) },
        { perm: creature('Birds of Paradise', { power: '0', toughness: '1', originalPower: '0', originalToughness: '1', rules: ['{T}: Add one mana of any color.'] }) },
        { perm: creature('Shivan Dragon', { power: '5', toughness: '5', originalPower: '5', originalToughness: '5' }), showPt: true },
      ]
  }
}

/**
 * Decorative miniature of one board option: real `CardSlot`s (so the preview
 * cannot drift from the board) fed with local showcase art and with the
 * option's value passed as an override, never through the global settings.
 * aria-hidden and not clickable: the parent card owns the interaction.
 */
export default function BoardDemo({ spec }: { spec: BoardDemoSpec }) {
  const compact = spec.kind === 'cardStyle' ? spec.value === 'compact' : false
  const tilted = spec.kind === 'tapStyle' && spec.value === 'tilted'
  const showManaSource = spec.kind === 'manaSource' && spec.value
  const demo = (name: string) => ({
    artUrl: showcaseArtUrl(name),
    ptBadgeMode: spec.kind === 'ptBadge' ? spec.value : undefined,
    sicknessStyle: spec.kind === 'sickness' ? spec.value : undefined,
    keywordIcons: spec.kind === 'keywordIcons' ? spec.value : undefined,
    keywordAura: spec.kind === 'keywordAura' ? spec.value : undefined,
  })
  return (
    <span
      className={`board-demo board-zone${compact ? ' card-style-compact' : ''}${tilted ? ' tap-tilted' : ''}`}
      data-testid={`board-demo-${spec.kind}-${spec.value}`}
      aria-hidden="true"
    >
      <span className="playmat-layer board-demo-mat" data-playmat="abyss" />
      <span className="board-demo-row">
        {tilesFor(spec).map(({ perm, showPt }) => (
          <CardSlot
            key={perm.id}
            card={perm}
            tapped={perm.tapped === true}
            showPt={showPt}
            compact={compact}
            showManaSource={showManaSource}
            keywordAura={spec.kind === 'keywordAura'}
            demo={demo(perm.name)}
          />
        ))}
      </span>
    </span>
  )
}
