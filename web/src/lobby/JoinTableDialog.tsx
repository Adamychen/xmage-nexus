import CloseButton from '../ui/CloseButton'
import Chip from '../ui/Chip'
import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import type { TableView } from '../net/types'
import {
  getAllAvailableDecks,
  saveCustomDecks,
  loadSavedCustomDecks,
  deckRef,
  sameDeck,
  type Deck,
} from './decks'
import { parseAnyDeck } from '../decks/parseDck'
import { setMyDeck, useStore } from '../state/store'
import { requestDeckValidation } from './DeckIssuesDialog'
import Icon from '../ui/Icon'
import ErrorBanner from '../ui/ErrorBanner'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { prepareDeckForXMage } from '../decks/deckNormalize'
import { colorIdentityFromCards, deckInitials } from '../decks/types'
import { FORMAT_CONFIGS } from '../decks/formatRules'
import { ManaPip } from '../decks/ArenaManaSymbols'
import { useCardArtUrl } from '../decks/useCardArtUrl'
import {
  tableFormatProfile,
  rankDecksForTable,
  pickInitialDeck,
  rememberDeckForFormat,
  deckHighlights,
  deckCoverCard,
  isGoodFit,
  type DeckFit,
  type JoinDeck,
  type TableFormatProfile,
} from './joinDeckFit'
import './JoinTableDialog.css'
import Button from '../ui/Button'

const SEARCH_THRESHOLD = 6

interface JoinTableDialogProps {
  table: TableView
  busy?: boolean
  title?: string
  submitLabel?: string
  initialPassword?: string
  onClose: () => void
  onJoin: (table: TableView, deck: Deck, password?: string) => Promise<void>
}

function deckColors(deck: JoinDeck): string[] {
  return deck.colors ?? colorIdentityFromCards(deck.cards)
}

function identityStyle(colors: string[]): CSSProperties {
  const [a, b] = colors
  const style: Record<string, string> = {}
  if (a) style['--identity-a'] = `var(--mana-${a.toLowerCase()})`
  if (b ?? a) style['--identity-b'] = `var(--mana-${(b ?? a).toLowerCase()})`
  return style as CSSProperties
}

function FitBadge({ fit, profile }: { fit: DeckFit; profile: TableFormatProfile }) {
  const { t } = useTranslation()
  if (fit.level === 'match') {
    return <span className="join-fit join-fit-match"><Icon name="check" size={11} /> {profile.format ? FORMAT_CONFIGS[profile.format].displayName : profile.label}</span>
  }
  if (fit.level === 'short') {
    return <span className="join-fit join-fit-short"><Icon name="alert" size={11} /> {t('lobby', 'join_fit_short', { count: fit.count, min: fit.min ?? 0 })}</span>
  }
  if (fit.level === 'other' && fit.deckFormat) {
    return <span className="join-fit join-fit-other">{FORMAT_CONFIGS[fit.deckFormat]?.displayName ?? fit.deckFormat}</span>
  }
  return <span className="join-fit join-fit-ok">{t('lobby', 'join_fit_cards', { count: fit.count })}</span>
}

function DeckTile({
  deck,
  fit,
  profile,
  selected,
  onSelect,
}: {
  deck: JoinDeck
  fit: DeckFit
  profile: TableFormatProfile
  selected: boolean
  onSelect: () => void
}) {
  const art = useCardArtUrl(deckCoverCard(deck))
  const colors = deckColors(deck)
  const highlights = deckHighlights(deck)
  return (
    <Button
      variant="ghost"
      role="radio"
      aria-checked={selected}
      className={`join-deck-card fit-${fit.level}${selected ? ' selected' : ''}`}
      onClick={onSelect}
      title={deck.name}
    >
      <span className="join-deck-art" style={identityStyle(colors)}>
        {art ? <img src={art} alt="" loading="lazy" /> : <span className="join-deck-initials">{deckInitials(deck.name)}</span>}
      </span>
      <span className="join-deck-scrim" />
      <span className="join-deck-top">
        <span className="join-deck-check" aria-hidden="true"><Icon name="check" size={12} /></span>
        <FitBadge fit={fit} profile={profile} />
      </span>
      <span className="join-deck-body">
        <span className="join-deck-name">{deck.name}</span>
        {highlights.length > 0 && <span className="join-deck-highlights">{highlights.join(' · ')}</span>}
        <span className="join-deck-colors">
          {(colors.length ? colors : ['C']).map((c) => <ManaPip key={c} symbol={c} size={14} />)}
        </span>
      </span>
    </Button>
  )
}

export default function JoinTableDialog({
  table,
  busy = false,
  title,
  submitLabel,
  initialPassword,
  onClose,
  onJoin,
}: JoinTableDialogProps) {
  const { t, tError } = useTranslation()
  const currentDeck = useStore((s) => s.myDeck)
  const profile = useMemo(() => tableFormatProfile(table.deckType, table.gameType), [table.deckType, table.gameType])
  const [allDecks, setAllDecks] = useState<JoinDeck[]>(() => getAllAvailableDecks())
  const ranked = useMemo(() => rankDecksForTable(allDecks, profile), [allDecks, profile])
  const [selectedDeck, setSelectedDeck] = useState<JoinDeck | null>(() => pickInitialDeck(ranked, profile, currentDeck))
  const userPicked = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('../decks/storage')
        const v2 = await mod.getDeckStorage().list()
        if (cancelled) return
        const byRef = new Map<string, JoinDeck>()
        for (const d of v2) {
          const deck: JoinDeck = { ...d, id: d.id || `v2:${d.name}` }
          byRef.set(deckRef(deck), deck)
        }
        for (const d of getAllAvailableDecks()) {
          if (!byRef.has(deckRef(d))) byRef.set(deckRef(d), d)
        }
        const merged = [...byRef.values()]
        setAllDecks(merged)
        if (!userPicked.current) setSelectedDeck(pickInitialDeck(rankDecksForTable(merged, profile), profile, currentDeck))
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const [password, setPassword] = useState(initialPassword ?? '')
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(() => getAllAvailableDecks().length === 0 && !currentDeck)
  const [importText, setImportText] = useState('')
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const pick = (deck: JoinDeck) => {
    userPicked.current = true
    setSelectedDeck(deck)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ranked
    return ranked.filter(({ deck }) =>
      deck.name.toLowerCase().includes(q)
      || deck.cards.some((c) => c.cardName.toLowerCase().includes(q))
      || (deck.commanders ?? []).some((c) => c.cardName.toLowerCase().includes(q)))
  }, [ranked, query])
  const fitting = visible.filter(({ fit }) => isGoodFit(fit))
  const others = visible.filter(({ fit }) => !isGoodFit(fit))
  const splitGroups = profile.minMain != null && fitting.length > 0 && others.length > 0
  const selectedFit = ranked.find(({ deck }) => sameDeck(deck, selectedDeck))?.fit ?? null

  const seats = table.seats ?? []
  const filledSeats = seats.filter((s) => s.playerName).length
  const host = table.controllerName?.split(',')[0]?.trim() || table.controllerName

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setImportError(null)
    const name = importName.trim() || t('decks', 'import_placeholder')
    const parsed = parseAnyDeck(importText, name)
    if (!parsed) {
      setImportError(t('errors', 'deck_parse_failed'))
      return
    }
    saveCustomDecks([...loadSavedCustomDecks(), parsed])
    setAllDecks((prev) => [...prev.filter((d) => !sameDeck(d, parsed)), parsed])
    pick(parsed)
    setShowImport(false)
    setImportText('')
    setImportName('')
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    if (!selectedDeck) return
    const xmageDeck = prepareDeckForXMage(selectedDeck, table.deckType, table.gameType)
    const finalDeck = await requestDeckValidation(xmageDeck)
    if (!finalDeck) return
    rememberDeckForFormat(profile, selectedDeck)
    setMyDeck(selectedDeck)
    try {
      await onJoin(table, finalDeck, password.trim() || undefined)
    } catch (err) {
      setJoinError((err as Error).message)
    }
  }

  const renderTiles = (items: typeof visible) => items.map(({ deck, fit }) => (
    <DeckTile
      key={deckRef(deck)}
      deck={deck}
      fit={fit}
      profile={profile}
      selected={sameDeck(selectedDeck, deck)}
      onSelect={() => pick(deck)}
    />
  ))

  return (
    <DialogShell
      labelledBy="join-table-title"
      titleId="join-table-title"
      testId="join-table-dialog"
      legacyBackdropClass="modal-backdrop"
      legacyPanelClass="join-table-modal"
      kickerIcon="swords"
      kickerLabel={title ? title.toUpperCase() : t('lobby', 'join_human_btn').toUpperCase()}
      title={table.tableName}
      topRight={(
        <CloseButton variant="plain" size="md" className="close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
    >
      <div className={`join-hero family-${profile.family}`}>
        <span className="join-hero-emblem" aria-hidden="true"><Icon name={profile.icon} size={26} /></span>
        <div className="join-hero-format">
          <span className="join-hero-format-name">{profile.label || t('common', 'all')}</span>
          <span className="join-hero-format-raw">
            {[table.deckType, table.gameType].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
        <div className="join-hero-side">
          {seats.length > 0 && (
            <span className="join-hero-seats" title={t('lobby', 'join_seats', { filled: filledSeats, total: seats.length })}>
              <span className="join-seat-dots" aria-hidden="true">
                {seats.map((s) => (
                  <span key={s.seatIndex} className={`join-seat-dot${s.playerName ? ' taken' : ''}`}>
                    {s.playerName ? s.playerName.slice(0, 1).toUpperCase() : ''}
                  </span>
                ))}
              </span>
              <span className="join-seat-count">{t('lobby', 'join_seats', { filled: filledSeats, total: seats.length })}</span>
            </span>
          )}
          <div className="join-hero-chips">
            {host && <Chip size="sm" icon="crown">{t('lobby', 'host')}: <strong>{host}</strong></Chip>}
            {table.passworded && <Chip tone="err" size="sm" icon="lock">{t('lobby', 'join_requires_password')}</Chip>}
          </div>
        </div>
      </div>

      <ErrorBanner
        message={joinError}
        onClose={() => setJoinError(null)}
        className="join-error-banner"
        testId="join-error"
      />

      <form onSubmit={handleConfirm} className="join-modal-form">
        {table.passworded && (
          <label className="join-password-field">
            <Icon name="key" size={14} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('lobby', 'join_password_enter_placeholder')}
              aria-label={t('lobby', 'create_field_password')}
              required
              className="join-password-input"
              autoFocus
            />
          </label>
        )}

        <div className="join-deck-toolbar">
          <h3 className="join-deck-heading">{t('lobby', 'join_pick_deck')}</h3>
          {allDecks.length > SEARCH_THRESHOLD && (
            <label className="join-deck-search">
              <Icon name="search" size={13} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('lobby', 'join_search_placeholder')}
                aria-label={t('lobby', 'join_search_placeholder')}
              />
            </label>
          )}
          <Button variant="soft" size="sm" data-testid="join-import-toggle-btn"
            onClick={() => setShowImport(!showImport)}>
            {showImport ? (<><Icon name="x" size={12} /> {t('lobby', 'join_import_toggle_close')}</>) : (<><Icon name="clipboard" size={12} /> {t('lobby', 'join_import_toggle_open')}</>)}
          </Button>
        </div>

        {showImport && (
          <div className="join-inline-importer">
            <input
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder={t('decks', 'import_placeholder')}
              className="import-name-input"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t('lobby', 'join_import_cards_placeholder')}
              rows={5}
              className="import-textarea"
            />
            {importError && <p className="import-error-msg">{tError(importError)}</p>}
            <div className="import-actions">
              <Button variant="primary"
                type="button"
                className="import-submit-btn"
                data-testid="import-submit-btn"
                onClick={handleImportSubmit}
                disabled={!importText.trim()}
              >
                {t('lobby', 'join_save_select')}
              </Button>
            </div>
          </div>
        )}

        <div className="join-deck-scroll" role="radiogroup" aria-label={t('lobby', 'join_pick_deck')}>
          {allDecks.length === 0 && !showImport && (
            <div className="join-deck-empty">
              <Icon name="layers" size={28} />
              <strong>{t('lobby', 'join_empty_title')}</strong>
              <span>{t('lobby', 'join_empty_hint')}</span>
            </div>
          )}
          {allDecks.length > 0 && visible.length === 0 && (
            <p className="join-deck-none">{t('lobby', 'join_search_empty')}</p>
          )}
          {splitGroups ? (
            <>
              <div className="join-deck-group-label">{t('lobby', 'join_group_ready', { format: profile.label })}</div>
              <div className="join-deck-grid">{renderTiles(fitting)}</div>
              <div className="join-deck-group-label muted">{t('lobby', 'join_group_other')}</div>
              <div className="join-deck-grid">{renderTiles(others)}</div>
            </>
          ) : (
            visible.length > 0 && <div className="join-deck-grid">{renderTiles(visible)}</div>
          )}
        </div>

        <div className="join-modal-footer">
          <div className="join-footer-selection">
            {selectedDeck ? (
              <>
                <span className="join-footer-label">{t('lobby', 'join_playing_with')}</span>
                <span className="join-footer-deck">
                  <span className="join-footer-deck-name">{selectedDeck.name}</span>
                  {selectedFit?.level === 'short' && (
                    <span className="join-footer-warn"><Icon name="alert" size={12} /> {t('lobby', 'join_fit_short', { count: selectedFit.count, min: selectedFit.min ?? 0 })}</span>
                  )}
                </span>
              </>
            ) : (
              <span className="join-footer-label">{t('lobby', 'create_err_no_deck')}</span>
            )}
          </div>
          <div className="join-footer-buttons">
            <Button variant="subtle"
              type="button"
              data-testid="join-cancel-btn"
              onClick={onClose}
              disabled={busy}
            >
              {t('common', 'cancel')}
            </Button>
            <Button variant="primary"
              type="submit"
              className="join-submit-btn"
              disabled={busy || !selectedDeck || (table.passworded && !password.trim())}
            >
              {busy ? t('common', 'loading') : (submitLabel || (selectedDeck ? t('lobby', 'join_with_deck', { name: selectedDeck.name }) : t('lobby', 'join_human_btn')))}
            </Button>
          </div>
        </div>
      </form>
    </DialogShell>
  )
}
