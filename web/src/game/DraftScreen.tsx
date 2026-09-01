import { useCallback, useEffect, useState, useMemo } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { getState, setState } from '../state/state'
import type { SimpleCardView } from '../net/types'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import { useTranslation } from '../i18n'
import './DraftScreen.css'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DraftScreen() {
  const { t } = useTranslation()
  const draft = useStore((s) => s.draft)
  useEffect(() => {
    if (draft && getState().phase !== 'game') setState({ phase: 'game' })
  }, [draft])
  const draftView = draft?.message.draftView ?? null
  const pickView = draft?.message.draftPickView ?? null

  const draftId = draft?.draftId ?? ''
  const boosterCards: SimpleCardView[] = useMemo(() => {
    if (!pickView?.booster) return []
    return Object.values(pickView.booster as Record<string, SimpleCardView>)
  }, [pickView?.booster])

  const pickCards: SimpleCardView[] = useMemo(() => {
    if (!pickView?.picks) return []
    return Object.values(pickView.picks as Record<string, SimpleCardView>)
  }, [pickView?.picks])

  const picking = pickView?.picking ?? false
  const timeout = pickView?.timeout ?? 0

  const [timeLeft, setTimeLeft] = useState(timeout)
  const [busyPick, setBusyPick] = useState<string | null>(null)
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const [hoverPreview, setHoverPreview] = useState<{ url: string; backUrl?: string | null; x: number; y: number; name?: string } | null>(null)

  useEffect(() => {
    setTimeLeft(timeout)
  }, [timeout, draftId, boosterCards.length])

  useEffect(() => {
    if (!pickView || timeLeft <= 0) return
    if (!picking) return
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [pickView, picking, timeLeft, draftId])

  useEffect(() => {
    if (!pickView || !draftId) return
    if (boosterCards.length > 0) {
      void cmds.setBoosterLoaded(draftId)
    }
  }, [draftId, pickView, boosterCards.length])

  const fetchMeta = useCallback((cards: SimpleCardView[]) => {
    const toFetch: SimpleCardView[] = []
    for (const c of cards) {
      const set = c.expansionSetCode ?? ''
      const num = c.cardNumber ?? ''
      const key = set && num ? `${set}/${num}` : ''
      const nameKey = (c.name ?? '').toLowerCase()
      if (key && !metaMap.has(key) && !metaMap.has(nameKey)) {
        toFetch.push(c)
      } else if (!key && nameKey && !metaMap.has(nameKey)) {
        toFetch.push(c)
      }
    }
    if (toFetch.length === 0) return
    for (const c of toFetch) {
      const set = c.expansionSetCode ?? ''
      const num = c.cardNumber ?? ''
      const name = c.name ?? ''
      const url = set && num && num !== '0'
        ? `https://api.scryfall.com/cards/${set}/${num}?format=json`
        : name ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}` : null
      if (!url) continue
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            legalities: data.legalities,
          }
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            if (set && num) nxt.set(`${set}/${num}`, meta)
            if (name) nxt.set(name.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }, [metaMap])

  useEffect(() => {
    if (boosterCards.length === 0 && pickCards.length === 0) return
    fetchMeta([...boosterCards, ...pickCards])
  }, [boosterCards.length, pickCards.length])

  const handleHover = useCallback((card: SimpleCardView, rect?: DOMRect) => {
    const set = card.expansionSetCode ?? ''
    const num = card.cardNumber ?? ''
    const name = card.name ?? ''
    const meta = (set && num ? metaMap.get(`${set}/${num}`) : null) ?? (name ? metaMap.get(name.toLowerCase()) : null)
    const img = meta?.imageUrl ?? null
    const back = meta?.backImageUrl ?? null
    if (!img) return
    let x = 0
    let y = 0
    const previewW = back ? 520 : 255
    if (rect) {
      if (rect.left > window.innerWidth / 2) x = Math.max(10, rect.left - previewW - 15)
      else x = Math.min(window.innerWidth - previewW - 15, rect.right + 15)
      y = Math.max(30, Math.min(window.innerHeight - 380, rect.top - 40))
    } else {
      x = window.innerWidth / 2 - previewW / 2
      y = window.innerHeight / 2 - 180
    }
    setHoverPreview({ url: img, backUrl: back, x, y, name })
  }, [metaMap])

  const handleLeave = useCallback(() => setHoverPreview(null), [])

  const handlePick = useCallback(async (cardId: string) => {
    if (!draftId || !picking || busyPick) return
    setBusyPick(cardId)
    try {
      const res = await cmds.sendCardPick(draftId, cardId)
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn('sendCardPick failed', res.error)
      }
      await cmds.setBoosterLoaded(draftId)
    } finally {
      setBusyPick(null)
    }
  }, [draftId, picking, busyPick])

  const handleMark = useCallback(async (cardId: string) => {
    if (!draftId) return
    setMarkedIds((prev) => {
      const nxt = new Set(prev)
      if (nxt.has(cardId)) nxt.delete(cardId)
      else nxt.add(cardId)
      return nxt
    })
    try {
      await cmds.sendCardMark(draftId, cardId)
    } catch {}
  }, [draftId])

  const handleQuit = useCallback(async () => {
    if (!draftId) return
    await cmds.quitDraft(draftId)
  }, [draftId])

  if (!draft || !draftView) return null

  const setCodesLabel = draftView.setCodes?.join(', ') ?? ''
  const setNamesLabel = draftView.setNames?.join(', ') ?? ''
  const pct = timeout > 0 ? Math.max(0, (timeLeft / timeout) * 100) : 0
  const urgent = timeLeft <= 10 && picking

  return (
    <div className="draft-backdrop" role="presentation">
      <section className="draft-screen" role="dialog" aria-modal="true" aria-label="Draft">
        <header className="draft-header">
          <div className="draft-title">
            <h2>Draft</h2>
            <span className="draft-subtitle">
              Booster {draftView.boosterNum} · Carta {draftView.cardNum}
              {setCodesLabel ? ` · ${setCodesLabel}` : ''}
            </span>
            {setNamesLabel && setCodesLabel !== setNamesLabel && (
              <span className="draft-set-names">{setNamesLabel}</span>
            )}
          </div>
          <div className="draft-header-right">
            {pickView && (
              <div className={`draft-timer ${urgent ? 'urgent' : ''} ${picking ? 'picking' : 'waiting'}`}>
                <div className="draft-timer-bar" style={{ width: `${pct}%` }} />
                <span className="draft-timer-text" data-testid="draft-timeout">{formatTime(timeLeft)}</span>
                <span className="draft-timer-label">{picking ? t('game', 'draft_your_turn') : t('game', 'draft_waiting')}</span>
              </div>
            )}
            <button type="button" className="draft-quit-btn" onClick={() => void handleQuit()} title={t('game', 'draft_quit_title')}>
              {t('game', 'draft_quit')}
            </button>
          </div>
        </header>

        <div className="draft-status">
          {picking ? (
            <span className="draft-status-picking">{t('game', 'draft_pick_long')}</span>
          ) : (
            <span className="draft-status-waiting">{t('game', 'draft_waiting')}</span>
          )}
          <span className="draft-status-count">{t('game', 'draft_status_count', { booster: String(boosterCards.length), boosterPlural: boosterCards.length !== 1 ? 's' : '', picks: String(pickCards.length), picksPlural: pickCards.length !== 1 ? 's' : '' })}</span>
        </div>

        <div className="draft-booster-area">
          <h3 className="draft-section-title">Booster</h3>
          {boosterCards.length === 0 ? (
            <div className="draft-empty">{t('game', 'draft_loading')}</div>
          ) : (
            <div className="draft-grid" data-testid="draft-booster">
              {boosterCards.map((card) => {
                const set = card.expansionSetCode ?? ''
                const num = card.cardNumber ?? ''
                const name = card.name ?? ''
                const key = card.id
                const meta = (set && num ? metaMap.get(`${set}/${num}`) : null) ?? (name ? metaMap.get(name.toLowerCase()) : null)
                const img = meta?.imageUrl ?? meta?.artCropUrl ?? null
                const marked = markedIds.has(key)
                const isBusy = busyPick === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`draft-card ${marked ? 'is-marked' : ''} ${!picking ? 'is-disabled' : ''} ${isBusy ? 'is-busy' : ''}`}
                    disabled={!picking || !!busyPick}
                    onClick={() => void handlePick(key)}
                    onContextMenu={(e) => { e.preventDefault(); void handleMark(key) }}
                    onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
                    onMouseLeave={handleLeave}
                    title={name || `${set}/${num}` || key}
                    data-testid="draft-card"
                    data-card-id={key}
                  >
                    {img ? (
                      <img src={img} alt={name || key} className="draft-card-img" loading="lazy" />
                    ) : (
                      <div className="draft-card-placeholder">
                        <span className="draft-card-placeholder-name">{name || key.slice(0, 8)}</span>
                        <span className="draft-card-placeholder-set">{set && num ? `${set}/${num}` : ''}</span>
                      </div>
                    )}
                    {marked && <span className="draft-card-mark">★</span>}
                    {isBusy && <span className="draft-card-busy">…</span>}
                    <span className="draft-card-name-overlay">{name || key}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="draft-picks-area">
          <h3 className="draft-section-title">{t('game', 'draft_picks_title', { count: String(pickCards.length) })}</h3>
          {pickCards.length === 0 ? (
            <div className="draft-picks-empty">{t('game', 'draft_empty')}</div>
          ) : (
            <div className="draft-picks-grid" data-testid="draft-picks">
              {pickCards.map((card) => {
                const set = card.expansionSetCode ?? ''
                const num = card.cardNumber ?? ''
                const name = card.name ?? ''
                const key = card.id
                const meta = (set && num ? metaMap.get(`${set}/${num}`) : null) ?? (name ? metaMap.get(name.toLowerCase()) : null)
                const img = meta?.imageUrl ?? meta?.artCropUrl ?? null
                return (
                  <div
                    key={key}
                    className="draft-pick-card"
                    onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
                    onMouseLeave={handleLeave}
                    title={name || key}
                    data-testid="draft-pick-card"
                    data-card-id={key}
                  >
                    {img ? (
                      <img src={img} alt={name || key} className="draft-pick-img" loading="lazy" />
                    ) : (
                      <div className="draft-card-placeholder small">
                        <span className="draft-card-placeholder-name">{name || key.slice(0, 8)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
      {hoverPreview && (
        <div
          className={`arena-floating-preview ${hoverPreview.backUrl ? 'has-back-face' : ''}`}
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
        >
          <div className="preview-face-card">
            {hoverPreview.backUrl && <span className="preview-face-label">Anverso</span>}
            <img src={hoverPreview.url} alt={hoverPreview.name ?? 'Anverso'} />
          </div>
          {hoverPreview.backUrl && (
            <div className="preview-face-card">
              <span className="preview-face-label">Reverso</span>
              <img src={hoverPreview.backUrl} alt={`${hoverPreview.name ?? 'Carta'} (Reverso)`} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
