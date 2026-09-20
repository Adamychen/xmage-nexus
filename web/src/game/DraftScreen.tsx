import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import * as cmds from '../net/commands'
import { useStore, clearActiveDraft } from '../state/store'
import { getState, setState } from '../state/state'
import type { SimpleCardView } from '../net/types'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import { soundManager } from '../audio/soundManager'
import { buildDraftLog, type DraftLogData } from './draftLog'
import { useTranslation } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { isDraftStalled, mergePickAck, persistDraft } from '../state/events/draft'
import Modal from '../ui/Modal'
import { fetchCardJson } from '../cards/scryfallCards'
import './DraftScreen.css'

const PICK_PROTECTION_MS = 1500
const PICK_TIMEOUT_MS = 15000
const COUNTDOWN_WARN_SECS = 30
const COUNTDOWN_AUDIO_SECS = 6

function withPickTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout en draft pick (15s)')), PICK_TIMEOUT_MS)
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

const RARITY_RANK: Record<string, number> = {
  common: 2,
  uncommon: 3,
  rare: 4,
  mythic: 5,
  special: 6,
  bonus: 7,
}

function rarityRankOf(card: SimpleCardView, metaMap: Map<string, CardStripMeta>): number {
  const set = card.expansionSetCode ?? ''
  const num = card.cardNumber ?? ''
  const meta = (set && num ? metaMap.get(`${set}/${num}`) : null) ?? (card.name ? metaMap.get(card.name.toLowerCase()) : null)
  const rarity = meta?.rarity?.toLowerCase() ?? ''
  return RARITY_RANK[rarity] ?? 0
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** SimpleCardView real (draft) no trae `name`: se resuelve con el meta de Scryfall. */
function cardLabel(card: SimpleCardView, meta?: CardStripMeta | null): string {
  return card.name || meta?.name || (card.id ? card.id.slice(0, 8) : '')
}

function metaFor(card: SimpleCardView, metaMap: Map<string, CardStripMeta>): CardStripMeta | null {
  const set = card.expansionSetCode ?? ''
  const num = card.cardNumber ?? ''
  const name = card.name ?? ''
  return (set && num ? metaMap.get(`${set}/${num}`) : null) ?? (name ? metaMap.get(name.toLowerCase()) : null) ?? null
}

export default function DraftScreen() {
  const { t } = useTranslation()
  const draft = useStore((s) => s.draft)
  const lastDraftEventAt = useStore((s) => s.lastDraftEventAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!draft) return
    const id = window.setInterval(() => setNow(Date.now()), 10000)
    return () => window.clearInterval(id)
  }, [!!draft])
  useEffect(() => {
    if (draft && getState().phase !== 'game') setState({ phase: 'game' })
  }, [draft])
  const draftView = draft?.message.draftView ?? null
  const pickView = draft?.message.draftPickView ?? null

  const draftId = draft?.draftId ?? ''
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const boosterCards: SimpleCardView[] = useMemo(() => {
    if (!pickView?.booster) return []
    const cards = Object.values(pickView.booster as Record<string, SimpleCardView>)
    return [...cards].sort((a, b) => rarityRankOf(a, metaMap) - rarityRankOf(b, metaMap))
  }, [pickView?.booster, metaMap])

  const pickCards: SimpleCardView[] = useMemo(() => {
    if (!pickView?.picks) return []
    return Object.values(pickView.picks as Record<string, SimpleCardView>)
  }, [pickView?.picks])

  const picking = pickView?.picking ?? false
  const lastDraftMethod = useStore((s) => s.lastDraftMethod)
  // Un DRAFT_INIT con pick pendiente (recarga/reconexión en mitad del pick) también habilita.
  const freshPick = picking && (lastDraftMethod === 'DRAFT_PICK' || lastDraftMethod === 'DRAFT_INIT')
  const timeout = pickView?.timeout ?? 0
  const [timeLeft, setTimeLeft] = useState(timeout)
  const [busyPick, setBusyPick] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  // Acuse local del pick enviado: el servidor no manda evento hasta que TODOS
  // hayan elegido, así que sin esto la UI seguía en "tu turno" con el contador
  // corriendo y las cartas clicables (y no se veía qué carta habías elegido).
  const [pickAck, setPickAck] = useState<{ id: string; name: string } | null>(null)
  const pickKey = draft?.message?.draftView
    ? `${draft.message.draftView.boosterNum}|${draft.message.draftView.cardNum}`
    : ''
  const pickKeyRef = useRef(pickKey)
  useEffect(() => {
    if (pickKeyRef.current === pickKey) return
    pickKeyRef.current = pickKey
    setPickAck(null)
  }, [pickKey])

  const handleRetryJoin = useCallback(async () => {
    const draftId = getState().draft?.draftId
    if (!draftId || retrying) return
    setRetrying(true)
    try {
      const tid = getState().tournament?.tournamentId
      if (tid) await cmds.joinTournament(tid)
      await cmds.joinDraft(draftId)
    } finally {
      setRetrying(false)
    }
  }, [retrying])
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [hoverPreview, setHoverPreview] = useState<{ url: string; backUrl?: string | null; x: number; y: number; name?: string } | null>(null)
  const lastPickAt = useRef(0)
  const audioFiredFor = useRef('')
  const logRef = useRef<DraftLogData | null>(null)

  useEffect(() => {
    setHiddenIds(new Set())
    setMarkedIds(new Set())
    setPickError(null)
    setPickAck(null)
    lastPickAt.current = 0
    audioFiredFor.current = ''
    logRef.current = null
  }, [draftId])

  useEffect(() => {
    setTimeLeft(timeout)
  }, [timeout, draftId, boosterCards.length])

  useEffect(() => {
    setPickError(null)
  }, [boosterCards.length, draftId])

  useEffect(() => {
    if (!pickView || timeLeft <= 0) return
    if (!picking || pickAck) return
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [pickView, picking, timeLeft, draftId, pickAck])

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
      if (!(set && num && num !== '0') && !name) continue
      fetchCardJson({ cardName: name, setCode: set, cardNumber: num })
        .then((data) => {
          if (!data) return
          const meta: CardStripMeta = {
            name: data.name ?? data.card_faces?.[0]?.name ?? '',
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            rarity: data.rarity ?? '',
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
    const meta = metaFor(card, metaMap)
    const img = meta?.imageUrl ?? null
    const back = meta?.backImageUrl ?? null
    const name = cardLabel(card, meta)
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
    if (!draftId || !freshPick || busyPick || pickAck) return
    if (timeout > 0 && timeLeft <= 0) return
    const now = Date.now()
    if (now - lastPickAt.current < PICK_PROTECTION_MS) return
    lastPickAt.current = now
    const picked = boosterCards.find((c) => c.id === cardId)
    const pickName = picked ? cardLabel(picked, metaFor(picked, metaMap)) : cardId
    const sentKey = { boosterNum: draftView?.boosterNum ?? 0, cardNum: draftView?.cardNum ?? 0 }
    const setCode = draftView?.setCodes?.[(draftView?.boosterNum ?? 1) - 1] ?? draftView?.setCodes?.[0] ?? ''
    if (!logRef.current) {
      logRef.current = { draftId, startedAt: new Date(), players: draftView?.players ?? [], entries: [] }
    }
    logRef.current.entries.push({
      setCode,
      packNo: draftView?.boosterNum ?? 0,
      pickNo: draftView?.cardNum ?? 0,
      booster: boosterCards.map((c) => cardLabel(c, metaFor(c, metaMap))),
      pick: pickName,
    })
    setBusyPick(cardId)
    setPickError(null)
    try {
      const res = await withPickTimeout(cmds.sendCardPick(draftId, cardId, hiddenIds.size > 0 ? [...hiddenIds] : undefined)) as { ok?: boolean; error?: string; data?: unknown }
      if (!res?.ok) {
        setPickError(t('game', 'draft_pick_failed'))
      } else {
        // La respuesta del proxy trae el DraftPickView posterior al pick
        // (picking:false). Si el siguiente DRAFT_PICK ya llegó, se descarta.
        const cur = getState().draft
        const curView = cur?.message?.draftView
        const stillCurrent =
          !!cur && cur.draftId === draftId &&
          curView?.boosterNum === sentKey.boosterNum && curView?.cardNum === sentKey.cardNum
        if (stillCurrent) {
          const merged = mergePickAck(cur, draftId, res.data, sentKey)
          if (merged) {
            setState({ draft: merged })
            persistDraft(merged)
          }
          setPickAck({ id: cardId, name: pickName })
        }
      }
      await cmds.setBoosterLoaded(draftId)
    } catch {
      setPickError(t('game', 'draft_pick_failed'))
    } finally {
      setBusyPick(null)
    }
  }, [draftId, freshPick, busyPick, pickAck, boosterCards, draftView, hiddenIds, metaMap, t, timeLeft, timeout])

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
    if (!(await confirmDialog(t('game', 'draft_quit_confirm'), { danger: true }))) return
    await cmds.quitDraft(draftId)
    clearActiveDraft()
  }, [draftId, t])

  const handleHidePick = useCallback((cardId: string) => {
    setHiddenIds((prev) => {
      const nxt = new Set(prev)
      nxt.add(cardId)
      return nxt
    })
  }, [])

  const handleShowAllHidden = useCallback(() => {
    setHiddenIds(new Set())
  }, [])

  useEffect(() => {
    if (!draft) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault()
        setHiddenIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft])

  const handleDownloadLog = useCallback(() => {
    const log = logRef.current
    if (!log || log.entries.length === 0) return
    const text = buildDraftLog(log)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Draft_${log.startedAt.toISOString().slice(0, 10)}_${log.draftId.slice(0, 8)}.draft`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  useEffect(() => {
    if (!picking || pickAck || boosterCards.length === 0 || !pickView) return
    const windowKey = `${draftId}|${draftView?.boosterNum ?? 0}|${draftView?.cardNum ?? 0}`
    if (timeLeft === COUNTDOWN_AUDIO_SECS && audioFiredFor.current !== windowKey) {
      audioFiredFor.current = windowKey
      try {
        soundManager.play('timer_tick', 'game')
      } catch {}
    }
  }, [timeLeft, picking, pickAck, boosterCards.length, pickView, draftId, draftView])

  useEffect(() => {
    if (!picking || pickAck || boosterCards.length === 0 || typeof document === 'undefined' || !document.hidden) return
    const prev = document.title
    document.title = `(${formatTime(timeLeft)}) Draft`
    const timer = setTimeout(() => {
      document.title = prev
    }, 4000)
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Draft', { body: t('game', 'draft_pick_hint') })
      }
    } catch {}
    return () => {
      clearTimeout(timer)
      document.title = prev
    }
  }, [pickView, picking, pickAck, boosterCards.length, timeLeft, t])

  if (!draft || !draftView) return null

  const setCodesLabel = draftView.setCodes?.join(', ') ?? ''
  const setNamesLabel = draftView.setNames?.join(', ') ?? ''
  const packs = draftView.setCodes?.length ?? 0
  const pct = timeout > 0 ? Math.max(0, (timeLeft / timeout) * 100) : 0
  const unlimited = timeout === 0
  const expired = timeout > 0 && picking && !pickAck && timeLeft <= 0
  const activePick = picking && !pickAck && !expired
  const urgent = activePick && !unlimited && timeLeft <= 10
  const warn = activePick && !unlimited && !urgent && timeLeft <= COUNTDOWN_WARN_SECS
  const canPick = freshPick && !pickAck && !busyPick && !expired
  const players = draftView.players ?? []
  const passLeft = (draftView.boosterNum ?? 1) % 2 === 1
  const visiblePicks = pickCards.filter((c) => !hiddenIds.has(c.id))
  const hiddenCount = pickCards.length - visiblePicks.length

  return (
    <Modal backdropClassName="draft-backdrop" dialogClassName="draft-screen" label={t('game', 'draft_title')}>
        <header className="draft-header">
          <div className="draft-title">
            <h2>{t('game', 'draft_title')}</h2>
            <span className="draft-subtitle">
              {packs > 0
                ? t('game', 'draft_pack_of', { pack: String(draftView.boosterNum), packs: String(packs) })
                : t('game', 'draft_booster', { number: String(draftView.boosterNum) })}
              {' · '}
              {t('game', 'draft_pick_no', { pick: String(draftView.cardNum) })}
              {setCodesLabel ? ` · ${setCodesLabel}` : ''}
            </span>
            {setNamesLabel && setCodesLabel !== setNamesLabel && (
              <span className="draft-set-names">{setNamesLabel}</span>
            )}
          </div>
          <div className="draft-header-right">
            {pickView && (
              activePick ? (
                <div className={`draft-timer ${urgent ? 'urgent' : ''} ${warn ? 'warn' : ''} picking`}>
                  <div className="draft-timer-bar" style={{ width: `${unlimited ? 100 : pct}%` }} />
                  <span className="draft-timer-text" data-testid="draft-timeout">
                    {unlimited ? '∞' : formatTime(timeLeft)}
                  </span>
                  <span className="draft-timer-label">{t('game', 'draft_your_turn')}</span>
                </div>
              ) : (
                <div className={`draft-timer waiting ${expired ? 'urgent' : ''}`} data-testid="draft-waiting">
                  {!expired && <span className="draft-waiting-dot" aria-hidden="true" />}
                  <span className="draft-timer-label">
                    {expired ? t('game', 'draft_pick_expired') : t('game', 'draft_waiting')}
                  </span>
                </div>
              )
            )}
            <Button variant="soft" size="sm" data-testid="draft-log-btn" onClick={() => handleDownloadLog()} title={t('game', 'draft_download_log')}>
              {t('game', 'draft_download_log')}
            </Button>
            <Button variant="soft-danger" size="sm" data-testid="draft-quit-btn" onClick={() => void handleQuit()} title={t('game', 'draft_quit_title')}>
              {t('game', 'draft_quit')}
            </Button>
          </div>
        </header>

        <div className="draft-status">
          {pickAck ? (
            <span className="draft-status-waiting" data-testid="draft-status-waiting">{t('game', 'draft_waiting_others')}</span>
          ) : expired ? (
            <span className="draft-status-waiting">{t('game', 'draft_pick_expired')}</span>
          ) : picking ? (
            <span className="draft-status-picking">{t('game', 'draft_pick_long')}</span>
          ) : (
            <span className="draft-status-waiting">{t('game', 'draft_waiting')}</span>
          )}
          <span className="draft-status-count">{t('game', 'draft_status_count', { booster: String(boosterCards.length), boosterPlural: boosterCards.length !== 1 ? 's' : '', picks: String(pickCards.length), picksPlural: pickCards.length !== 1 ? 's' : '' })}</span>
        </div>
        {pickAck && (
          <div className="draft-picked-banner" data-testid="draft-picked-banner" role="status" aria-live="polite">
            <span className="draft-picked-check" aria-hidden="true">✓</span>
            <span className="draft-picked-text">{t('game', 'draft_picked_card', { card: pickAck.name })}</span>
            <span className="draft-picked-wait">{t('game', 'draft_waiting_others')}</span>
          </div>
        )}
        {pickError && (
          <div className="error-box draft-pick-error" data-testid="draft-pick-error" role="alert">{pickError}</div>
        )}
        {isDraftStalled(lastDraftEventAt, draft != null, now) && (
          <div className="error-box draft-stalled" data-testid="draft-stalled" role="alert">
            <span>{t('game', 'draft_stalled')}</span>{' '}
            <Button
              variant="subtle"
              size="sm"
              data-testid="draft-retry"
              disabled={retrying}
              onClick={() => void handleRetryJoin()}
            >
              {t('game', 'draft_retry')}
            </Button>
          </div>
        )}
        {players.length > 0 && (
          <div className="draft-table" title={t('game', 'draft_table_title')} data-testid="draft-table">
            <span className="draft-table-dir" aria-hidden="true">{passLeft ? '←' : '→'}</span>
            <span className="draft-table-dir-label">{passLeft ? t('game', 'draft_pass_left') : t('game', 'draft_pass_right')}</span>
            {players.map((p, i) => (
              <span key={`${i}-${p}`} className="draft-seat">{p}</span>
            ))}
          </div>
        )}

        <div className="draft-booster-area">
          <h3 className="draft-section-title">{t('game', 'booster_label')}</h3>
          {boosterCards.length === 0 ? (
            <EmptyState>{t('game', 'draft_loading')}</EmptyState>
          ) : (
            <div className="draft-grid" data-testid="draft-booster">
              {boosterCards.map((card) => {
                const set = card.expansionSetCode ?? ''
                const num = card.cardNumber ?? ''
                const key = card.id
                const meta = metaFor(card, metaMap)
                const name = cardLabel(card, meta)
                const img = meta?.imageUrl ?? meta?.artCropUrl ?? null
                const marked = markedIds.has(key)
                const isBusy = busyPick === key
                const isPicked = pickAck?.id === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`draft-card ${marked ? 'is-marked' : ''} ${!canPick ? 'is-disabled' : ''} ${isBusy ? 'is-busy' : ''} ${isPicked ? 'is-picked' : ''}`}
                    disabled={!canPick}
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
                    {isPicked && <span className="draft-card-busy draft-card-picked">✓</span>}
                    <span className="draft-card-name-overlay">{name || key}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="draft-picks-area" onContextMenu={(e) => { if (hiddenCount > 0) { e.preventDefault(); handleShowAllHidden() } }}>
          <h3 className="draft-section-title">{t('game', 'draft_picks_title', { count: String(pickCards.length) })}</h3>
          {hiddenCount > 0 && (
            <Button variant="ghost" size="sm" className="draft-hidden-link" onClick={() => handleShowAllHidden()} title={t('game', 'draft_show_all')}>
              {t('game', 'draft_hidden', { count: String(hiddenCount) })}
            </Button>
          )}
          {visiblePicks.length === 0 ? (
            <EmptyState size="sm">{t('game', 'draft_empty')}</EmptyState>
          ) : (
            <div className="draft-picks-grid" data-testid="draft-picks">
              {visiblePicks.map((card) => {
                const key = card.id
                const meta = metaFor(card, metaMap)
                const name = cardLabel(card, meta)
                const img = meta?.imageUrl ?? meta?.artCropUrl ?? null
                const isNew = pickAck?.id === key
                return (
                  <div
                    key={key}
                    className={`draft-pick-card ${isNew ? 'is-new' : ''}`}
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
                    {isNew && <span className="draft-pick-new-badge" data-testid="draft-pick-new" aria-hidden="true">✓</span>}
                    <IconButton label={t('game', 'draft_hide_pick')} size="xs" round
                      className="draft-pick-hide"
                      data-testid="draft-pick-hide"
                      onClick={(e) => { e.stopPropagation(); handleHidePick(key) }}
                      onMouseEnter={(e) => e.stopPropagation()}>
                      👁
                    </IconButton>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      {hoverPreview && (
        <div
          className={`arena-floating-preview ${hoverPreview.backUrl ? 'has-back-face' : ''}`}
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
        >
          <div className="preview-face-card">
            {hoverPreview.backUrl && <span className="preview-face-label">{t('wiki', 'face_front')}</span>}
            <img src={hoverPreview.url} alt={hoverPreview.name ?? t('wiki', 'face_front')} />
          </div>
          {hoverPreview.backUrl && (
            <div className="preview-face-card">
              <span className="preview-face-label">{t('wiki', 'face_back')}</span>
              <img src={hoverPreview.backUrl} alt={`${hoverPreview.name ?? 'Carta'} (${t('wiki', 'face_back')})`} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
