import { useState, useMemo, useEffect } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { ManaCost } from './ArenaManaSymbols'
import { useTranslation } from '../i18n'
import './SampleHandModal.css'

export interface SingleCard {
  instanceId: string
  cardName: string
  setCode: string
  cardNumber: string
  artCropUrl?: string | null
  imageUrl?: string | null
  manaCost?: string
  typeLine?: string
  cmc?: number
  isLand: boolean
}

export function cmcForCard(card: SingleCard): number {
  if (card.isLand) return 0
  if (typeof card.cmc === 'number') return card.cmc
  const mc = card.manaCost ?? ''
  let cmc = 0
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(mc))) {
    const sym = m[1]
    if (/^\d+$/.test(sym)) cmc += parseInt(sym, 10)
    else if (sym === 'X') cmc += 0
    else cmc += 1
  }
  return cmc
}

export function buildDeckInstances(
  cards: DeckCard[],
  metaMap: Map<string, CardStripMeta>
): SingleCard[] {
  const list: SingleCard[] = []
  let idCounter = 1

  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const meta = metaMap.get(key) ?? metaMap.get(c.cardName.toLowerCase())
    const isLand = (meta?.typeLine?.toLowerCase() ?? '').includes('land') ||
      ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'].includes(c.cardName.toLowerCase())

    for (let i = 0; i < c.amount; i++) {
      list.push({
        instanceId: `inst-${idCounter++}`,
        cardName: c.cardName,
        setCode: c.setCode,
        cardNumber: c.cardNumber,
        artCropUrl: meta?.artCropUrl,
        imageUrl: meta?.imageUrl,
        manaCost: meta?.manaCost,
        typeLine: meta?.typeLine,
        cmc: meta?.cmc,
        isLand,
      })
    }
  }
  return list
}

export function shuffleDeck<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function SampleHandModal({
  deckName,
  cards,
  metaMap,
  onClose,
}: {
  deckName: string
  cards: DeckCard[]
  metaMap: Map<string, CardStripMeta>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const allInstances = useMemo(() => buildDeckInstances(cards, metaMap), [cards, metaMap])

  const [library, setLibrary] = useState<SingleCard[]>([])
  const [hand, setHand] = useState<SingleCard[]>([])
  const [mulliganCount, setMulliganCount] = useState<number>(0)
  const [turn, setTurn] = useState<number>(1)
  const [selectedToBottom, setSelectedToBottom] = useState<Set<string>>(new Set())
  const [isKeeping, setIsKeeping] = useState<boolean>(false)
  const [previewCard, setPreviewCard] = useState<SingleCard | null>(null)

  const startNewHand = () => {
    const shuffled = shuffleDeck(allInstances)
    const initialHand = shuffled.slice(0, 7)
    const initialLib = shuffled.slice(7)
    setHand(initialHand)
    setLibrary(initialLib)
    setMulliganCount(0)
    setTurn(1)
    setSelectedToBottom(new Set())
    setIsKeeping(false)
  }

  useEffect(() => {
    startNewHand()
  }, [allInstances])

  const handleMulligan = () => {
    const nextMulligan = mulliganCount + 1
    const shuffled = shuffleDeck(allInstances)
    const newHand = shuffled.slice(0, 7)
    const newLib = shuffled.slice(7)

    setHand(newHand)
    setLibrary(newLib)
    setMulliganCount(nextMulligan)
    setSelectedToBottom(new Set())
    setIsKeeping(false)
  }

  const toggleSelectToBottom = (id: string) => {
    if (isKeeping) return
    const next = new Set(selectedToBottom)
    if (next.has(id)) {
      next.delete(id)
    } else {
      if (next.size < mulliganCount) {
        next.add(id)
      }
    }
    setSelectedToBottom(next)
  }

  const handleConfirmKeep = () => {
    if (selectedToBottom.size !== mulliganCount) return
    const remainingHand = hand.filter((c) => !selectedToBottom.has(c.instanceId))
    const bottomed = hand.filter((c) => selectedToBottom.has(c.instanceId))
    setHand(remainingHand)
    setLibrary([...library, ...bottomed])
    setSelectedToBottom(new Set())
    setIsKeeping(true)
  }

  const handleDrawCard = () => {
    if (library.length === 0) return
    const [top, ...rest] = library
    setHand([...hand, top])
    setLibrary(rest)
    setTurn(turn + 1)
  }

  const landsInHand = hand.filter((c) => c.isLand).length
  const spellsInHand = hand.length - landsInHand
  const mustBottomCount = mulliganCount - selectedToBottom.size

  const goldfish = useMemo(() => {
    const onPlay = turn % 2 === 1
    const projected: { turn: number; mana: number; landsAvailable: number; playable: SingleCard[] }[] = []
    for (let t = 1; t <= 3; t++) {
      const mana = t
      const landsAvailable = Math.min(mana, landsInHand + (t - 1))
      const playable = hand.filter((c) => !c.isLand && cmcForCard(c) <= Math.min(mana, landsAvailable))
      projected.push({ turn: t, mana, landsAvailable, playable })
    }
    const playableNowSet = new Set(projected[Math.min(turn, 3) - 1]?.playable.map((c) => c.instanceId) ?? [])
    return { projected, playableNowSet, onPlay }
  }, [hand, landsInHand, turn])

  return (
    <div className="sample-hand-backdrop" onClick={onClose}>
      <div className="sample-hand-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="sample-hand-header">
          <div className="sample-hand-title-wrap">
            <h2 className="sample-hand-title">🖐️ {t('decks', 'sample_hand')}</h2>
            <span className="sample-hand-deck-name">{deckName}</span>
          </div>

          <div className="sample-hand-stats-chips">
            <span className="stats-chip">{t('decks', 'total_cards')}: {hand.length}</span>
            <span className="stats-chip lands">🏝️ {t('decks', 'lands')}: {landsInHand}</span>
            <span className="stats-chip spells">✨ {t('decks', 'spells')}: {spellsInHand}</span>
            <span className="stats-chip">{t('board', 'zone_library')}: {library.length}</span>
            <span className="stats-chip turn">{t('game', 'turn')}: {turn}</span>
          </div>

          <button type="button" className="sample-hand-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        {/* London Mulligan Prompt Banner */}
        {mulliganCount > 0 && !isKeeping && (
          <div className="mulligan-alert-banner">
            <span>
              {t('decks', 'sample_london')} ({mulliganCount}): {t('decks', 'sample_to_bottom')} {mulliganCount}
              {mustBottomCount > 0 && ` (${mustBottomCount})`}
            </span>
            <button
              type="button"
              className="confirm-keep-btn"
              disabled={selectedToBottom.size !== mulliganCount}
              onClick={handleConfirmKeep}
            >
              ✓ {t('common', 'confirm')} ({7 - mulliganCount} {t('decks', 'total_cards')})
            </button>
          </div>
        )}

        {/* Goldfish T1-3 projection */}
        <div className="goldfish-projection">
          <div className="goldfish-title">Goldfish T1–T3 {goldfish.onPlay ? '(on the play)' : '(on the draw)'} — tierras en mano: {landsInHand}</div>
          <div className="goldfish-turns">
            {goldfish.projected.map((g) => (
              <div key={g.turn} className={`goldfish-turn ${turn === g.turn ? 'active-turn' : ''}`}>
                <span className="goldfish-turn-label">T{g.turn} ({g.mana} mana, {g.landsAvailable} tierras)</span>
                <span className="goldfish-turn-count">{g.playable.length} jugables</span>
                <span className="goldfish-turn-names" title={g.playable.map((c) => `${c.cardName} {${cmcForCard(c)}}`).join(', ')}>
                  {g.playable.length ? g.playable.slice(0, 3).map((c) => c.cardName).join(', ') + (g.playable.length > 3 ? ` +${g.playable.length - 3}` : '') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hand Cards Area */}
        <div className="sample-hand-cards-area">
          {hand.length === 0 ? (
            <div className="sample-hand-empty">{t('decks', 'sample_no_cards')}</div>
          ) : (
            <div className="sample-hand-grid">
              {hand.map((card) => {
                const isSelectedForBottom = selectedToBottom.has(card.instanceId)
                const isPlayableNow = goldfish.playableNowSet.has(card.instanceId) && !card.isLand
                const img = card.imageUrl || (card.artCropUrl ? card.artCropUrl : null)

                return (
                  <div
                    key={card.instanceId}
                    className={`sample-card-item ${card.isLand ? 'is-land' : ''} ${isSelectedForBottom ? 'selected-bottom' : ''} ${isPlayableNow ? 'is-playable-now' : ''}`}
                    onClick={() => {
                      if (mulliganCount > 0 && !isKeeping) {
                        toggleSelectToBottom(card.instanceId)
                      }
                    }}
                    onMouseEnter={() => setPreviewCard(card)}
                  >
                    <div className="sample-card-art">
                      {img ? (
                        <img src={img} alt={card.cardName} loading="lazy" />
                      ) : (
                        <div className="sample-card-fallback">{card.cardName.slice(0, 3)}</div>
                      )}
                      <div className="sample-card-scrim" />
                      {card.manaCost && (
                        <span className="sample-card-cost">
                          <ManaCost manaCost={card.manaCost} size={15} />
                        </span>
                      )}
                    </div>

                    <div className="sample-card-footer">
                      <span className="sample-card-name" title={card.cardName}>
                        {card.cardName}
                      </span>
                      {card.isLand && <span className="land-indicator">{t('decks', 'sample_land')}</span>}
                    </div>

                    {isSelectedForBottom && (
                      <div className="bottom-badge">{t('decks', 'sample_to_bottom')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Floating Preview for hovered card */}
        {previewCard?.imageUrl && (
          <div className="sample-hand-preview-dock">
            <img src={previewCard.imageUrl} alt={previewCard.cardName} />
          </div>
        )}

        {/* Actions Footer */}
        <footer className="sample-hand-footer">
          <div className="sample-hand-actions-left">
            <button
              type="button"
              className="sample-action-btn"
              onClick={handleMulligan}
              title={t('decks', 'sample_london')}
            >
              🔄 {t('decks', 'sample_mulligan')} {mulliganCount > 0 ? `(a ${Math.max(1, 7 - mulliganCount - 1)})` : '(a 6)'}
            </button>
            <button
              type="button"
              className="sample-action-btn primary"
              onClick={handleDrawCard}
              disabled={library.length === 0}
              title={t('board', 'zone_library')}
            >
              📥 {t('game', 'draw_card')} ({t('game', 'turn')} {turn + 1})
            </button>
          </div>

          <div className="sample-hand-actions-right">
            <button
              type="button"
              className="sample-action-btn reset"
              onClick={startNewHand}
              title={t('common', 'refresh')}
            >
              ✨ {t('common', 'refresh')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
