import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardView } from '../net/types'
import { cardName, getSourceCardName, isAbilityCard, largeImageUrl } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { getEffectiveCardLang, useLocalizedCardText } from '../cards/cardLocalization'
import { activeCardFace } from './cardFaces'
import FormattedText from '../game/FormattedText'
import { ManaCost } from '../decks/ArenaManaSymbols'
import { useTranslation } from '../i18n'
import { setState, useStore } from '../state/store'
import CloseButton from '../ui/CloseButton'
import { useEscape } from '../ui/useEscape'
import { overlayRoot } from './overlayRoot'
import './CardInspector.css'

function closeInspector() {
  setState({ inspectedCard: null })
}

export default function CardInspector() {
  const { t } = useTranslation()
  const card = useStore((s) => s.inspectedCard)
  const [showBackFace, setShowBackFace] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setShowBackFace(false)
    setImgFailed(false)
  }, [card])

  const active = useMemo(() => (card ? activeCardFace(card, showBackFace) : null), [card, showBackFace])
  const hasSecondFace = !card?.faceDown && (!!card?.secondCardFace || !!card?.transformable || !!card?.alternateName)

  useEffect(() => {
    if (!card || !hasSecondFace) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.toLowerCase() === 'f') {
        setShowBackFace((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [card, hasSecondFace])

  useEscape(closeInspector, !!card)

  const url = useCardImageUrl(active, !!active)
  const largeUrl = largeImageUrl(url)
  const { text, pending } = useLocalizedCardText(active)

  useEffect(() => {
    setImgFailed(false)
  }, [url])

  if (!card || !active) return null

  const isAbility = isAbilityCard(active as CardView)
  const name = isAbility ? getSourceCardName(active as CardView) : cardName(active)
  const displayName = text?.name || name
  const manaCost = (active.manaCostLeftStr ?? []).join('')
  const typeLine = text?.typeLine || (active.cardTypes ?? []).join(' — ')
  const engineRules = active.rules ?? []
  const rules = text?.rules && text.rules.length > 0 ? text.rules : engineRules
  const showEnglishNote = !pending && !text && getEffectiveCardLang() !== 'en' && engineRules.length > 0

  return createPortal(
    <div className="card-inspector-backdrop" onClick={closeInspector} data-space-shortcut-off="true">
      <div
        className="card-inspector"
        role="dialog"
        aria-label={displayName}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <CloseButton
          variant="solid"
          size="lg"
          className="card-inspector-close"
          onClick={closeInspector}
          title={`${t('common', 'close')} (Esc)`}
        />
        <div className="card-inspector-art">
          {url ? (
            <img
              src={imgFailed ? url : largeUrl ?? url}
              alt={displayName}
              className="card-inspector-img"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="card-inspector-noart">{displayName}</div>
          )}
        </div>
        <div className="card-inspector-text">
          <div className="card-inspector-header">
            <span className="card-inspector-name">{displayName}</span>
            {manaCost && (
              <span className="card-inspector-mana">
                <ManaCost manaCost={manaCost} size={16} />
              </span>
            )}
          </div>
          {typeLine && <div className="card-inspector-type">{typeLine}</div>}
          {rules.length > 0 && (
            <div className="card-inspector-rules">
              <FormattedText text={rules.join('\n')} cardName={displayName} />
            </div>
          )}
          {showEnglishNote && <div className="card-inspector-note">{t('dialogs', 'card_inspect_no_translation')}</div>}
          {hasSecondFace && <div className="card-inspector-flip">{t('wiki', 'flip_hint')}</div>}
        </div>
      </div>
    </div>,
    overlayRoot()
  )
}
