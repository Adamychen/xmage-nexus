import { useState, useMemo } from 'react'
import type { CardView, PlayerView } from '../net/types'
import PileOverlay from '../board/PileOverlay'
import CrossZoneOverlay from '../board/CrossZoneOverlay'
import { crossZoneCounts } from '../board/crossZone'
import type { CrossZonePlayable } from '../board/crossZone'
import CardSlot from '../board/CardSlot'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './ResourceBar.css'

const MANA_COLORS: Array<{ key: keyof PlayerView['manaPool']; symbol: string; className: string }> = [
    { key: 'white', symbol: 'W', className: 'mana-w' },
    { key: 'blue', symbol: 'U', className: 'mana-u' },
    { key: 'black', symbol: 'B', className: 'mana-b' },
    { key: 'red', symbol: 'R', className: 'mana-r' },
    { key: 'green', symbol: 'G', className: 'mana-g' },
    { key: 'colorless', symbol: 'C', className: 'mana-c' },
]

const CARD_BACK_URL = 'https://cards.scryfall.io/back.png'

interface ResourceBarProps {
  player: PlayerView
  side: 'opp' | 'my'
  compact?: boolean
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
  onCardHover?: (card: any, rect?: DOMRect) => void
}

function extractCards(cardsView: unknown): CardView[] {
  if (!cardsView || typeof cardsView !== 'object') return []
  if (Array.isArray(cardsView)) return cardsView.filter(Boolean) as CardView[]
  return Object.values(cardsView).filter(Boolean) as CardView[]
}

export default function ResourceBar({ player, side, compact = false, crossZonePlayables, onPlayCrossZone, onCardHover }: ResourceBarProps) {
  const { t } = useTranslation()
  const [manaOpen, setManaOpen] = useState(false)
  const [openPile, setOpenPile] = useState<'graveyard' | 'exile' | 'crosszone' | 'library' | null>(null)
  const pool = player.manaPool ?? {}
  const manaTotal = MANA_COLORS.reduce((sum, c) => sum + (pool[c.key] ?? 0), 0)

  const graveyardCards = useMemo(() => extractCards(player.graveyard), [player.graveyard])
  const graveyardCount = graveyardCards.length
  const topGraveyardCard = useMemo(() => (graveyardCards.length > 0 ? graveyardCards[graveyardCards.length - 1] : null), [graveyardCards])

  const exileCards = useMemo(() => extractCards(player.exile), [player.exile])
  const exileCount = exileCards.length
  const topExileCard = useMemo(() => (exileCards.length > 0 ? exileCards[exileCards.length - 1] : null), [exileCards])

  const crossZone = crossZonePlayables ?? []
  const counts = useMemo(() => crossZoneCounts(crossZone), [crossZone])
  const topCrossZoneCard = useMemo(() => (crossZone.length > 0 ? crossZone[0].card : null), [crossZone])

  const playableByZone = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const p of crossZone) {
      const key = p.zone === 'graveyard' ? 'graveyard' : p.zone === 'library' ? 'library' : 'exile'
      if (!map[key]) map[key] = new Set()
      map[key].add(p.id)
    }
    return map
  }, [crossZone])

  const libraryCards = useMemo(() => {
    const res: Record<string, any> = {}
    const count = player.libraryCount ?? 0
    if (count <= 0) return res

    if (player.topCard) {
      const topId = player.topCard.id || `lib-top-${player.playerId}`
      res[topId] = {
        ...player.topCard,
        id: topId,
        faceDown: false,
      }
    }

    const startIndex = player.topCard ? 2 : 1
    for (let i = startIndex; i <= count; i++) {
      const id = `lib-${player.playerId}-${i}`
      res[id] = {
        id,
        name: `Card #${i}`,
        manaValue: 0,
        expansionSetCode: '',
        cardNumber: '0',
        faceDown: true,
      }
    }
    return res
  }, [player.libraryCount, player.topCard, player.playerId])

  return (
      <div className={`resource-bar ${side} ${compact ? 'compact' : ''}`}>
       <div className="resource-mana-wrap">
         <button
           type="button"
           className="resource-mana"
           onClick={() => setManaOpen((v) => !v)}
           title={t('game', 'mana_title')}
         >
           <span className="mana-total">{manaTotal}</span>
           <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
         </button>
         {manaOpen && (
           <div className="mana-breakdown">
             {MANA_COLORS.map((c) => (
               <div key={c.key} className={`mana-pip ${c.className}`}>
                 <span className="mana-symbol">{c.symbol}</span>
                 <span className="mana-count">{pool[c.key] ?? 0}</span>
               </div>
             ))}
           </div>
         )}
       </div>

       <div className="resource-piles">
         <button
           type="button"
           className={`resource-stack library-stack clickable-pile ${player.topCard ? 'has-top-revealed' : ''}`}
           title={player.topCard ? `${t('game', 'pile_library')}: ${player.libraryCount} (${player.topCard.name})` : `${t('game', 'pile_library')}: ${player.libraryCount}`}
           onClick={() => setOpenPile('library')}
           onMouseEnter={(e) => player.topCard && onCardHover?.(player.topCard, e.currentTarget.getBoundingClientRect())}
           onMouseLeave={() => onCardHover?.(null)}
         >
           {player.topCard ? (
             <CardSlot card={player.topCard} className="library-top-card" />
           ) : (
             <img className="stack-back-img" src={CARD_BACK_URL} alt="" draggable={false} />
           )}
           <span className="stack-count">{player.libraryCount}</span>
           {player.topCard && <span className="top-card-badge" title={t('board', 'zone_revealed')}><Icon name="target" size={12} /></span>}
         </button>

         <button
           type="button"
           className={`resource-stack graveyard-stack clickable-pile ${counts.graveyard > 0 ? 'has-playable' : ''} ${topGraveyardCard ? 'has-card-img' : ''}`}
           title={topGraveyardCard ? `${t('game', 'pile_graveyard')}: ${graveyardCount} (${topGraveyardCard.name || topGraveyardCard.displayName})` : `${t('game', 'pile_graveyard')}: 0`}
           onClick={() => setOpenPile('graveyard')}
           onMouseEnter={(e) => topGraveyardCard && onCardHover?.(topGraveyardCard, e.currentTarget.getBoundingClientRect())}
           onMouseLeave={() => onCardHover?.(null)}
         >
           {topGraveyardCard ? (
             <CardSlot card={topGraveyardCard} className="graveyard-top-card" />
           ) : (
             <div className="stack-card-back graveyard-back">
               <span className="stack-mark"><Icon name="skull" size={20} /></span>
             </div>
           )}
           <span className="stack-count">{graveyardCount}</span>
           {counts.graveyard > 0 && <span className="playable-badge">{counts.graveyard}</span>}
         </button>

         <button
           type="button"
           className={`resource-stack exile-stack clickable-pile ${counts.exile > 0 ? 'has-playable' : ''} ${topExileCard ? 'has-card-img' : ''}`}
           title={topExileCard ? `${t('game', 'pile_exile')}: ${exileCount} (${topExileCard.name || topExileCard.displayName})` : `${t('game', 'pile_exile')}: 0`}
           onClick={() => setOpenPile('exile')}
           onMouseEnter={(e) => topExileCard && onCardHover?.(topExileCard, e.currentTarget.getBoundingClientRect())}
           onMouseLeave={() => onCardHover?.(null)}
         >
           {topExileCard ? (
             <CardSlot card={topExileCard} className="exile-top-card" />
           ) : (
             <div className="stack-card-back exile-back">
               <span className="stack-mark"><Icon name="portal" size={20} /></span>
             </div>
           )}
           <span className="stack-count">{exileCount}</span>
           {counts.exile > 0 && <span className="playable-badge">{counts.exile}</span>}
         </button>

         {side === 'my' && (
           <button
             type="button"
             className={`resource-stack ray-stack clickable-pile ${crossZone.length > 0 ? 'has-playable' : ''} ${topCrossZoneCard ? 'has-card-img' : ''}`}
             title={`${t('game', 'pile_stack')}: ${crossZone.length}`}
             onClick={() => setOpenPile('crosszone')}
             onMouseEnter={(e) => topCrossZoneCard && onCardHover?.(topCrossZoneCard, e.currentTarget.getBoundingClientRect())}
             onMouseLeave={() => onCardHover?.(null)}
           >
             {topCrossZoneCard ? (
               <>
                 <CardSlot card={topCrossZoneCard} className="ray-top-card" />
                 <div className="ray-mini-badge" title={t('game', 'pile_stack')}><Icon name="bolt" size={10} /></div>
               </>
             ) : (
               <div className="stack-card-back ray-back">
                 <Icon name="bolt" size={18} />
               </div>
             )}
             <span className="stack-count">{crossZone.length}</span>
             {crossZone.length > 0 && <span className="playable-badge">{crossZone.length}</span>}
           </button>
         )}
       </div>

         {openPile === 'library' && (
           <PileOverlay
            title={`${t('game', 'pile_library')} - ${player.name || t('common', 'player')}`}
            cards={libraryCards}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.library}
            onPlayCard={onPlayCrossZone}
            isLibrary={true}
           />
         )}
         {openPile === 'graveyard' && (
           <PileOverlay
            title={t('game', 'pile_graveyard')}
            cards={player.graveyard ?? {}}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.graveyard}
            onPlayCard={onPlayCrossZone}
           />
         )}
         {openPile === 'exile' && (
           <PileOverlay
            title={t('game', 'pile_exile')}
            cards={player.exile ?? {}}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.exile}
            onPlayCard={onPlayCrossZone}
           />
         )}
         {openPile === 'crosszone' && (
           <CrossZoneOverlay
            playables={crossZone}
            onClose={() => setOpenPile(null)}
            onPlay={(id) => {
             setOpenPile(null)
             onPlayCrossZone?.(id)
            }}
           />
         )}
       </div>
      )
}
