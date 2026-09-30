import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView, PermanentView } from '../net/types'
import { cardName, getSourceCardName, hiddenFaceDownName, isAbilityCard } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { activeCardFace } from './cardFaces'
import { extractKeywordsFromCard } from '../data/keywordExtractor'
import { keywordDisplayName, keywordSummary } from '../data/keywordI18n'
import FormattedText from '../game/FormattedText'
import { ManaCost } from '../decks/ArenaManaSymbols'
import { useTranslation } from '../i18n'
import { useStore, isBlockingModal } from '../state/store'
import Icon from '../ui/Icon'
import { fxEnabled } from './fx'
import './FloatingCardPreview.css'

interface FloatingCardPreviewProps {
  card: CardView | PermanentView | null
  anchorRect: DOMRect | null
  boardRect?: DOMRect | null
  fixedSide?: 'left' | 'right' | 'auto'
  inModal?: boolean
  /** Leaving phase: set by the presenter while the hover is being dropped. */
  leaving?: boolean
}

export function foilKind(rarity: string | undefined | null): 'mythic' | 'rare' | null {
  const r = String(rarity ?? '').toUpperCase()
  if (r === 'MYTHIC') return 'mythic'
  if (r === 'RARE') return 'rare'
  return null
}

export function tiltFromPointer(x: number, y: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): { rx: number; ry: number; gx: number; gy: number } {
  const nx = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)))
  const ny = Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height)))
  return {
    rx: Math.round((0.5 - ny) * 16 * 10) / 10,
    ry: Math.round((nx - 0.5) * 20 * 10) / 10,
    gx: Math.round(nx * 100),
    gy: Math.round(ny * 100),
  }
}

const PREVIEW_WIDTH = 320
const PREVIEW_HEIGHT = 448
const KEYWORDS_WIDTH = 240

export default function FloatingCardPreview({
  card,
  anchorRect,
  boardRect,
  fixedSide = 'auto',
  inModal = false,
  leaving = false,
}: FloatingCardPreviewProps) {
  const modalOpen = useStore(isBlockingModal)
  const { t, lang } = useTranslation()
  const [showBackFace, setShowBackFace] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  useEffect(() => {
    setShowBackFace(false)
  }, [card?.id, card?.name])

  useEffect(() => {
    if (!card || !anchorRect || prefersReducedMotion || !fxEnabled()) return
    const onMove = (e: PointerEvent) => {
      const el = mainRef.current
      if (!el) return
      const { rx, ry, gx, gy } = tiltFromPointer(e.clientX, e.clientY, anchorRect)
      el.style.setProperty('--tilt-x', `${rx}deg`)
      el.style.setProperty('--tilt-y', `${ry}deg`)
      el.style.setProperty('--glare-x', `${gx}%`)
      el.style.setProperty('--glare-y', `${gy}%`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [card, anchorRect, prefersReducedMotion])

  const hasSecondFace = !card?.faceDown && (!!card?.secondCardFace || !!card?.transformable || !!card?.alternateName)

  useEffect(() => {
    if (!hasSecondFace) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.toLowerCase() === 'f') {
        setShowBackFace((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasSecondFace])

  const hiddenName = card ? hiddenFaceDownName(card) : null

  const activeCard: CardView | PermanentView | null = useMemo(
    () => (card ? activeCardFace(card, showBackFace) : null),
    [card, showBackFace]
  )

  const imgUrl = useCardImageUrl(activeCard, !((!inModal && modalOpen) || !activeCard || activeCard.faceDown))

  const keywords = useMemo(() => extractKeywordsFromCard(activeCard), [activeCard])

  if ((!inModal && modalOpen) || !card || !anchorRect || (card.faceDown && !hiddenName) || !activeCard) {
    return null
  }

  let style: React.CSSProperties = {}
  const totalWidth = keywords.length > 0 ? PREVIEW_WIDTH + KEYWORDS_WIDTH + 10 : PREVIEW_WIDTH

  if (boardRect) {
    const relLeft = anchorRect.left - boardRect.left
    const relTop = anchorRect.top - boardRect.top
    const relRight = anchorRect.right - boardRect.left
    const relBottom = anchorRect.bottom - boardRect.top

    const isHandCard = relBottom > boardRect.height - 140

    if (isHandCard) {
      const left = Math.max(
        12,
        Math.min(boardRect.width - totalWidth - 12, relLeft + anchorRect.width / 2 - PREVIEW_WIDTH / 2)
      )
      const bottom = Math.max(12, boardRect.height - relTop + 12)
      style = {
        position: 'absolute',
        left: `${left}px`,
        bottom: `${bottom}px`,
        height: `${PREVIEW_HEIGHT}px`,
      }
    } else {
      const fitsRight = relRight + 16 + totalWidth <= boardRect.width - 12
      const left = fitsRight
        ? relRight + 16
        : Math.max(12, relLeft - totalWidth - 16)

      const top = Math.max(
        12,
        Math.min(
          boardRect.height - PREVIEW_HEIGHT - 12,
          relTop + anchorRect.height / 2 - PREVIEW_HEIGHT / 2
        )
      )

      style = {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        height: `${PREVIEW_HEIGHT}px`,
      }
    }
  } else {
    const fitsLeft = anchorRect.left - totalWidth - 16 >= 12
    const left = fixedSide === 'left' || fitsLeft
      ? Math.max(12, anchorRect.left - totalWidth - 16)
      : Math.min(window.innerWidth - totalWidth - 12, anchorRect.right + 16)

    const top = Math.max(
      12,
      Math.min(
        window.innerHeight - PREVIEW_HEIGHT - 12,
        anchorRect.top + anchorRect.height / 2 - PREVIEW_HEIGHT / 2
      )
    )

    style = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      height: `${PREVIEW_HEIGHT}px`,
      zIndex: 10000,
    }
  }

  const isAbility = isAbilityCard(activeCard)
  const perm = activeCard as PermanentView
  const name = isAbility ? getSourceCardName(activeCard) : cardName(activeCard)
  const manaCost = (activeCard.manaCostLeftStr ?? []).join('')
  const rules = activeCard.rules ?? []

  const isNearRightEdge = style.left ? parseInt(String(style.left), 10) + PREVIEW_WIDTH + KEYWORDS_WIDTH > (boardRect?.width ?? window.innerWidth) - 20 : false

  return (
    <div
      className={`floating-card-preview ${isNearRightEdge ? 'flip-keywords' : ''}${leaving ? ' is-leaving' : ''}`}
      style={style}
    >
      <div className="floating-card-main" ref={mainRef}>
        <div className="floating-card-inner" data-foil={imgUrl ? foilKind(activeCard.rarity) ?? undefined : undefined}>
          {hasSecondFace && (
            <div className="floating-card-flip-badge" title={t('wiki', 'flip_hint')}>
              <span className="flip-icon"><Icon name="refresh" size={12} /></span>
              <span className="flip-label">{showBackFace ? t('wiki', 'face_back') : t('wiki', 'face_front')} (Shift / F)</span>
            </div>
          )}

          {imgUrl ? (
            <>
              <img src={imgUrl} alt={name} className="floating-card-img" draggable={false} />
              <div className="floating-card-foil" aria-hidden="true" />
              <div className="floating-card-glare" aria-hidden="true" />
            </>
          ) : (
            <div className="floating-card-fallback">
              <div className="floating-card-header">
                <span className="floating-card-name">{name}</span>
                {manaCost && (
                  <span className="floating-card-mana">
                    <ManaCost manaCost={manaCost} size={16} />
                  </span>
                )}
              </div>
              {activeCard.cardTypes && activeCard.cardTypes.length > 0 && (
                <div className="floating-card-type">{activeCard.cardTypes.join(' — ')}</div>
              )}
              {rules.length > 0 && (
                <div className="floating-card-rules">
                  <FormattedText text={rules.join('\n')} cardName={name} />
                </div>
              )}
            </div>
          )}

          {activeCard.cardTypes?.some((t) => String(t).toLowerCase() === 'creature') && perm.power && perm.toughness && (
            <div className="floating-card-pt">
              {perm.power}/{perm.toughness}
            </div>
          )}

          {activeCard.cardTypes?.some((t) => String(t).toLowerCase() === 'planeswalker') && perm.loyalty && (
            <div className="floating-card-loyalty" title={`${t('game', 'ability_loyalty')}: ${perm.loyalty}`}>
              <Icon name="shield" size={12} /> {perm.loyalty}
            </div>
          )}

          {activeCard.counters && activeCard.counters.length > 0 && (
            <div className="floating-card-counters">
              +{activeCard.counters.reduce((sum, c) => sum + c.count, 0)} {t('wiki', 'cat_counters').toLowerCase()}
            </div>
          )}

          {(perm.isToken || activeCard.mageObjectType === 'TOKEN') && !perm.copy && (
            <div className="floating-card-token-badge">{t('board', 'token')}</div>
          )}
        </div>
      </div>

      {keywords.length > 0 && (
        <aside className="floating-card-keywords" aria-label={t('wiki', 'tab_keywords')}>
          {keywords.map((kw) => {
            const primaryName = keywordDisplayName(kw.id, kw.name, (k) => t('keywords', k), kw.parameter)
            const secondaryName = lang !== 'en' && kw.name !== primaryName ? kw.name : null

            return (
              <div key={kw.id} className={`floating-card-kw-box cat-${kw.category}`}>
                <div className="kw-box-header">
                  <span className="kw-box-icon">{kw.icon}</span>
                  <span className="kw-box-name">{primaryName}</span>
                  {secondaryName && <span className="kw-box-es">({secondaryName})</span>}
                </div>
                <p className="kw-box-summary">
                  <FormattedText text={keywordSummary(kw.id, (k) => t('keywords', k), kw.parameter)} />
                </p>
              </div>
            )
          })}
        </aside>
      )}
    </div>
  )
}
