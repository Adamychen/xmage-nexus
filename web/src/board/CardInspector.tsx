import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardView, PermanentView } from '../net/types'
import { cardName, getSourceCardName, isAbilityCard, largeImageUrl } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { getEffectiveCardLang, useLocalizedCardText } from '../cards/cardLocalization'
import { customArtName } from '../cards/customCardArt'
import { setCardArtPreference } from '../cards/artPreferences'
import { cardTypeLine } from '../cards/rendered/cardLayout'
import { CardPrintingsModal } from '../decks/CardPrintingsModal'
import { extractOwnedKeywords } from '../data/keywordExtractor'
import { keywordDisplayName, keywordSummary } from '../data/keywordI18n'
import { activeCardFace } from './cardFaces'
import {
  findPermanent,
  hasBattlefieldDetails,
  inspectorGlow,
  inspectorRarity,
  inspectorSetLabel,
  inspectorState,
  loyaltyRows,
  type InspectorState,
} from './cardInspectorModel'
import { KeywordCoin } from './KeywordGlyph'
import FormattedText from '../game/FormattedText'
import { ManaCost } from '../decks/ArenaManaSymbols'
import { useTranslation } from '../i18n'
import { setState, useStore } from '../state/store'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import CloseButton from '../ui/CloseButton'
import Icon, { type IconName } from '../ui/Icon'
import { useEscape } from '../ui/useEscape'
import { overlayRoot } from './overlayRoot'
import './CardInspector.css'

function closeInspector() {
  setState({ inspectedCard: null })
}

type T = ReturnType<typeof useTranslation>['t']

function StatePanel({ state, onOpen, t }: { state: InspectorState; onOpen: (id: string) => void; t: T }) {
  const ptClass = (trend: string) => `card-inspector-pt-${trend}`
  const chips: { key: string; icon: IconName; label: string }[] = []
  if (state.tapped) chips.push({ key: 'tapped', icon: 'rotateCw', label: t('dialogs', 'card_inspect_tapped') })
  if (state.summoningSick) chips.push({ key: 'sick', icon: 'clock', label: t('dialogs', 'card_inspect_summoning_sick') })
  if (state.phasedOut) chips.push({ key: 'phased', icon: 'eyeOff', label: t('dialogs', 'card_inspect_phased_out') })
  if (state.token) chips.push({ key: 'token', icon: 'layers', label: t('dialogs', 'card_inspect_token') })
  if (state.copy) chips.push({ key: 'copy', icon: 'copy', label: t('dialogs', 'card_inspect_copy') })

  return (
    <section className="card-inspector-section card-inspector-state" aria-label={t('dialogs', 'card_inspect_on_battlefield')}>
      <h3 className="card-inspector-label">{t('dialogs', 'card_inspect_on_battlefield')}</h3>
      <div className="card-inspector-tiles">
        {state.power != null && state.toughness != null && (
          <div className="card-inspector-tile" data-stat="pt">
            <span className="card-inspector-tile-label">{t('dialogs', 'card_inspect_pt')}</span>
            <span className="card-inspector-tile-value">
              <span className={ptClass(state.trend.power)}>{state.power}</span>
              <span className="card-inspector-pt-sep">/</span>
              <span className={ptClass(state.trend.toughness)}>{state.toughness}</span>
            </span>
            {state.basePt && <span className="card-inspector-tile-sub">{t('dialogs', 'card_inspect_printed', { pt: state.basePt })}</span>}
          </div>
        )}
        {state.damage > 0 && (
          <div className="card-inspector-tile" data-stat="damage">
            <span className="card-inspector-tile-label">{t('dialogs', 'card_inspect_damage')}</span>
            <span className="card-inspector-tile-value card-inspector-damage">{state.damage}</span>
            {state.toughnessLeft != null && (
              <span className="card-inspector-tile-sub">{t('dialogs', 'card_inspect_toughness_left', { n: state.toughnessLeft })}</span>
            )}
          </div>
        )}
        {state.shownLoyalty != null && (
          <div className="card-inspector-tile" data-stat="loyalty">
            <span className="card-inspector-tile-label">{t('dialogs', 'card_inspect_loyalty')}</span>
            <span
              className={`card-inspector-tile-value ${
                state.startingLoyalty == null ? '' : ptClass(state.shownLoyalty > state.startingLoyalty ? 'up' : 'down')
              }`}
            >
              {state.shownLoyalty}
            </span>
            {state.startingLoyalty != null && (
              <span className="card-inspector-tile-sub">{t('dialogs', 'card_inspect_starting', { n: state.startingLoyalty })}</span>
            )}
          </div>
        )}
        {state.defense != null && (
          <div className="card-inspector-tile" data-stat="defense">
            <span className="card-inspector-tile-label">{t('dialogs', 'card_inspect_defense')}</span>
            <span className="card-inspector-tile-value">{state.defense}</span>
          </div>
        )}
      </div>
      {state.counters.length > 0 && (
        <div className="card-inspector-chips" aria-label={t('dialogs', 'card_inspect_counters')}>
          {state.counters.map((c) => (
            <span key={c.name} className="card-inspector-chip card-inspector-counter" data-counter={c.name}>
              {c.name} <b>×{c.count}</b>
            </span>
          ))}
        </div>
      )}
      {(chips.length > 0 || state.attachedTo || state.attachments.length > 0) && (
        <div className="card-inspector-chips">
          {chips.map((c) => (
            <span key={c.key} className="card-inspector-chip" data-status={c.key}>
              <Icon name={c.icon} size={13} />
              {c.label}
            </span>
          ))}
          {state.attachedTo && (
            <ChipButton icon="layers" pill className="card-inspector-chip card-inspector-link" onClick={() => onOpen(state.attachedTo!.id)}>
              {t('dialogs', 'card_inspect_attached_to', { name: state.attachedTo.name })}
            </ChipButton>
          )}
          {state.attachments.map((a) => (
            <ChipButton key={a.id} icon="layers" pill className="card-inspector-chip card-inspector-link" onClick={() => onOpen(a.id)}>
              {t('dialogs', 'card_inspect_attachment', { name: a.name })}
            </ChipButton>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CardInspector() {
  const { t } = useTranslation()
  const card = useStore((s) => s.inspectedCard)
  const game = useStore((s) => s.game)
  const [showBackFace, setShowBackFace] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [showPrintings, setShowPrintings] = useState(false)

  useEffect(() => {
    setShowBackFace(false)
    setImgFailed(false)
  }, [card])

  useEffect(() => {
    if (!card) setShowPrintings(false)
  }, [card])

  const live = useMemo(() => findPermanent(game, card?.id), [game, card?.id])
  const source: CardView | PermanentView | null = live ?? card
  const active = useMemo(() => (source ? activeCardFace(source, showBackFace) : null), [source, showBackFace])
  const hasSecondFace = !source?.faceDown && (!!source?.secondCardFace || !!source?.transformable || !!source?.alternateName)
  const canCustomize = !!source && !source.faceDown && !!customArtName(active as CardView)
  const transformedInPlay = (live as PermanentView | null)?.transformed === true
  const showingBack = transformedInPlay ? !showBackFace : showBackFace

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
  const keywords = useMemo(() => extractOwnedKeywords(active), [active])

  useEffect(() => {
    setImgFailed(false)
  }, [url])

  if (!card || !source || !active) return null

  const isAbility = isAbilityCard(active as CardView)
  const name = isAbility ? getSourceCardName(active as CardView) : cardName(active)
  const displayName = text?.name || name
  const manaCost = (active.manaCostLeftStr ?? []).join('')
  const typeLine = text?.typeLine || cardTypeLine(active as CardView)
  const engineRules = active.rules ?? []
  const rules = text?.rules && text.rules.length > 0 ? text.rules : engineRules
  const showEnglishNote = !pending && !text && getEffectiveCardLang() !== 'en' && engineRules.length > 0
  const showLocalizedNote = !!text?.rules?.length && getEffectiveCardLang() !== 'en'
  const rarity = inspectorRarity(active as CardView) ?? inspectorRarity(source as CardView)
  const setLabel = inspectorSetLabel(active as CardView)
  const state = live && showingBack === transformedInPlay ? inspectorState(live, game) : null
  const loyalty = loyaltyRows(active as CardView, rules, state?.loyalty ?? null)
  const openPermanent = (id: string) => {
    const target = findPermanent(game, id)
    if (target) setState({ inspectedCard: target })
  }
  const pickFace = (back: boolean) => setShowBackFace(transformedInPlay ? !back : back)

  return createPortal(
    <div className="card-inspector-backdrop" onClick={closeInspector} data-space-shortcut-off="true">
      <div
        className="card-inspector"
        role="dialog"
        aria-label={displayName}
        data-glow={inspectorGlow(active as CardView)}
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
        <div className="card-inspector-info">
          <header className="card-inspector-head">
            {hasSecondFace && (
              <div className="card-inspector-faces" role="group" aria-label={t('dialogs', 'card_inspect_face_group')} title={t('dialogs', 'card_inspect_flip_title')}>
                {([false, true] as const).map((back) => (
                  <ChipButton
                    key={String(back)}
                    className="card-inspector-face"
                    active={showingBack === back}
                    aria-pressed={showingBack === back}
                    onClick={() => pickFace(back)}
                  >
                    {live && transformedInPlay === back && (
                      <span className="card-inspector-face-dot" title={t('dialogs', 'card_inspect_face_in_play')} aria-label={t('dialogs', 'card_inspect_face_in_play')} />
                    )}
                    {back && <Icon name="swap" size={13} />}
                    {t('dialogs', back ? 'card_inspect_face_back' : 'card_inspect_face_front')}
                  </ChipButton>
                ))}
                <kbd className="card-inspector-kbd" aria-hidden="true">F</kbd>
              </div>
            )}
            <div className="card-inspector-title">
              <h2 className="card-inspector-name">{displayName}</h2>
              {manaCost && (
                <span className="card-inspector-mana">
                  <ManaCost manaCost={manaCost} size={20} />
                </span>
              )}
            </div>
            {typeLine && <div className="card-inspector-type">{typeLine}</div>}
            {(rarity || setLabel) && (
              <div className="card-inspector-chips card-inspector-meta">
                {rarity && (
                  <span className="card-inspector-chip" data-rarity={rarity}>
                    <span className="card-inspector-rarity-dot" aria-hidden="true" />
                    {t('dialogs', `card_inspect_rarity_${rarity}`)}
                  </span>
                )}
                {setLabel && <span className="card-inspector-chip card-inspector-set">{setLabel}</span>}
              </div>
            )}
          </header>
          <div className="card-inspector-body">
            {state && hasBattlefieldDetails(state) && <StatePanel state={state} onOpen={openPermanent} t={t} />}
            {rules.length > 0 && (
              <section className="card-inspector-section">
                <h3 className="card-inspector-label">
                  {t('dialogs', loyalty ? 'card_inspect_loyalty_abilities' : 'card_inspect_rules')}
                </h3>
                <div className="card-inspector-rules">
                  {loyalty
                    ? loyalty.map((row, i) => (
                        <div
                          key={i}
                          className={`card-inspector-ability${row.affordable ? '' : ' is-unaffordable'}`}
                          title={row.affordable ? undefined : t('dialogs', 'card_inspect_loyalty_short')}
                        >
                          {row.cost && <span className={`card-inspector-cost is-${row.sign}`}>{row.cost}</span>}
                          <span className="card-inspector-ability-text">
                            <FormattedText text={row.text} cardName={displayName} />
                          </span>
                        </div>
                      ))
                    : rules.map((line, i) => (
                        <p key={i} className="card-inspector-rule">
                          <FormattedText text={line} cardName={displayName} />
                        </p>
                      ))}
                </div>
              </section>
            )}
            {keywords.length > 0 && (
              <section className="card-inspector-section">
                <h3 className="card-inspector-label">{t('wiki', 'tab_keywords')}</h3>
                <div className="card-inspector-keywords">
                  {keywords.map((kw) => (
                    <div key={kw.id} className="card-inspector-keyword">
                      <KeywordCoin id={kw.id} category={kw.category} size={20} />
                      <p>
                        <b>{keywordDisplayName(kw.id, kw.name, (k) => t('keywords', k), kw.parameter)}</b>
                        {' — '}
                        <FormattedText text={keywordSummary(kw.id, (k) => t('keywords', k), kw.parameter)} />
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {state && (state.controller || state.owner) && (
              <div className="card-inspector-chips card-inspector-ownership">
                {state.controller && (
                  <span className="card-inspector-chip" data-status="controller">
                    <Icon name="user" size={13} />
                    {t('dialogs', 'card_inspect_controller', { name: state.controller })}
                  </span>
                )}
                {state.owner && (
                  <span className="card-inspector-chip" data-status="owner">
                    <Icon name="user" size={13} />
                    {t('dialogs', 'card_inspect_owner', { name: state.owner })}
                  </span>
                )}
              </div>
            )}
          </div>
          <footer className="card-inspector-foot">
            <span className="card-inspector-foot-note">
              {showEnglishNote ? (
                <span className="card-inspector-note">{t('dialogs', 'card_inspect_no_translation')}</span>
              ) : showLocalizedNote ? (
                <>
                  <Icon name="globe" size={14} />
                  {t('dialogs', 'card_inspect_localized')}
                </>
              ) : (
                <>
                  <kbd className="card-inspector-kbd">Esc</kbd>
                  {t('common', 'close')}
                </>
              )}
            </span>
            {canCustomize && (
              <Button icon="palette" className="card-inspector-customize" onClick={() => setShowPrintings(true)}>
                {t('decks', 'custom_art_customize')}
              </Button>
            )}
          </footer>
        </div>
      </div>
      {canCustomize && showPrintings && card && (
        <CardPrintingsModal
          cardName={customArtName(active as CardView) ?? displayName}
          currentSet={(active as CardView).expansionSetCode ?? ''}
          currentNumber={(active as CardView).cardNumber ?? ''}
          onSelectPrinting={(setCode, cardNumber) => {
            const name = customArtName(active as CardView)
            if (name) setCardArtPreference(name, setCode, cardNumber)
          }}
          onClose={() => setShowPrintings(false)}
        />
      )}
    </div>,
    overlayRoot()
  )
}
